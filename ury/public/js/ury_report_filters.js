frappe.provide("ury.reports");

ury.reports.get_branch = function () {
	return frappe.boot.ury_branch || frappe.defaults.get_user_default("Branch");
};

ury.reports.branch_filter = function () {
	return {
		fieldname: "branch",
		label: __("Branch"),
		fieldtype: "Link",
		options: "Branch",
		reqd: 1,
		mandatory: 1,
		default: ury.reports.get_branch(),
	};
};

ury.reports.date_range_filters = function () {
	const today = frappe.datetime.get_today();
	return [
		{
			fieldname: "start_date",
			label: __("From Date"),
			fieldtype: "Date",
			reqd: 1,
			mandatory: 1,
			default: frappe.datetime.month_start(),
		},
		{
			fieldname: "end_date",
			label: __("To Date"),
			fieldtype: "Date",
			reqd: 1,
			mandatory: 1,
			default: today,
		},
	];
};

ury.reports.register = function (report_name, filters) {
	frappe.query_reports[report_name] = { filters };
};

const date_range_and_branch_reports = [
	"Average Bill Value",
	"Cancelled Invoices",
	"Daywise Customer Details",
	"Daywise Invoices",
	"Daywise Sales",
	"Employee Sales",
	"Item Wise Sales",
	"Repeated Customers",
	"Service Wise Sales",
];

date_range_and_branch_reports.forEach((report_name) => {
	ury.reports.register(report_name, [
		...ury.reports.date_range_filters(),
		ury.reports.branch_filter(),
	]);
});

ury.reports.register("Today's Sales", [ury.reports.branch_filter()]);

ury.reports.register("Month Wise Sales", [ury.reports.branch_filter()]);

ury.reports.register("Time Wise Sales", [
	{
		fieldname: "date",
		label: __("Date"),
		fieldtype: "Date",
		reqd: 1,
		mandatory: 1,
		default: frappe.datetime.get_today(),
	},
	ury.reports.branch_filter(),
]);

ury.reports.register("Employee Item Wise Sales", [
	...ury.reports.date_range_filters(),
	{
		fieldname: "employee",
		label: __("Employee"),
		fieldtype: "Link",
		options: "Employee",
		reqd: 1,
		mandatory: 1,
	},
	ury.reports.branch_filter(),
]);

ury.reports.register("Customer Data", [
	...ury.reports.date_range_filters(),
	ury.reports.branch_filter(),
	{
		fieldname: "customer",
		label: __("Customer"),
		fieldtype: "Link",
		options: "Customer",
		reqd: 1,
		mandatory: 1,
	},
]);
