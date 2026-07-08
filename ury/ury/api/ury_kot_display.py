import json

import frappe
from frappe.utils import get_datetime, now_datetime

from ury.ury_pos.api import getBranch
from ury.ury.doctype.ury_kot.ury_kot import publish_kot_realtime_for_name


def get_table_label(kotdoc):
    if not kotdoc.restaurant_table or kotdoc.table_takeaway:
        return "Takeaway"
    return kotdoc.restaurant_table


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


def enrich_kot(kotdoc, kot_alert_time):
    kotjson = json.loads(frappe.as_json(kotdoc))
    kotjson["table_label"] = get_table_label(kotdoc)
    kotjson["tableortakeaway"] = kotjson["table_label"]
    kotjson["allergy_note"] = kotdoc.get("allergy_note") or ""

    if kotdoc.invoice:
        inv = frappe.db.get_value(
            "POS Invoice",
            kotdoc.invoice,
            ["no_of_pax", "order_type"],
            as_dict=True,
        )
        if inv:
            kotjson["no_of_pax"] = inv.get("no_of_pax")
            kotjson["order_type"] = inv.get("order_type")

    elapsed = compute_elapsed_minutes(kotdoc.time)
    kotjson["elapsed_minutes"] = elapsed
    alert = int(kot_alert_time or 0)
    kotjson["is_delayed"] = bool(alert and elapsed >= alert)

    for kotitem in kotjson.get("kot_items", []):
        qty = kotitem.get("quantity")
        cancelled_qty = kotitem.get("cancelled_qty") or 0
        try:
            qty_num = float(qty) if qty is not None else 0
            cancel_num = float(cancelled_qty) if cancelled_qty else 0
        except (TypeError, ValueError):
            qty_num = 0
            cancel_num = 0
        if kotdoc.type in ("Partially cancelled", "Cancelled"):
            kotitem["qty"] = max(0, qty_num - cancel_num)
        else:
            kotitem["qty"] = qty

    return kotjson


def _production_order_type_filter(kotdoc, production_filters):
    if not kotdoc.production:
        return True
    if kotdoc.production not in production_filters:
        prod_doc = frappe.get_doc("URY Production Unit", kotdoc.production)
        if prod_doc.enable_order_type_wise_display_on_mosaic:
            production_filters[kotdoc.production] = [
                row.order_type for row in prod_doc.get("order_type", [])
            ]
        else:
            production_filters[kotdoc.production] = None

    allowed_order_types = production_filters[kotdoc.production]
    if allowed_order_types is not None:
        invoice_order_type = frappe.db.get_value(
            "POS Invoice", kotdoc.invoice, "order_type"
        )
        if invoice_order_type not in allowed_order_types:
            return False
    return True


def _build_kot_list(filters, branch):
    kot_alert_time = frappe.db.get_value(
        "POS Profile", {"branch": branch}, "custom_kot_warning_time"
    )
    daily_order_number = frappe.db.get_value(
        "POS Profile", {"branch": branch}, "custom_reset_order_number_daily"
    )
    audio_alert = frappe.db.get_value(
        "POS Profile", {"branch": branch}, "custom_kot_alert"
    )
    enable_kot_reprint = frappe.db.get_value(
        "POS Profile", {"branch": branch}, "custom_enable_kot_reprint"
    )
    kot_alert_sound = frappe.db.get_value(
        "POS Profile", {"branch": branch}, "custom_kot_alert_sound"
    )

    kot_list = frappe.get_list(
        "URY KOT",
        fields=["name"],
        filters=filters,
        order_by="creation desc",
    )
    production_filters = {}
    kot_rows = []
    for kot in kot_list:
        kotdoc = frappe.get_doc("URY KOT", kot.name)
        if not _production_order_type_filter(kotdoc, production_filters):
            continue
        kot_rows.append(enrich_kot(kotdoc, kot_alert_time))

    return {
        "KOT": kot_rows,
        "Branch": branch,
        "kot_alert_time": kot_alert_time,
        "audio_alert": audio_alert,
        "daily_order_number": daily_order_number,
        "enable_kot_reprint": enable_kot_reprint,
        "kot_alert_sound": kot_alert_sound,
    }


