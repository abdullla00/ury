"""POS payment helpers — coupon validation and total preview."""

from __future__ import annotations

import json

import frappe
from frappe import _
from frappe.utils import flt


def resolve_coupon_name(coupon_code: str) -> str:
    code = (coupon_code or "").strip()
    if not code:
        frappe.throw(_("Enter a coupon or voucher code"))
    name = frappe.db.get_value("Coupon Code", {"coupon_code": code.upper()}, "name")
    if not name:
        name = frappe.db.get_value("Coupon Code", code, "name")
    if not name:
        frappe.throw(_("Invalid coupon or voucher code"))
    return name


@frappe.whitelist()
def validate_pos_coupon(coupon_code, invoice=None):
    from erpnext.accounts.doctype.pricing_rule.utils import validate_coupon_code

    coupon_name = resolve_coupon_name(coupon_code)
    validate_coupon_code(coupon_name)
    coupon = frappe.get_doc("Coupon Code", coupon_name)
    return {
        "coupon_name": coupon.name,
        "coupon_code": coupon.coupon_code or coupon_code,
        "label": coupon.coupon_name or coupon.coupon_code,
        "coupon_type": coupon.coupon_type,
    }


@frappe.whitelist()
def preview_payment_totals(
    invoice,
    additional_discount_percentage=0,
    additional_discount_amount=0,
    coupon_code=None,
    tip_amount=0,
):
    doc = frappe.get_doc("POS Invoice", invoice)
    doc.additional_discount_percentage = flt(additional_discount_percentage)
    doc.discount_amount = flt(additional_discount_amount)
    doc.coupon_code = None

    if coupon_code:
        from erpnext.accounts.doctype.pricing_rule.utils import validate_coupon_code

        coupon_name = resolve_coupon_name(coupon_code)
        validate_coupon_code(coupon_name)
        doc.coupon_code = coupon_name

    doc.calculate_taxes_and_totals()

    base_total = flt(doc.grand_total)
    tip = flt(tip_amount)
    rounding = flt(doc.rounding_adjustment or 0)
    discount_amount = flt(doc.discount_amount or 0)
    additional_pct = flt(doc.additional_discount_percentage or 0)

    return {
        "subtotal": flt(doc.net_total) + discount_amount,
        "net_total": flt(doc.net_total),
        "discount_amount": discount_amount,
        "additional_discount_percentage": additional_pct,
        "coupon_code": doc.coupon_code,
        "rounding_adjustment": rounding,
        "grand_total": base_total,
        "rounded_total": flt(doc.rounded_total or base_total),
        "tip_amount": tip,
        "total_with_tip": flt(doc.rounded_total or base_total) + tip,
        "total_taxes": flt(doc.total_taxes_and_charges or 0),
    }


def apply_payment_adjustments(
    invoice_doc,
    additional_discount_percentage=0,
    additional_discount_amount=0,
    coupon_code=None,
):
    invoice_doc.additional_discount_percentage = flt(additional_discount_percentage or 0)
    invoice_doc.discount_amount = flt(additional_discount_amount or 0)
    invoice_doc.coupon_code = None
    if coupon_code:
        from erpnext.accounts.doctype.pricing_rule.utils import validate_coupon_code

        coupon_name = resolve_coupon_name(coupon_code)
        validate_coupon_code(coupon_name)
        invoice_doc.coupon_code = coupon_name
