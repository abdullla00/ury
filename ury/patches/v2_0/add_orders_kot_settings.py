import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
    create_custom_fields(
        {
            "POS Profile": [
                {
                    "fieldname": "custom_orders_kot_opens_kds",
                    "label": "Tap kitchen status on Orders card opens KDS",
                    "fieldtype": "Check",
                    "default": "1",
                    "insert_after": "custom_enable_kot_reprint",
                }
            ]
        }
    )
