import frappe
import hashlib
import hmac
from frappe import _
from datetime import date, datetime, timedelta
from frappe.utils import validate_phone_number, cint

from ury.ury.api.ury_orders_kot import (
    POS_INVOICE_LIST_FIELDS,
    _count_pos_invoices,
    enrich_invoices_with_kot,
    get_kot_filter_counts_for_status,
    invoice_matches_kot_filter,
    kot_rush_sort_key,
    paginate_kot_filtered_invoices,
)


#GetTable  decripted temporarily
# @frappe.whitelist()
# def getTable(room):
#     branch_name = getBranch()   
#     tables = frappe.get_all(
#         "URY Table",
#         fields=["name", "occupied", "latest_invoice_time", "is_take_away", "restaurant_room","table_shape","no_of_seats","layout_x","layout_y"],
#         filters={"branch": branch_name,"restaurant_room":room,}
#     )    
#     return tables

@frappe.whitelist()
def getRestaurantMenu(pos_profile, room=None, order_type=None):
    menu_items = []
    menu_items_with_image = []

    user_role = frappe.get_roles()

    pos_profile = frappe.get_doc("POS Profile", pos_profile)

    from ury.ury.api.pos_cashiers import user_can_bill_on_pos_profile

    cashier = user_can_bill_on_pos_profile(pos_profile)
    branch_name = getBranch()
    restaurant = frappe.db.get_value("URY Restaurant", {"branch": branch_name}, "name")
    
    if room:
    
        room_wise_menu = frappe.db.get_value(
            "URY Restaurant", restaurant, "room_wise_menu"
        )
        
        if room_wise_menu:
            menu = frappe.db.get_value(
                "Menu for Room",
                {"parent": restaurant, "room": room},
                "menu"
            )
            if not menu:
                 menu = frappe.db.get_value("URY Restaurant", restaurant, "active_menu")
        else:
            menu = frappe.db.get_value("URY Restaurant", restaurant, "active_menu")

    elif cashier and order_type:
        order_type_wise_menu = frappe.db.get_value(
            "URY Restaurant", restaurant, "order_type_wise_menu"
        )
    
        if order_type_wise_menu:
            menu = frappe.db.get_value(
                "Order Type Menu",
                {"parent": restaurant, "order_type": order_type},
                "menu"
            )
            if not menu:
                 menu = frappe.db.get_value("URY Restaurant", restaurant, "active_menu")
    
        else:
            menu = frappe.db.get_value("URY Restaurant", restaurant, "active_menu")

    # Default menu if nothing is selected
    else:
        menu = frappe.db.get_value("URY Restaurant", restaurant, "active_menu")
    
    if not menu:
        frappe.throw(_("Please set an active menu for Restaurant {0}").format(restaurant))
    
    
    # Get menu items (your existing code)
    menu_items = frappe.get_all(
        "URY Menu Item",
        filters={"parent": menu, "disabled": 0},
        fields=["item", "item_name", "rate", "special_dish", "disabled", "course"],
        order_by="item_name asc"
    )
    
    menu_items_with_image = []
    for item in menu_items:
        row = {
            "item": item.item,
            "item_name": _(item.item_name) if item.item_name else item.item_name,
            "rate": item.rate,
            "special_dish": item.special_dish,
            "disabled": item.disabled,
            "item_image": frappe.db.get_value("Item", item.item, "image"),
            "course": item.course,
            "course_label": _(item.course) if item.course else item.course,
        }
        meta = _item_modifier_meta(item.item)
        row["has_modifiers"] = meta.get("has_modifiers", False)
        menu_items_with_image.append(row)
    modified = frappe.db.get_value("URY Menu", menu, "modified")
    
    
    return {
        "items": menu_items_with_image,
        "modified_time": modified,
        "name": menu
    }

@frappe.whitelist()
def getMenuCourses():
    courses = frappe.get_all("URY Menu Course", fields=["name"])
    return [{"name": d.name, "label": _(d.name)} for d in courses]

@frappe.whitelist()
def getBranch():
    user = frappe.session.user
    sql_query = """
        SELECT b.branch
        FROM `tabURY User` AS a
        INNER JOIN `tabBranch` AS b ON a.parent = b.name
        WHERE a.user = %s
    """
    branch_array = frappe.db.sql(sql_query, user, as_dict=True)
    if not branch_array:
        frappe.throw("User is not Associated with any Branch.Please refresh Page")

    branch_name = branch_array[0].get("branch")

    return branch_name

