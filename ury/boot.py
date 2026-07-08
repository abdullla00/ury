import frappe
from frappe import _

URY_CASHIER_ROLES = {"URY Cashier"}
URY_MANAGER_ROLES = {"URY Manager", "System Manager"}

DESK_RETURN_BANNER_MSGID = "Submit this form to return to URY POS"


def _get_user_branch():
	branch = frappe.db.sql(
		"""
		SELECT b.name
		FROM `tabURY User` AS u
		INNER JOIN `tabBranch` AS b ON u.parent = b.name
		WHERE u.user = %s
		LIMIT 1
		""",
		frappe.session.user,
	)
	if branch:
		return branch[0][0]

	return frappe.defaults.get_user_default("Branch")


def extend_bootinfo(bootinfo):
	if frappe.session.user == "Guest":
		return

	branch = _get_user_branch()
	if branch:
		bootinfo.ury_branch = branch

	if frappe.session.user == "Administrator":
		bootinfo.ury_pos_desk_return_banner = _(DESK_RETURN_BANNER_MSGID)
		return

	roles = set(frappe.get_roles())
	bootinfo.ury_pos_desk_return_banner = _(DESK_RETURN_BANNER_MSGID)
	if URY_CASHIER_ROLES.intersection(roles) and not URY_MANAGER_ROLES.intersection(roles):
		bootinfo.ury_home = "/pos"
