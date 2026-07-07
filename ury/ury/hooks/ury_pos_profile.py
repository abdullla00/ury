import frappe
from frappe import _, msgprint


def validate(doc, method):
    validate_bill_check(doc, method)
    validate_cost_center(doc, method)


def validate_bill_check(doc, method):
    for row in doc.printer_settings:
        if not row.bill or not row.printer:
            msgprint(
                _(
                    "Either Bill is not enabled / Printer is not selected in Printer Settings."
                )
            )
            
def validate_cost_center(doc, method):
    if not doc.cost_center and doc.company:
        cost_centers = frappe.get_all(
            "Cost Center",
            filters={"company": doc.company, "is_group": 0},
            pluck="name",
        )
        if len(cost_centers) == 1:
            doc.cost_center = cost_centers[0]
        else:
            default_cost_center = frappe.db.get_value(
                "Company", doc.company, "default_cost_center"
            )
            if default_cost_center:
                doc.cost_center = default_cost_center

    if not doc.cost_center:
        frappe.throw(
            _(
                "Cost Center is mandatory. Set it under the Accounting tab → Accounting Dimensions → Cost Center."
            )
        )