def refresh_outdated_pos_opening_entries(branch):
    """Roll POS opening period to today when yesterday's shift was left open."""
    today = frappe.utils.today()
    now = frappe.utils.now_datetime()
    openings = frappe.get_all(
        "POS Opening Entry",
        fields=["name", "period_start_date"],
        filters={"branch": branch, "status": "Open", "docstatus": 1},
    )
    updated = []
    for opening in openings:
        period_start = opening.get("period_start_date")
        period_date = frappe.utils.get_date_str(period_start) if period_start else None
        posting_date = frappe.db.get_value("POS Opening Entry", opening.name, "posting_date")
        posting_date = frappe.utils.get_date_str(posting_date) if posting_date else None
        if period_date == today and posting_date == today:
            continue
        frappe.db.sql(
            """
            UPDATE `tabPOS Opening Entry`
            SET period_start_date = %s, posting_date = %s, modified = %s
            WHERE name = %s
            """,
            (now, today, now, opening.name),
        )
        updated.append(opening.name)

    if updated:
        frappe.db.commit()
    return updated

@frappe.whitelist()
def refresh_pos_opening_for_today():
    branch = getBranch()
    updated = refresh_outdated_pos_opening_entries(branch)
    return {"updated": updated, "status": "ok" if updated else "current"}

@frappe.whitelist()
def getBranchRoom():
    user = frappe.session.user
    sql_query = """
        SELECT b.branch , a.room
        FROM `tabURY User` AS a
        INNER JOIN `tabBranch` AS b ON a.parent = b.name
        WHERE a.user = %s
    """
    branch_array = frappe.db.sql(sql_query, user, as_dict=True)
    
    branch_name = branch_array[0].get("branch")
    room_name = branch_array[0].get("room")

    if not branch_name:
        frappe.throw("Branch information is missing for the user. Please contact your administrator.")

    if not room_name:
        frappe.throw("No room assigned to this user. Please contact your administrator.")

    return [{
        "name":room_name ,
        "branch": branch_name,
    }]

@frappe.whitelist()
def getRoom():
    user = frappe.session.user
    sql_query = """
        SELECT b.branch, a.room
        FROM `tabURY User` AS a
        INNER JOIN `tabBranch` AS b ON a.parent = b.name
        WHERE a.user = %s
    """
    branch_array = frappe.db.sql(sql_query, user, as_dict=True)
    
    if not branch_array:
        frappe.throw("No branch or room information found for the user. Please contact your administrator.")
    
    room_details = [
        {
            "name": row.get("room"),
            "branch": row.get("branch")
        } 
        for row in branch_array
    ]

    return room_details

@frappe.whitelist()
def getModeOfPayment():
    posDetails = getPosProfile()
    posProfile = posDetails["pos_profile"]
    posProfiles = frappe.get_doc("POS Profile", posProfile)
    mode_of_payments = posProfiles.payments
    modeOfPayments = []
    for mop in mode_of_payments:
        modeOfPayments.append(
            {"mode_of_payment": mop.mode_of_payment, "opening_amount": float(0)}
        )
    return modeOfPayments

@frappe.whitelist()
def getInvoiceForCashier(status, cashier, limit, limit_start):
    branch = getBranch()
    updatedlist = []
    limit = int(limit)+1
    limit_start = int(limit_start)
    if status == "Draft":
        invoices = frappe.db.sql(
            """
            SELECT 
                name, invoice_printed, grand_total, restaurant_table, 
                cashier, waiter, net_total, posting_time, 
                total_taxes_and_charges, customer, status, mobile_number, 
                posting_date, rounded_total, order_type 
            FROM `tabPOS Invoice` 
            WHERE branch = %s AND status = %s AND cashier = %s
            AND (invoice_printed = 1 OR (invoice_printed = 0 AND COALESCE(restaurant_table, '') = ''))
            ORDER BY modified desc
            LIMIT %s OFFSET %s
            """,
            (branch, status, cashier, limit,limit_start),
            as_dict=True,
        )
        updatedlist.extend(invoices)
    elif status == "Unbilled":
        
        docstatus = "Draft"
        invoices = frappe.db.sql(
            """
            SELECT 
                name, invoice_printed, grand_total, restaurant_table, 
                cashier, waiter, net_total, posting_time, 
                total_taxes_and_charges, customer, status, mobile_number, 
                posting_date, rounded_total, order_type 
            FROM `tabPOS Invoice` 
            WHERE branch = %s AND status = %s AND cashier = %s
            AND (invoice_printed = 0 AND COALESCE(restaurant_table, '') != '')
            ORDER BY modified desc
            LIMIT %s OFFSET %s
            """,
            (branch, docstatus, cashier, limit, limit_start),
            as_dict=True,
        )
        updatedlist.extend(invoices)
    elif status == "Recently Paid":
        docstatus = "Paid"
        invoices = frappe.db.sql(
            """
            SELECT 
                name, invoice_printed, grand_total, restaurant_table, 
                cashier, waiter, net_total, posting_time, 
                total_taxes_and_charges, customer, status, mobile_number,
                posting_date, rounded_total, order_type,additional_discount_percentage,discount_amount 
            FROM `tabPOS Invoice` 
            WHERE branch = %s AND status = %s AND cashier = %s
            ORDER BY modified desc
            LIMIT %s OFFSET %s
            """,
            (branch, docstatus, cashier, limit, limit_start),
            as_dict=True,
        )
        updatedlist.extend(invoices)    
    else:
        
        invoices = frappe.db.sql(
            """
            SELECT 
                name, invoice_printed, grand_total, restaurant_table, 
                cashier, waiter, net_total, posting_time, 
                total_taxes_and_charges, customer, status, mobile_number,
                posting_date, rounded_total, order_type,additional_discount_percentage,discount_amount
            FROM `tabPOS Invoice` 
            WHERE branch = %s AND status = %s AND cashier = %s
            ORDER BY modified desc
            LIMIT %s OFFSET %s
            """,
            (branch, status, cashier, limit, limit_start),
            as_dict=True,
        )

        updatedlist.extend(invoices)
    if len(updatedlist) == limit and status != "Recently Paid":
            next = True
            updatedlist.pop()
    else:
            next = False   
    return  { "data":updatedlist,"next":next}



