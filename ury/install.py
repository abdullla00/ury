import os

import click
import frappe
from frappe.model.sync import import_file_by_path
from frappe.modules.utils import get_app_level_directory_path

from ury.setup import after_install as setup


def after_install():
	try:
		print("Setting up URY...")
		setup()

		click.secho("Thank you for installing URY App!", fg="green")

	except Exception:
		pass


def after_migrate():
	sync_ury_desktop_icons()
	sync_ury_workspace_sidebars()
	sync_ury_report_settings()


def sync_ury_report_settings():
	"""Create minimal URY Report Settings for branches that do not have one."""
	buying_price_list = frappe.db.get_value(
		"Price List", {"buying": 1, "enabled": 1}, "name", order_by="creation asc"
	)
	if not buying_price_list:
		buying_price_list = frappe.db.get_value("Price List", {"buying": 1}, "name")

	if not buying_price_list:
		return

	branches = frappe.get_all("Branch", pluck="name")
	for branch in branches:
		if frappe.db.exists("URY Report Settings", branch):
			continue

		doc = frappe.get_doc(
			{
				"doctype": "URY Report Settings",
				"branch": branch,
				"extended_hours": 0,
				"buying_price_list": buying_price_list,
			}
		)
		doc.insert(ignore_permissions=True)

	frappe.db.commit(chain=True)


def sync_ury_workspace_sidebars():
	directory_path = get_app_level_directory_path("workspace_sidebar", "ury")
	if not os.path.exists(directory_path):
		return

	for filename in sorted(os.listdir(directory_path)):
		if not filename.endswith(".json"):
			continue

		doc_path = os.path.join(directory_path, filename)
		imported = import_file_by_path(doc_path, force=True, ignore_version=True)
		if imported:
			frappe.db.commit(chain=True)


def sync_ury_desktop_icons():
	directory_path = get_app_level_directory_path("desktop_icon", "ury")
	if not os.path.exists(directory_path):
		return

	for filename in sorted(os.listdir(directory_path)):
		if not filename.endswith(".json"):
			continue

		doc_path = os.path.join(directory_path, filename)
		imported = import_file_by_path(doc_path, force=True, ignore_version=True)
		if imported:
			frappe.db.commit(chain=True)
