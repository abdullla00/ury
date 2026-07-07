import frappe
from frappe import _


URY_CASHIER_ROLES = {"URY Cashier", "URY Captain", "URY Manager", "System Manager"}


URY_CASHIER_ROLES = {"URY Cashier", "URY Captain", "URY Manager", "System Manager"}


def user_can_bill_on_pos_profile(pos_profile, user=None):
	user = user or frappe.session.user
	if user == "Administrator":
		return True

	user_roles = set(frappe.get_roles(user))
	allowed_roles = {role.role for role in pos_profile.role_allowed_for_billing}

	if allowed_roles:
		return bool(user_roles.intersection(allowed_roles))

	return bool(user_roles.intersection(URY_CASHIER_ROLES))


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_cashiers(doctype, txt, searchfield, start, page_len, filters):
	filters = filters or {}
	pos_profile = filters.get("parent")
	cashiers = set()

	for user in frappe.get_all(
		"POS Profile User", filters=filters, fields=["user"], pluck="user"
	):
		cashiers.add(user)

	if pos_profile:
		branch = frappe.db.get_value("POS Profile", pos_profile, "branch")
		if branch:
			for user in frappe.get_all(
				"URY User",
				filters={"parent": branch, "parenttype": "Branch"},
				fields=["user"],
				pluck="user",
			):
				if _is_enabled_cashier(user):
					cashiers.add(user)

	if frappe.session.user not in cashiers and _is_enabled_cashier(frappe.session.user):
		if pos_profile:
			branch = frappe.db.get_value("POS Profile", pos_profile, "branch")
			if branch and frappe.db.exists(
				"URY User", {"parent": branch, "parenttype": "Branch", "user": frappe.session.user}
			):
				cashiers.add(frappe.session.user)
		elif frappe.session.user == "Administrator":
			cashiers.add(frappe.session.user)

	results = sorted(cashiers)
	if txt:
		txt = txt.lower()
		results = [user for user in results if txt in user.lower()]

	return [[user] for user in results[start : start + page_len]]


def _is_enabled_cashier(user):
	if not user or not frappe.db.get_value("User", user, "enabled"):
		return False

	if user == "Administrator":
		return True

	return bool(URY_CASHIER_ROLES.intersection(set(frappe.get_roles(user))))