def _get_kot_warning_time():
    branch = getBranch()
    pos_profile = get_pos_profile_for_branch(branch)
    if not pos_profile:
        return 0
    return cint(
        frappe.db.get_value("POS Profile", pos_profile, "custom_kot_warning_time") or 0
    )


@frappe.whitelist()
def getPosInvoice(status, limit, limit_start, kot_filter=None):
    branch = getBranch()
    limit = int(limit) + 1
    limit_start = int(limit_start)
    kot_filter = (kot_filter or "all").strip() or "all"
    warning = _get_kot_warning_time()

    if status in ("Draft", "Unbilled"):
        page, has_next = paginate_kot_filtered_invoices(
            branch, status, limit, limit_start, kot_filter, warning
        )
        return {"data": page, "next": has_next}

    updatedlist = []
    if status == "Recently Paid":
        docstatus = "Paid"
        invoices = frappe.db.sql(
            f"""
            SELECT {POS_INVOICE_LIST_FIELDS}
            FROM `tabPOS Invoice`
            WHERE branch = %s AND status = %s
            ORDER BY modified desc
            LIMIT %s OFFSET %s
            """,
            (branch, docstatus, limit, limit_start),
            as_dict=True,
        )
        updatedlist.extend(invoices)
    else:
        invoices = frappe.db.sql(
            f"""
            SELECT {POS_INVOICE_LIST_FIELDS}
            FROM `tabPOS Invoice`
            WHERE branch = %s AND status = %s
            ORDER BY modified desc
            LIMIT %s OFFSET %s
            """,
            (branch, status, limit, limit_start),
            as_dict=True,
        )
        updatedlist.extend(invoices)
    if len(updatedlist) == limit and status != "Recently Paid":
        next = True
        updatedlist.pop()
    else:
        next = False
    enrich_invoices_with_kot(updatedlist, _get_kot_warning_time())
    return {"data": updatedlist, "next": next}


@frappe.whitelist()
def searchPosInvoice(query, status, kot_filter=None):
    if not query:
        return {"data": [], "next": False}

    branch = getBranch()
    query_like = f"%{query.strip()}%"
    kot_filter = (kot_filter or "all").strip() or "all"
    warning = _get_kot_warning_time()

    if status == "Draft":
        status_filter = (
            "status = 'Draft' AND (invoice_printed = 1 "
            "OR (invoice_printed = 0 AND COALESCE(restaurant_table, '') = ''))"
        )
    elif status == "Unbilled":
        status_filter = (
            "status = 'Draft' AND invoice_printed = 0 "
            "AND COALESCE(restaurant_table, '') != ''"
        )
    elif status == "Recently Paid":
        status_filter = "status = 'Paid'"
    else:
        status_filter = "status = %s"

    params = [branch, query_like, query_like, query_like]
    if status not in ("Draft", "Unbilled", "Recently Paid"):
        params.append(status)

    pos_invoices = frappe.db.sql(
        f"""
        SELECT {POS_INVOICE_LIST_FIELDS}
        FROM `tabPOS Invoice`
        WHERE branch = %s
            AND (name LIKE %s OR customer LIKE %s OR mobile_number LIKE %s)
            AND {status_filter}
        ORDER BY modified desc
        LIMIT 10
        """,
        tuple(params),
        as_dict=True,
    )
    enrich_invoices_with_kot(pos_invoices, warning)
    if kot_filter != "all":
        pos_invoices = [inv for inv in pos_invoices if invoice_matches_kot_filter(inv, kot_filter)]
    if status in ("Draft", "Unbilled"):
        pos_invoices.sort(key=kot_rush_sort_key)
    return {"data": pos_invoices, "next": len(pos_invoices) == 10}
    

