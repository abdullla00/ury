import frappe

DATE_SPINE_OLD = (
	"WHERE DATE_ADD(%(start_date)s, INTERVAL n DAY) < %(end_date)s\n"
	"        UNION\n"
	"        SELECT %(end_date)s AS `date`"
)
DATE_SPINE_NEW = (
	"WHERE DATE_ADD(%(start_date)s, INTERVAL n DAY) <= %(end_date)s\n"
	"          AND DATE_ADD(%(start_date)s, INTERVAL n DAY) > %(start_date)s"
)
ORDER_BY_OLD = "ORDER BY \n    c.`item_group` ASC, b.`item_name` ASC"
ORDER_BY_NEW = "ORDER BY \n    c.`item_group` ASC, c.`item_name` ASC"


def execute():
	reports = frappe.get_all(
		"Report",
		filters={"module": "URY", "report_type": "Query Report"},
		pluck="name",
	)

	for report_name in reports:
		query = frappe.db.get_value("Report", report_name, "query")
		if not query or DATE_SPINE_OLD not in query:
			continue

		query = query.replace(DATE_SPINE_OLD, DATE_SPINE_NEW)
		query = query.replace(ORDER_BY_OLD, ORDER_BY_NEW)
		frappe.db.set_value("Report", report_name, "query", query)

	frappe.db.commit()
