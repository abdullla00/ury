"""KOT status helpers for POS Orders list."""

from __future__ import annotations

import frappe
from frappe.utils import cint, now_datetime

POS_INVOICE_LIST_FIELDS = """
    name, invoice_printed, grand_total, restaurant_table,
    cashier, waiter, net_total, posting_time,
    total_taxes_and_charges, customer, status, mobile_number,
    posting_date, rounded_total, order_type,
    custom_comments, custom_allergy_note,
    (SELECT COUNT(*) FROM `tabPOS Invoice Item` pi
     WHERE pi.parent = `tabPOS Invoice`.name) AS item_count
"""

CANCEL_KOT_TYPES = frozenset({"Cancelled", "Partially cancelled"})
IN_KITCHEN_SUMMARIES = frozenset({"in_kitchen", "partial", "ready"})
KOT_RUSH_PRIORITY = {
    "delayed": 0,
    "in_kitchen": 1,
    "partial": 1,
    "ready": 2,
    "cancel_pending": 3,
    "not_sent": 4,
    "served": 5,
}
MAX_KOT_FILTER_SCAN = 500
SUMMARY_PRIORITY = {
    "cancel_pending": 6,
    "in_kitchen": 5,
    "partial": 4,
    "ready": 3,
    "served": 2,
    "not_sent": 1,
}


def compute_elapsed_minutes(kot_time):
    if not kot_time:
        return 0
    now = now_datetime()
    time_str = str(kot_time)
    parts = time_str.split(":")
    if len(parts) < 2:
        return 0
    hours = int(parts[0])
    minutes = int(parts[1])
    seconds = int(float(parts[2])) if len(parts) > 2 else 0
    kot_dt = now.replace(hour=hours, minute=minutes, second=seconds, microsecond=0)
    if kot_dt > now:
        kot_dt = kot_dt.replace(day=kot_dt.day - 1) if kot_dt.day > 1 else kot_dt
    diff = now - kot_dt
    return max(0, int(diff.total_seconds() / 60))


def map_kot_row_to_status(order_status: str, kot_type: str) -> str:
    if kot_type in CANCEL_KOT_TYPES and order_status != "Served":
        return "cancel_pending"
    if order_status == "Ready For Prepare":
        return "in_kitchen"
    if order_status == "Ready":
        return "ready"
    if order_status == "Served":
        return "served"
    return "in_kitchen"


def summarize_kot_status(station_statuses: list[str]) -> str:
    if not station_statuses:
        return "not_sent"
    unique = set(station_statuses)
    if len(unique) == 1:
        return station_statuses[0]
    if unique <= {"served"}:
        return "served"
    if "served" in unique and unique - {"served"}:
        return "partial"
    return max(station_statuses, key=lambda s: SUMMARY_PRIORITY.get(s, 0))


def get_kot_breakdown_for_invoices(invoice_names: list[str], kot_warning_time: int = 0) -> dict:
    if not invoice_names:
        return {}

    rows = frappe.db.sql(
        """
        SELECT invoice, production, order_status, type, time
        FROM `tabURY KOT`
        WHERE invoice IN %(names)s AND docstatus = 1
        ORDER BY modified DESC
        """,
        {"names": tuple(invoice_names)},
        as_dict=True,
    )

    by_invoice: dict[str, dict] = {}
    alert = cint(kot_warning_time or 0)

    for row in rows:
        invoice = row.invoice
        if invoice not in by_invoice:
            by_invoice[invoice] = {
                "stations": {},
                "kot_modified": False,
                "kot_delayed": False,
            }
        bucket = by_invoice[invoice]
        production = row.production or "Kitchen"
        if production in bucket["stations"]:
            continue
        status = map_kot_row_to_status(row.order_status or "", row.type or "")
        bucket["stations"][production] = {
            "production": production,
            "status": status,
            "type": row.type,
        }
        if row.type == "Order Modified":
            bucket["kot_modified"] = True
        if alert and status in ("in_kitchen", "ready", "partial", "cancel_pending"):
            elapsed = compute_elapsed_minutes(row.time)
            if elapsed >= alert:
                bucket["kot_delayed"] = True

    result = {}
    for invoice, bucket in by_invoice.items():
        station_lines = list(bucket["stations"].values())
        statuses = [line["status"] for line in station_lines]
        result[invoice] = {
            "kot_summary": summarize_kot_status(statuses),
            "kot_stations": station_lines,
            "kot_modified": bucket["kot_modified"],
            "kot_delayed": bucket["kot_delayed"],
        }
    return result


def enrich_invoices_with_kot(invoices: list[dict], kot_warning_time: int = 0) -> list[dict]:
    if not invoices:
        return invoices
    try:
        names = [inv["name"] for inv in invoices if inv.get("name")]
        breakdown = get_kot_breakdown_for_invoices(names, kot_warning_time)
        for inv in invoices:
            kot = breakdown.get(inv["name"], {})
            inv["kot_summary"] = kot.get("kot_summary", "not_sent")
            inv["kot_stations"] = kot.get("kot_stations", [])
            inv["kot_modified"] = kot.get("kot_modified", False)
            inv["kot_delayed"] = kot.get("kot_delayed", False)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "POS Orders KOT enrich failed")
        for inv in invoices:
            inv.setdefault("kot_summary", "not_sent")
            inv.setdefault("kot_stations", [])
            inv.setdefault("kot_modified", False)
            inv.setdefault("kot_delayed", False)
    return invoices