@frappe.whitelist()
def get_select_field_options():
    options = frappe.get_meta("POS Invoice").get_field("order_type").options
    if options:
        return [{"name": option} for option in options.split("\n")]
    else:
        return []


@frappe.whitelist()
def fav_items(customer):
    pos_invoices = frappe.get_all(
        "POS Invoice", filters={"customer": customer}, fields=["name"]
    )
    item_qty = {}

    for invoice in pos_invoices:
        pos_invoice = frappe.get_doc("POS Invoice", invoice.name)
        for item in pos_invoice.items:
            item_name = item.item_name
            qty = item.qty
            if item_name not in item_qty:
                item_qty[item_name] = 0
            item_qty[item_name] += qty

    favorite_items = [
        {"item_name": item_name, "qty": qty} for item_name, qty in item_qty.items()
    ]
    return favorite_items

@frappe.whitelist()
def getCashier(room):
    branch = getBranch()
    cashier = None
    pos_opening_list = frappe.db.sql("""
        SELECT DISTINCT `tabPOS Opening Entry`.name 
        FROM `tabPOS Opening Entry`
        INNER JOIN `tabMultiple Rooms` 
        ON `tabMultiple Rooms`.parent = `tabPOS Opening Entry`.name
        WHERE `tabPOS Opening Entry`.branch = %s
        AND `tabPOS Opening Entry`.status = 'Open'
        AND `tabPOS Opening Entry`.docstatus = 1
        AND `tabMultiple Rooms`.room = %s
    """, (branch, room), as_dict=True)
    if pos_opening_list:
        cashier = frappe.db.get_value(
            "POS Opening Entry",
            {"name": pos_opening_list[0].name},
            "user",)
    return cashier       
    

def get_pos_profile_for_branch(branch):
    """Resolve the POS Profile for a branch, preferring open shift and enabled profiles."""
    user = frappe.session.user
    open_filters = {"branch": branch, "status": "Open", "docstatus": 1}

    for filters in ({**open_filters, "user": user}, open_filters):
        open_profile = frappe.db.get_value(
            "POS Opening Entry",
            filters,
            "pos_profile",
            order_by="period_start_date desc",
        )
        if open_profile and not frappe.db.get_value("POS Profile", open_profile, "disabled"):
            return open_profile

    enabled_profiles = frappe.get_all(
        "POS Profile",
        filters={"branch": branch, "disabled": 0},
        fields=["name"],
        order_by="modified desc",
    )
    if enabled_profiles:
        for profile in enabled_profiles:
            if frappe.db.exists(
                "POS Profile User", {"parent": profile.name, "user": user, "parenttype": "POS Profile"}
            ):
                return profile.name
        return enabled_profiles[0].name

    return None


def get_profile_cashier_and_owner(pos_profile_doc):
    user = frappe.session.user
    owner = None
    cashier = None

    for user_details in pos_profile_doc.applicable_for_users:
        if user_details.custom_main_cashier:
            owner = user_details.user
        if user_details.user == user:
            cashier = user_details.user

    if not cashier and pos_profile_doc.applicable_for_users:
        cashier = pos_profile_doc.applicable_for_users[0].user
    if not owner:
        owner = cashier or user
    if not cashier:
        cashier = user

    return cashier, owner


