import frappe

URY_APP_ROLES = {"URY Cashier", "URY Captain", "URY Manager", "System Manager"}


def check_app_permission():
	if frappe.session.user == "Administrator":
		return True
	return bool(URY_APP_ROLES.intersection(set(frappe.get_roles())))