def invoice_matches_kot_filter(invoice: dict, kot_filter: str | None) -> bool:
    if not kot_filter or kot_filter == "all":
        return True
    summary = invoice.get("kot_summary") or "not_sent"
    if kot_filter == "delayed":
        return bool(invoice.get("kot_delayed"))
    if kot_filter == "in_kitchen":
        return summary in IN_KITCHEN_SUMMARIES
    if kot_filter == "not_sent":
        return summary == "not_sent"
    return True


def kot_rush_sort_key(invoice: dict) -> tuple:
    summary = invoice.get("kot_summary") or "not_sent"
    if invoice.get("kot_delayed"):
        bucket = KOT_RUSH_PRIORITY["delayed"]
    else:
        bucket = KOT_RUSH_PRIORITY.get(summary, 9)
    return (bucket, invoice.get("posting_date") or "", invoice.get("posting_time") or "")


def tally_kot_filter_counts(invoices: list[dict]) -> dict:
    counts = {"in_kitchen": 0, "delayed": 0, "not_sent": 0}
    for invoice in invoices:
        if invoice_matches_kot_filter(invoice, "in_kitchen"):
            counts["in_kitchen"] += 1
        if invoice_matches_kot_filter(invoice, "delayed"):
            counts["delayed"] += 1
        if invoice_matches_kot_filter(invoice, "not_sent"):
            counts["not_sent"] += 1
    return counts


def _draft_status_sql(branch: str, status: str) -> tuple[str, tuple]:
    if status == "Draft":
        return (
            """
            SELECT {fields}
            FROM `tabPOS Invoice`
            WHERE branch = %s AND status = 'Draft'
            AND (invoice_printed = 1 OR (invoice_printed = 0 AND COALESCE(restaurant_table, '') = ''))
            ORDER BY modified desc
            """,
            (branch,),
        )
    if status == "Unbilled":
        return (
            """
            SELECT {fields}
            FROM `tabPOS Invoice`
            WHERE branch = %s AND status = 'Draft'
            AND invoice_printed = 0 AND COALESCE(restaurant_table, '') != ''
            ORDER BY modified desc
            """,
            (branch,),
        )
    return ("", ())


def fetch_kitchen_tab_invoices(branch: str, status: str) -> list[dict]:
    sql_template, params = _draft_status_sql(branch, status)
    if not sql_template:
        return []
    sql = sql_template.format(fields=POS_INVOICE_LIST_FIELDS)
    return frappe.db.sql(
        f"{sql} LIMIT %s",
        params + (MAX_KOT_FILTER_SCAN,),
        as_dict=True,
    )


def get_kot_filter_counts_for_status(branch: str, status: str, kot_warning_time: int = 0) -> dict:
    if status not in ("Draft", "Unbilled"):
        return {"in_kitchen": 0, "delayed": 0, "not_sent": 0}
    invoices = fetch_kitchen_tab_invoices(branch, status)
    enrich_invoices_with_kot(invoices, kot_warning_time)
    return tally_kot_filter_counts(invoices)


def paginate_kot_filtered_invoices(
    branch: str,
    status: str,
    limit: int,
    limit_start: int,
    kot_filter: str | None,
    kot_warning_time: int = 0,
) -> tuple[list[dict], bool]:
    invoices = fetch_kitchen_tab_invoices(branch, status)
    enrich_invoices_with_kot(invoices, kot_warning_time)
    if kot_filter and kot_filter != "all":
        invoices = [inv for inv in invoices if invoice_matches_kot_filter(inv, kot_filter)]
    invoices.sort(key=kot_rush_sort_key)
    page = invoices[limit_start : limit_start + limit + 1]
    has_next = len(page) > limit
    if has_next:
        page = page[:limit]
    return page, has_next


def _count_pos_invoices(branch: str, status: str, paid_limit: int = 0) -> int:
    if status == "Draft":
        return frappe.db.sql(
            """
            SELECT COUNT(*) FROM `tabPOS Invoice`
            WHERE branch = %s AND status = 'Draft'
            AND (invoice_printed = 1 OR (invoice_printed = 0 AND COALESCE(restaurant_table, '') = ''))
            """,
            (branch,),
        )[0][0]
    if status == "Unbilled":
        return frappe.db.sql(
            """
            SELECT COUNT(*) FROM `tabPOS Invoice`
            WHERE branch = %s AND status = 'Draft'
            AND invoice_printed = 0 AND COALESCE(restaurant_table, '') != ''
            """,
            (branch,),
        )[0][0]
    if status == "Recently Paid":
        total = frappe.db.count("POS Invoice", {"branch": branch, "status": "Paid"})
        if paid_limit and paid_limit > 0:
            return min(total, paid_limit)
        return total
    return frappe.db.count("POS Invoice", {"branch": branch, "status": status})