@frappe.whitelist()
def serve_kot(name, time):
    order_status = frappe.db.get_value("URY KOT", name, "order_status")
    if order_status not in ("Ready For Prepare", "Ready"):
        frappe.throw("Ticket is not available to serve")
    current_time = get_datetime()
    creation_time = frappe.db.get_value("URY KOT", name, "creation")
    production_time = current_time - creation_time
    production_time_minutes = production_time.total_seconds() / 60
    frappe.db.set_value("URY KOT", name, "start_time_serv", time)
    frappe.db.set_value("URY KOT", name, "production_time", production_time_minutes)
    frappe.db.set_value("URY KOT", name, "order_status", "Served")
    publish_kot_realtime_for_name(name)


@frappe.whitelist()
def confirm_cancel_kot(name, user):
    frappe.db.set_value("URY KOT", name, "verified", 1)
    frappe.db.set_value("URY KOT", name, "verified_by", user)
    publish_kot_realtime_for_name(name)


@frappe.whitelist()
def recall_kot(name):
    order_status = frappe.db.get_value("URY KOT", name, "order_status")
    if order_status != "Served":
        frappe.throw("Only served KOTs can be recalled")
    frappe.db.set_value("URY KOT", name, "order_status", "Ready For Prepare")
    frappe.db.set_value("URY KOT", name, "start_time_serv", None)
    frappe.db.set_value("URY KOT", name, "production_time", None)
    publish_kot_realtime_for_name(name)
    return {"ok": True}


@frappe.whitelist()
def get_production_units():
    branch = getBranch()
    units = frappe.get_all(
        "URY Production Unit",
        filters={"branch": branch},
        fields=["name", "production"],
        order_by="production asc",
    )
    return {"units": units, "branch": branch}


@frappe.whitelist(allow_guest=True)
def get_site_name():
    return {"site_name": frappe.local.site}


@frappe.whitelist()
def kot_list():
    today = frappe.utils.now()
    branch = getBranch()
    three_hours_ago = frappe.utils.add_to_date(today, hours=-3)
    filters = {
        "order_status": "Ready For Prepare",
        "branch": branch,
        "type": [
            "in",
            [
                "New Order",
                "Order Modified",
                "Duplicate",
                "Cancelled",
                "Partially cancelled",
            ],
        ],
        "docstatus": 1,
        "verified": 0,
        "creation": (">=", three_hours_ago),
    }
    return _build_kot_list(filters, branch)


@frappe.whitelist()
def served_kot_list():
    today = frappe.utils.now()
    branch = getBranch()
    three_hours_ago = frappe.utils.add_to_date(today, hours=-3)
    filters = {
        "order_status": "Served",
        "branch": branch,
        "type": [
            "in",
            [
                "New Order",
                "Order Modified",
                "Duplicate",
                "Cancelled",
                "Partially cancelled",
            ],
        ],
        "docstatus": 1,
        "verified": 0,
        "creation": (">=", three_hours_ago),
    }
    return _build_kot_list(filters, branch)


@frappe.whitelist()
def ready_kot_list():
    today = frappe.utils.now()
    branch = getBranch()
    three_hours_ago = frappe.utils.add_to_date(today, hours=-3)
    filters = {
        "order_status": "Ready",
        "branch": branch,
        "type": [
            "in",
            [
                "New Order",
                "Order Modified",
                "Duplicate",
                "Cancelled",
                "Partially cancelled",
            ],
        ],
        "docstatus": 1,
        "verified": 0,
        "creation": (">=", three_hours_ago),
    }
    return _build_kot_list(filters, branch)


@frappe.whitelist()
def mark_kot_ready(name):
    order_status = frappe.db.get_value("URY KOT", name, "order_status")
    if order_status != "Ready For Prepare":
        frappe.throw("Only active tickets can be marked ready")
    frappe.db.set_value("URY KOT", name, "order_status", "Ready")
    publish_kot_realtime_for_name(name)
    return {"ok": True}


@frappe.whitelist()
def mark_kot_item_ready(name, item_name, ready=1):
    kot = frappe.get_doc("URY KOT", name)
    updated = False
    for row in kot.kot_items:
        if row.name == item_name:
            frappe.db.set_value("URY KOT Items", row.name, "marked_ready", int(ready))
            updated = True
            break
    if not updated:
        frappe.throw("Item not found on ticket")
    publish_kot_realtime_for_name(name)
    return {"ok": True}
