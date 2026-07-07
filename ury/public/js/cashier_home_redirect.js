(function () {
	const home = frappe.boot && frappe.boot.ury_home;
	if (!home) {
		return;
	}

	const path = window.location.pathname;
	const normalized = path.replace(/\/$/, "") || "/";
	const desk_entry_paths = ["/app/ury", "/app", "/desk"];

	if (desk_entry_paths.includes(path) || desk_entry_paths.includes(normalized)) {
		window.location.replace(home);
	}
})();
