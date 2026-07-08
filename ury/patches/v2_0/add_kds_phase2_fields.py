import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
    create_custom_fields(
        {
            "POS Invoice": [
                {
                    "fieldname": "custom_allergy_note",
                    "label": "Allergy Note",
                    "fieldtype": "Small Text",
                    "insert_after": "custom_comments",
                }
            ]
        }
    )