@frappe.whitelist()
def getPosProfile():
    branchName = getBranch()
    waiter = frappe.session.user
    bill_present = False
    qz_host = None
    printer = None
    cashier = None
    owner = None
    posProfile = get_pos_profile_for_branch(branchName)
    if not posProfile:
        frappe.throw(_("No POS Profile found for branch {0}").format(branchName))
    pos_profiles = frappe.get_doc("POS Profile", posProfile)
    global_defaults = frappe.get_single('Global Defaults')
    disable_rounded_total = global_defaults.disable_rounded_total
    

    if pos_profiles.branch == branchName:
        pos_profile_name = pos_profiles.name
        warehouse = pos_profiles.warehouse
        branch = pos_profiles.branch
        company = pos_profiles.company
        tableAttention = pos_profiles.table_attention_time
        get_cashier = frappe.get_doc("POS Profile", pos_profile_name)
        print_format = pos_profiles.print_format
        paid_limit=pos_profiles.paid_limit
        enable_discount = pos_profiles.custom_enable_discount
        multiple_cashier = pos_profiles.custom_enable_multiple_cashier
        edit_order_type = pos_profiles.custom_edit_order_type
        enable_kot_reprint = pos_profiles.custom_enable_kot_reprint
        allow_partial_payment = cint(getattr(pos_profiles, "allow_partial_payment", 0) or 0)
        enable_tips = cint(
            frappe.db.get_value("POS Profile", pos_profile_name, "custom_enable_tips") or 1
        )
        tip_item = frappe.db.get_value("POS Profile", pos_profile_name, "custom_tip_item")
        kot_warning_time = cint(getattr(pos_profiles, "custom_kot_warning_time", 0) or 0)
        default_pos_screen = (
            frappe.db.get_value("POS Profile", pos_profile_name, "custom_default_pos_screen")
            or "Register"
        )
        transfer_roles = [
            row.role for row in (pos_profiles.transfer_role_permissions or []) if row.role
        ]
        kds_production_unit = frappe.db.get_value(
            "URY Production Unit",
            {"branch": branch},
            "name",
        )
        if multiple_cashier:
            details = getBranchRoom()
            room = details[0].get('name') 
            branch = details[0].get('branch')

            pos_opening_list = frappe.db.sql("""
                SELECT DISTINCT `tabPOS Opening Entry`.name 
                FROM `tabPOS Opening Entry`
                INNER JOIN `tabMultiple Rooms` 
                ON `tabMultiple Rooms`.parent = `tabPOS Opening Entry`.name
                WHERE `tabPOS Opening Entry`.branch = %s
                AND `tabPOS Opening Entry`.status = 'Open'
                AND `tabPOS Opening Entry`.docstatus = 1
                AND `tabMultiple Rooms`.room = %s
            """, (branch, room), as_dict=True)
            if pos_opening_list:
                pos_opened_cashier = frappe.db.get_value(
                    "POS Opening Entry",
                    {"name": pos_opening_list[0].name},
                    "user",)
            else:
                pos_opened_cashier = None
            for user_details in get_cashier.applicable_for_users:
                if user_details.custom_main_cashier:
                    owner = user_details.user
                
                if frappe.session.user == owner:
                    cashier = owner
                else:
                    cashier = pos_opened_cashier    
                
        else:    
            cashier, owner = get_profile_cashier_and_owner(get_cashier)
        
        qz_print = pos_profiles.qz_print
        print_type = None

        for pos_profile in pos_profiles.printer_settings:
            if pos_profile.bill == 1:
                printer = pos_profile.printer
                bill_present = True
                break

        if qz_print == 1:
            print_type = "qz"
            qz_host = pos_profiles.qz_host

        elif bill_present == True:
            print_type = "network"

        else:
            print_type = "socket"

    invoice_details = {
        "pos_profile": pos_profile_name,
        "branch": branch,
        "company": company,
        "waiter": waiter,
        "warehouse": warehouse,
        "cashier": cashier,
        "print_format": print_format,
        "qz_print": qz_print,
        "qz_host": qz_host,
        "printer": printer,
        "print_type": print_type,
        "tableAttention": tableAttention,
        "paid_limit":paid_limit,
        "disable_rounded_total":disable_rounded_total,
        "enable_discount":enable_discount,
        "multiple_cashier":multiple_cashier,
        "owner":owner,
        "edit_order_type":edit_order_type,
        "enable_kot_reprint":enable_kot_reprint,
        "allow_partial_payment": allow_partial_payment,
        "enable_tips": enable_tips,
        "tip_item": tip_item,
        "kds_production_unit": kds_production_unit,
        "kot_warning_time": kot_warning_time,
        "default_pos_screen": default_pos_screen,
        "transfer_roles": transfer_roles,
        "view_all_status": cint(getattr(pos_profiles, "view_all_status", 0) or 0),
        "orders_kot_opens_kds": cint(
            getattr(pos_profiles, "custom_orders_kot_opens_kds", 1) or 1
        ),
    }

    return invoice_details


