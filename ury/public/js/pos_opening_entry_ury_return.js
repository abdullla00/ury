/* global frappe */

const URY_RETURN_PARAM = "ury_return";
const DESK_BANNER_CLASS = "ury-pos-return-banner";

function getUryReturnUrl() {
	const params = frappe.utils.get_query_params();
	return params[URY_RETURN_PARAM] || null;
}

function sanitisedReturnUrl(fallback = "/pos") {
	const raw = getUryReturnUrl();
	if (!raw) {
		return fallback;
	}
	try {
		return frappe.utils.sanitise_redirect(raw) || fallback;
	} catch (e) {
		return fallback;
	}
}

function appendQuery(url, extra) {
	const separator = url.includes("?") ? "&" : "?";
	const parts = Object.entries(extra)
		.filter(([, v]) => v != null && v !== "")
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
	if (!parts.length) {
		return url;
	}
	return `${url}${separator}${parts.join("&")}`;
}

function redirectToPos(extra = {}) {
	const base = sanitisedReturnUrl("/pos");
	window.location.href = appendQuery(base, extra);
}

function deskReturnBannerMessage() {
	if (frappe.boot && frappe.boot.ury_pos_desk_return_banner) {
		return frappe.boot.ury_pos_desk_return_banner;
	}
	return __("Submit this form to return to URY POS");
}

function showUryDeskBanner(frm) {
	if (!getUryReturnUrl()) {
		return;
	}
	const message = deskReturnBannerMessage();
	if (frm.dashboard && frm.dashboard.set_headline) {
		frm.dashboard.set_headline(message);
	}

	let banner = frm.$wrapper.find(`.${DESK_BANNER_CLASS}`);
	if (!banner.length) {
		banner = $(`
			<div class="${DESK_BANNER_CLASS} alert alert-info" role="status"
				style="margin: 0 0 12px; border-radius: 8px; font-weight: 500;">
			</div>
		`).prependTo(frm.$wrapper);
	}
	banner.text(message);
}

function prefillOpeningFromQuery(frm) {
	if (frm.doc.docstatus !== 0) {
		return;
	}
	const params = frappe.utils.get_query_params();
	if (params.pos_profile && !frm.doc.pos_profile) {
		frm.set_value("pos_profile", params.pos_profile);
	}
	if (params.company && !frm.doc.company) {
		frm.set_value("company", params.company);
	}
	if (params.branch && frm.meta.fields.find((f) => f.fieldname === "branch")) {
		frm.set_value("branch", params.branch);
	}
}

function prefillClosingFromQuery(frm) {
	if (frm.doc.docstatus !== 0) {
		return;
	}
	const params = frappe.utils.get_query_params();
	if (params.pos_opening_entry && !frm.doc.pos_opening_entry) {
		frm.set_value("pos_opening_entry", params.pos_opening_entry);
	}
	if (params.pos_profile && !frm.doc.pos_profile) {
		frm.set_value("pos_profile", params.pos_profile);
	}
	if (params.company && !frm.doc.company) {
		frm.set_value("company", params.company);
	}
}

function scheduleClosingRedirect(frm) {
	if (!getUryReturnUrl()) {
		return;
	}
	const attempt = () => {
		if (frm.doc.status === "Queued") {
			return;
		}
		redirectToPos({ shift_closed: 1 });
	};
	if (frm.doc.status === "Queued") {
		frappe.realtime.on("closing_process_complete", () => {
			frm.reload_doc().then(() => attempt());
		});
		return;
	}
	attempt();
}

frappe.ui.form.on("POS Opening Entry", {
	setup(frm) {
		prefillOpeningFromQuery(frm);
	},
	refresh(frm) {
		showUryDeskBanner(frm);
		prefillOpeningFromQuery(frm);
	},
	after_submit(frm) {
		if (!getUryReturnUrl()) {
			return;
		}
		redirectToPos({
			shift_opened: 1,
			opening_entry: frm.doc.name,
		});
	},
});

frappe.ui.form.on("POS Closing Entry", {
	setup(frm) {
		prefillClosingFromQuery(frm);
	},
	refresh(frm) {
		showUryDeskBanner(frm);
		prefillClosingFromQuery(frm);
	},
	after_submit(frm) {
		if (!getUryReturnUrl()) {
			return;
		}
		scheduleClosingRedirect(frm);
	},
});
