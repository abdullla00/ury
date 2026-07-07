import frappe


def execute():
	if frappe.db.exists("Custom HTML Block", "POS V1"):
		frappe.delete_doc("Custom HTML Block", "POS V1", force=1)

	cashier_users = frappe.get_all(
		"Has Role",
		filters={"role": "URY Cashier", "parenttype": "User"},
		pluck="parent",
	)

	for user in cashier_users:
		if user in ("Administrator", "Guest"):
			continue

		roles = set(frappe.get_roles(user))
		if roles.intersection({"URY Manager", "System Manager"}):
			continue

		frappe.db.set_value("User", user, "default_app", "ury")

	if frappe.db.exists("Desktop Icon", {"label": "URY", "icon_type": "App"}):
		frappe.db.sql(
			"""
			UPDATE `tabDesktop Icon`
			SET hidden = 1
			WHERE label = 'URY' AND icon_type = 'Link'
			"""
		)

	frappe.db.commit()