@frappe.whitelist()
def get_order_status_counts():
    branch = getBranch()
    pos_profile = get_pos_profile_for_branch(branch)
    view_all = 0
    paid_limit = 0
    if pos_profile:
        doc = frappe.get_cached_doc("POS Profile", pos_profile)
        view_all = cint(getattr(doc, "view_all_status", 0) or 0)
        paid_limit = cint(doc.paid_limit or 0)

    counts = {
        "Draft": _count_pos_invoices(branch, "Draft"),
        "Unbilled": _count_pos_invoices(branch, "Unbilled"),
    }
    if paid_limit > 0 and view_all != 1:
        counts["Recently Paid"] = _count_pos_invoices(branch, "Recently Paid", paid_limit)
    if view_all == 1:
        counts["Paid"] = _count_pos_invoices(branch, "Paid")
        counts["Consolidated"] = _count_pos_invoices(branch, "Consolidated")
        counts["Return"] = _count_pos_invoices(branch, "Return")
    return counts


@frappe.whitelist()
def get_kot_filter_counts(status):
    branch = getBranch()
    if status not in ("Draft", "Unbilled"):
        return {"in_kitchen": 0, "delayed": 0, "not_sent": 0}
    return get_kot_filter_counts_for_status(branch, status, _get_kot_warning_time())


@frappe.whitelist()
def updatePosInvoiceStatus(invoice, status):
    if not invoice:
        frappe.throw(_("Invoice is required"))
    allowed = {"Draft", "Paid", "Consolidated", "Return"}
    if status not in allowed:
        frappe.throw(_("Status {0} is not allowed").format(status))
    doc = frappe.get_doc("POS Invoice", invoice)
    if doc.branch != getBranch():
        frappe.throw(_("Not permitted"))
    if status == "Draft" and doc.restaurant_table and not doc.invoice_printed:
        frappe.throw(_("Unbilled table orders cannot be set to Draft via this API"))
    doc.status = status
    doc.save()
    return {"name": doc.name, "status": doc.status}


@frappe.whitelist()
def getPosInvoiceItems(invoice):
    itemDetails = []
    taxDetails = []
    orderdItems = frappe.get_doc("POS Invoice", invoice)
    posItems = orderdItems.items
    for items in posItems:
        item_name = items.item_name
        qty = items.qty
        amount = items.amount
        itemDetails.append(
            {
                "item_name": item_name,
                "qty": qty,
                "amount": amount,
            }
        )
    taxDetail = orderdItems.taxes
    for tax in taxDetail:
        description = tax.description
        rate = tax.tax_amount
        taxDetails.append(
            {
                "description": description,
                "rate": rate,
            }
        )
    return itemDetails, taxDetails


@frappe.whitelist()
def posOpening():
    branchName = getBranch()
    pos_opening_list = frappe.get_all(
        "POS Opening Entry",
        fields=["name", "docstatus", "status", "period_start_date"],
        filters={"branch": branchName, "status": "Open", "docstatus": 1},
    )
    if not pos_opening_list:
        return 1

    today = frappe.utils.today()
    for pos_opening in pos_opening_list:
        period_start = pos_opening.get("period_start_date")
        if period_start and frappe.utils.get_date_str(period_start) == today:
            return 0

    if refresh_outdated_pos_opening_entries(branchName):
        return 0

    # 2 = open entry exists but is from a previous day (ERPNext blocks new invoices)
    return 2


@frappe.whitelist()
def get_pos_shift_gate():
    from ury.ury.api.ury_pos_shift_gate import build_pos_shift_gate

    return build_pos_shift_gate()


def _check_guest_rate_limit(token, action="guest"):
    cache = frappe.cache()
    key = f"ury_guest_rate:{action}:{token}"
    count = cint(cache.get_value(key) or 0)
    if count >= 20:
        frappe.throw(_("Too many requests. Please wait a moment and try again."))
    cache.set_value(key, count + 1, expires_in_sec=60)


@frappe.whitelist()
def get_pos_shift_info():
    branch_name = getBranch()
    opening_list = frappe.get_all(
        "POS Opening Entry",
        fields=["name", "period_start_date", "status"],
        filters={"branch": branch_name, "status": "Open", "docstatus": 1},
        order_by="period_start_date desc",
        limit=1,
    )
    if not opening_list:
        return {"status": "closed"}
    opening = opening_list[0]
    pos_profile = get_pos_profile_for_branch(branch_name)
    return {
        "status": "open",
        "opening_entry": opening.name,
        "period_start": opening.period_start_date,
        "pos_profile": pos_profile,
    }


@frappe.whitelist()
def get_occupied_table_count():
    branch_name = getBranch()
    return frappe.db.count("URY Table", {"branch": branch_name, "occupied": 1})


@frappe.whitelist()
def getAggregator():
    branchName = getBranch()
    aggregatorList = frappe.get_all(
        "Aggregator Settings",
        fields=["customer"],
        filters={"parent": branchName, "parenttype": "Branch"},
    )
    return aggregatorList


