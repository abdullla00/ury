"""POS shift gate — scenario detection and Desk route helpers for URY POS."""

from __future__ import annotations

from urllib.parse import urlencode

import frappe
from frappe import _
from frappe.utils import cint, getdate, today

from ury.ury_pos.api import getBranch, getBranchRoom, get_pos_profile_for_branch, refresh_outdated_pos_opening_entries


def _desk_form_route(doctype_slug: str, docname: str | None = None, **query) -> str:
    params = {"ury_return": "/pos", **{k: v for k, v in query.items() if v is not None and v != ""}}
    qs = urlencode(params)
    if docname:
        return f"/app/{doctype_slug}/{docname}?{qs}"
    return f"/app/{doctype_slug}/new?{qs}"


def _profile_main_cashier(pos_profile_doc):
    for row in pos_profile_doc.applicable_for_users or []:
        if row.custom_main_cashier:
            return row.user
    return None


def _user_full_name(user: str) -> str:
    if not user:
        return ""
    return frappe.db.get_value("User", user, "full_name") or user


def _get_room_context():
    branch = getBranch()
    room = None
    try:
        details = getBranchRoom()
        if details:
            room = details[0].get("name")
            branch = details[0].get("branch") or branch
    except Exception:
        pass
    return branch, room


def _get_open_entries(branch: str, room: str | None, multiple_cashier: bool):
    # Room-scoped lookup when cashier has a URY room (align with pos_opening_check).
    if room:
        return frappe.db.sql(
            """
            SELECT DISTINCT po.name, po.user, po.period_start_date, po.posting_date, po.pos_profile
            FROM `tabPOS Opening Entry` po
            INNER JOIN `tabMultiple Rooms` mr ON mr.parent = po.name
            WHERE po.branch = %s
              AND po.status = 'Open'
              AND po.docstatus = 1
              AND mr.room = %s
            ORDER BY po.period_start_date DESC
            """,
            (branch, room),
            as_dict=True,
        )
    return frappe.get_all(
        "POS Opening Entry",
        fields=["name", "user", "period_start_date", "posting_date", "pos_profile"],
        filters={"branch": branch, "status": "Open", "docstatus": 1},
        order_by="period_start_date desc",
    )


def _entry_is_today(entry: dict) -> bool:
    business_today = today()
    period_start = entry.get("period_start_date")
    posting_date = entry.get("posting_date")
    if period_start and getdate(period_start) == getdate(business_today):
        return True
    if posting_date and getdate(posting_date) == getdate(business_today):
        return True
    return False


def _get_draft_opening(user: str, pos_profile: str, business_date: str):
    drafts = frappe.get_all(
        "POS Opening Entry",
        fields=["name"],
        filters={
            "user": user,
            "pos_profile": pos_profile,
            "posting_date": business_date,
            "docstatus": 0,
        },
        order_by="modified desc",
        limit=1,
    )
    return drafts[0].name if drafts else None


def _main_cashier_open_today(branch: str, main_user: str, business_date: str) -> bool:
    if not main_user:
        return True
    return bool(
        frappe.db.exists(
            "POS Opening Entry",
            {
                "branch": branch,
                "user": main_user,
                "posting_date": business_date,
                "status": "Open",
                "docstatus": 1,
            },
        )
    )


def _closing_queued(pos_profile: str, user: str) -> bool:
    return bool(
        frappe.db.exists(
            "POS Closing Entry",
            {
                "pos_profile": pos_profile,
                "user": user,
                "status": "Queued",
                "docstatus": 1,
            },
        )
    )


def _daily_close_blocked(pos_profile: str) -> str | None:
    from ury.ury_pos.api import validate_pos_close

    if validate_pos_close(pos_profile) == "Failed":
        return frappe.db.get_value(
            "POS Opening Entry",
            {
                "pos_profile": pos_profile,
                "status": "Open",
                "docstatus": 1,
            },
            "name",
        )
    return None


def _suggested_opening_balances(pos_profile: str, fallback_opening: str | None = None):
    closing_name = frappe.db.get_value(
        "POS Closing Entry",
        {"pos_profile": pos_profile, "docstatus": 1},
        "name",
        order_by="posting_date desc",
    )
    balances = []
    if closing_name:
        rows = frappe.get_all(
            "POS Closing Entry Detail",
            fields=["mode_of_payment", "closing_amount"],
            filters={"parent": closing_name, "parenttype": "POS Closing Entry"},
        )
        for row in rows:
            if row.mode_of_payment:
                balances.append(
                    {
                        "mode_of_payment": row.mode_of_payment,
                        "amount": float(row.closing_amount or 0),
                    }
                )
    if not balances and fallback_opening:
        rows = frappe.get_all(
            "POS Opening Entry Detail",
            fields=["mode_of_payment", "opening_amount"],
            filters={"parent": fallback_opening, "parenttype": "POS Opening Entry"},
        )
        for row in rows:
            if row.mode_of_payment:
                balances.append(
                    {
                        "mode_of_payment": row.mode_of_payment,
                        "amount": float(row.opening_amount or 0),
                    }
                )
    return balances


def _shift_summary_from_entry(entry_name: str):
    if not entry_name:
        return None
    row = frappe.db.get_value(
        "POS Opening Entry",
        entry_name,
        ["name", "period_start_date", "posting_date"],
        as_dict=True,
    )
    if not row:
        return None
    return {
        "opening_entry": row.name,
        "period_start": str(row.period_start_date) if row.period_start_date else None,
        "posting_date": str(row.posting_date) if row.posting_date else None,
    }


