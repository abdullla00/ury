// Copyright (c) 2023, Tridz Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on("URY Production Unit", {
	refresh(frm) {
		if (frm.is_new()) {
			return;
		}

		frm.add_custom_button(__("Open Kitchen Display"), () => {
			window.open(`/URYMosaic/${encodeURIComponent(frm.doc.name)}`, "_blank");
		});
	},
});