@frappe.whitelist()
def getAggregatorItem(aggregator):
    branchName = getBranch()
    aggregatorItem = []
    aggregatorItemList = []
    priceList = frappe.db.get_value(
        "Aggregator Settings",
        {"customer": aggregator, "parent": branchName, "parenttype": "Branch"},
        "price_list",
    )
    aggregatorItem = frappe.get_all(
        "Item Price",
        fields=["item_code", "item_name", "price_list_rate"],
        filters={"selling": 1, "price_list": priceList},
    )
    aggregatorItemList = [
        {
            "item": item.item_code,
            "item_name": item.item_name,
            "rate": item.price_list_rate,
            "item_image": frappe.db.get_value("Item", item.item_code, "image"),
        }
        for item in aggregatorItem
        if not frappe.db.get_value("Item", item.item_code, "disabled")
    ]
    return aggregatorItemList

@frappe.whitelist()
def getAggregatorMOP(aggregator):
    branchName = getBranch()
    
    modeOfPayment = frappe.db.get_value(
        "Aggregator Settings",
        {"customer": aggregator, "parent": branchName, "parenttype": "Branch"},
        "mode_of_payments",
    )
    modeOfPaymentsList = []
    modeOfPaymentsList.append(
            {"mode_of_payment": modeOfPayment, "opening_amount": float(0)}
    )
    return modeOfPaymentsList
@frappe.whitelist()
def create_customer(customer_name, mobile_number=None, customer_group="Individual", territory="India"):
    if not customer_name:
        frappe.throw("Customer name is required")
    if not mobile_number:
        frappe.throw("Mobile Number is required")
    try:
        validate_phone_number(mobile_number, throw=True)
    except Exception:
        frappe.throw("Invalid mobile number format")

    """Create a new customer"""
    try:
        customer = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": customer_name,
            "mobile_number": mobile_number,
            "customer_group": customer_group,
            "territory": territory
        })
        customer.insert(ignore_permissions=True)
        frappe.db.commit()

        return {
            "status": "success",
            "message": "Customer created successfully",
            "customer_name": customer_name,
            "mobile_number": mobile_number,
            "customer_group": customer_group,
            "territory": territory
        }

    except Exception as e:
        frappe.log_error(message=frappe.get_traceback(), title="Customer Creation Failed")
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist()
def validate_pos_close(pos_profile): 
    enable_unclosed_pos_check = frappe.db.get_value("POS Profile",pos_profile,"custom_daily_pos_close")
    
    if enable_unclosed_pos_check:
        current_datetime = frappe.utils.now_datetime()
        start_of_day = current_datetime.replace(hour=5, minute=0, second=0, microsecond=0)
        
        if current_datetime > start_of_day:
            previous_day = start_of_day - timedelta(days=1)
            
        else:
            previous_day = start_of_day
    
        unclosed_pos_opening = frappe.db.exists(
            "POS Opening Entry",
            {
                "posting_date": previous_day.date(),
                "status": "Open",
                "pos_profile": pos_profile,
                "docstatus": 1
            }
        )
    
        if unclosed_pos_opening:
            return "Failed"
        
        return "Success"
    
    return "Success"


def _item_modifier_meta(item_code):
    try:
        doc = frappe.get_cached_doc("Item", item_code)
    except Exception:
        return {"has_modifiers": False, "variant_items": [], "addon_items": []}

    variant_items = [
        row.item for row in (doc.get("custom_pos_item_variants") or []) if row.item
    ]
    addon_items = [
        row.item for row in (doc.get("custom_pos_add_on_items") or []) if row.item
    ]
    return {
        "has_modifiers": bool(variant_items or addon_items),
        "variant_items": variant_items,
        "addon_items": addon_items,
    }


def _enrich_guest_menu(menu_items):
    enriched = []
    seen = set()
    for item in menu_items or []:
        row = dict(item)
        meta = _item_modifier_meta(item.get("item"))
        row.update(meta)
        enriched.append(row)
        seen.add(item.get("item"))
        for code in meta.get("variant_items", []) + meta.get("addon_items", []):
            if code in seen or not code:
                continue
            rate = frappe.db.get_value("Item Price", {"item_code": code, "selling": 1}, "price_list_rate")
            if rate is None:
                rate = frappe.db.get_value("Item", code, "standard_rate") or 0
            enriched.append(
                {
                    "item": code,
                    "item_name": frappe.db.get_value("Item", code, "item_name") or code,
                    "rate": rate,
                    "item_image": frappe.db.get_value("Item", code, "image"),
                    "has_modifiers": False,
                    "variant_items": [],
                    "addon_items": [],
                }
            )
            seen.add(code)
    return enriched


def _guest_order_secret():
    return frappe.conf.get("ury_guest_order_secret") or frappe.local.site or "ury-guest"