def build_pos_shift_gate():
    user = frappe.session.user
    branch, room = _get_room_context()
    business_date = today()

    pos_profile_name = get_pos_profile_for_branch(branch)
    if not pos_profile_name:
        frappe.throw(_("No POS Profile found for branch {0}").format(branch))

    pos_profile_doc = frappe.get_doc("POS Profile", pos_profile_name)
    company = pos_profile_doc.company
    restaurant = getattr(pos_profile_doc, "restaurant", None) or frappe.db.get_value(
        "POS Profile", pos_profile_name, "restaurant"
    )
    multiple_cashier = cint(pos_profile_doc.custom_enable_multiple_cashier)
    main_cashier = _profile_main_cashier(pos_profile_doc)
    is_main_cashier = not multiple_cashier or user == main_cashier

    can_create_opening = frappe.has_permission("POS Opening Entry", "create")
    can_close_shift = frappe.has_permission("POS Closing Entry", "create")

    base = {
        "pos_profile": pos_profile_name,
        "company": company,
        "branch": branch,
        "restaurant": restaurant,
        "room": room,
        "stale_opening_entry": None,
        "draft_opening_entry": None,
        "main_cashier": main_cashier,
        "main_cashier_name": _user_full_name(main_cashier) if main_cashier else None,
        "is_main_cashier": is_main_cashier,
        "main_cashier_open": _main_cashier_open_today(branch, main_cashier, business_date),
        "can_create_opening": can_create_opening,
        "can_close_shift": can_close_shift,
        "open_entry_owner": None,
        "open_entry_owner_name": None,
        "suggested_opening_balances": [],
        "business_date": business_date,
        "completed_steps": {"closed_previous": True, "opened_today": False},
        "desk_routes": {},
        "shift_summary": None,
        "allow_start_fresh": True,
    }

    def with_routes(scenario: str, stale: str | None = None, draft: str | None = None):
        base["scenario"] = scenario
        base["stale_opening_entry"] = stale
        base["draft_opening_entry"] = draft
        base["suggested_opening_balances"] = _suggested_opening_balances(
            pos_profile_name, stale
        )
        open_route = _desk_form_route(
            "pos-opening-entry",
            None,
            pos_profile=pos_profile_name,
            company=company,
            branch=branch,
        )
        base["desk_routes"] = {
            "open_shift": open_route,
            "resume_draft": _desk_form_route("pos-opening-entry", draft) if draft else None,
            "close_shift": _desk_form_route(
                "pos-closing-entry",
                None,
                pos_profile=pos_profile_name,
                pos_opening_entry=stale or "",
                company=company,
            ),
            "view_opening": _desk_form_route("pos-opening-entry", stale) if stale else None,
        }
        if scenario == "ok" and stale:
            base["shift_summary"] = _shift_summary_from_entry(stale)
        return base

    refresh_outdated_pos_opening_entries(branch)
    open_entries = _get_open_entries(branch, room, multiple_cashier)

    today_entry = next((e for e in open_entries if _entry_is_today(e)), None)
    if today_entry:
        base.update(with_routes("ok", stale=today_entry.name))
        base["completed_steps"] = {"closed_previous": True, "opened_today": True}
        base["open_entry_owner"] = today_entry.user
        base["open_entry_owner_name"] = _user_full_name(today_entry.user)
        return base

    if _closing_queued(pos_profile_name, user):
        stale = open_entries[0].name if open_entries else None
        base.update(with_routes("closing_queued", stale=stale))
        return base

    if multiple_cashier and not is_main_cashier and not base["main_cashier_open"]:
        base.update(with_routes("waiting_main"))
        return base

    draft = _get_draft_opening(user, pos_profile_name, business_date)
    if draft:
        base.update(with_routes("draft", draft=draft))
        profile_open = frappe.db.exists(
            "POS Opening Entry",
            {"pos_profile": pos_profile_name, "status": "Open", "docstatus": 1},
        )
        base["allow_start_fresh"] = not profile_open
        return base

    unclosed_name = _daily_close_blocked(pos_profile_name)
    if unclosed_name:
        base.update(with_routes("closing", stale=unclosed_name))
        base["completed_steps"] = {"closed_previous": False, "opened_today": False}
        return base

    stale_entry = open_entries[0] if open_entries else None
    if stale_entry:
        profile_open = frappe.db.get_value(
            "POS Opening Entry",
            stale_entry.name,
            ["user", "name"],
            as_dict=True,
        )
        if profile_open and profile_open.user != user:
            base.update(with_routes("blocked_by_other", stale=profile_open.name))
            base["open_entry_owner"] = profile_open.user
            base["open_entry_owner_name"] = _user_full_name(profile_open.user)
            return base

        base.update(with_routes("outdated", stale=stale_entry.name))
        base["completed_steps"] = {"closed_previous": False, "opened_today": False}
        return base

    profile_open_other = frappe.get_all(
        "POS Opening Entry",
        fields=["name", "user"],
        filters={"pos_profile": pos_profile_name, "status": "Open", "docstatus": 1},
        limit=1,
    )
    if profile_open_other and profile_open_other[0].user != user:
        row = profile_open_other[0]
        base.update(with_routes("blocked_by_other", stale=row.name))
        base["open_entry_owner"] = row.user
        base["open_entry_owner_name"] = _user_full_name(row.user)
        return base

    base.update(with_routes("opening"))
    base["completed_steps"] = {"closed_previous": True, "opened_today": False}
    return base