def _sign_table_token(table_name: str) -> str:
    digest = hmac.new(
        _guest_order_secret().encode(),
        table_name.encode(),
        hashlib.sha256,
    ).hexdigest()[:16]
    return f"{table_name}:{digest}"


def _verify_table_token(token: str) -> str:
    if not token or ":" not in token:
        frappe.throw(_("Invalid table order link."))
    table_name, signature = token.rsplit(":", 1)
    expected = _sign_table_token(table_name).rsplit(":", 1)[1]
    if not hmac.compare_digest(signature, expected):
        frappe.throw(_("Invalid or expired table order link."))
    if not frappe.db.exists("URY Table", table_name):
        frappe.throw(_("Table not found."))
    return table_name


@frappe.whitelist()
def get_table_guest_token(table_name):
    if not frappe.db.exists("URY Table", table_name):
        frappe.throw(_("Table not found."))
    return {"token": _sign_table_token(table_name)}


@frappe.whitelist()
def get_room_qr_tokens(room):
    tables = frappe.get_all(
        "URY Table",
        filters={"restaurant_room": room, "is_take_away": 0},
        fields=["name"],
        order_by="name asc",
    )
    base_url = frappe.utils.get_url()
    return [
        {
            "table": t.name,
            "token": _sign_table_token(t.name),
            "url": f"{base_url}/pos/table-order/{_sign_table_token(t.name)}",
        }
        for t in tables
    ]


@frappe.whitelist(allow_guest=True)
def get_guest_table_menu(token):
    _check_guest_rate_limit(token, "menu")
    table_name = _verify_table_token(token)
    table = frappe.get_doc("URY Table", table_name)
    branch = table.branch
    pos_profile = get_pos_profile_for_branch(branch)
    if not pos_profile:
        frappe.throw(_("No POS Profile found for this branch."))
    pos_profile_doc = frappe.get_doc("POS Profile", pos_profile)
    cashier = pos_profile_doc.owner
    for user_row in pos_profile_doc.applicable_for_users:
        if user_row.custom_main_cashier:
            cashier = user_row.user
            break
    previous_user = frappe.session.user
    frappe.set_user(cashier)
    try:
        menu = getRestaurantMenu(pos_profile, table.restaurant_room, "Dine In")
    finally:
        frappe.set_user(previous_user)
    menu_items = menu.get("items") if isinstance(menu, dict) else menu
    return {
        "table": table_name,
        "room": table.restaurant_room,
        "menu": _enrich_guest_menu(menu_items or []),
        "pos_profile": pos_profile,
        "kds_production_unit": frappe.db.get_value(
            "URY Production Unit",
            {"branch": branch},
            "production",
            order_by="creation asc",
        ),
    }


@frappe.whitelist(allow_guest=True)
def guest_sync_order(token, items, comments=None):
    import json

    _check_guest_rate_limit(token, "sync")
    table_name = _verify_table_token(token)
    if isinstance(items, str):
        items = json.loads(items)
    table = frappe.get_doc("URY Table", table_name)
    pos_profile_name = get_pos_profile_for_branch(table.branch)
    pos_profile = frappe.get_doc("POS Profile", pos_profile_name)
    owner = pos_profile.owner
    cashier = owner
    for user_row in pos_profile.applicable_for_users:
        if user_row.custom_main_cashier:
            owner = user_row.user
            cashier = user_row.user
            break

    from ury.ury.doctype.ury_order.ury_order import sync_order, get_order_invoice

    existing = get_order_invoice(table_name, None, "Dine In")
    invoice_id = existing.name if existing and existing.name else None

    guest_items = []
    for row in items:
        guest_items.append(
            {
                "item": row.get("item"),
                "item_name": row.get("item_name"),
                "rate": row.get("rate"),
                "qty": row.get("qty"),
                "comment": row.get("comment") or row.get("guest_label") or "Guest order",
            }
        )

    previous_user = frappe.session.user
    frappe.set_user(cashier)
    try:
        result = sync_order(
            items=guest_items,
            cashier=cashier,
            owner=owner,
            mode_of_payment="Cash",
            customer="Dine in",
            no_of_pax=1,
            last_invoice=invoice_id,
            waiter=cashier,
            pos_profile=pos_profile_name,
            table=table_name,
            invoice=invoice_id,
            comments=comments,
            order_type="Dine In",
            room=table.restaurant_room,
        )
        frappe.db.set_value(
            "URY Table",
            table_name,
            "custom_guest_order_at",
            frappe.utils.now_datetime(),
            update_modified=False,
        )
        return result
    finally:
        frappe.set_user(previous_user)

