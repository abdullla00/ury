# Copyright (c) 2026, Tridz Technologies Pvt. Ltd. and contributors
# See license.txt

from unittest.mock import MagicMock, patch

import frappe
from frappe.tests.utils import FrappeTestCase

from ury.ury.api.ury_pos_shift_gate import (
	_desk_form_route,
	_entry_is_today,
	_profile_main_cashier,
	build_pos_shift_gate,
)


class TestUryPosShiftGateHelpers(FrappeTestCase):
	def test_desk_form_route_new_includes_ury_return_and_query(self):
		route = _desk_form_route(
			"pos-opening-entry",
			None,
			pos_profile="Test POS",
			company="Test Co",
			branch="Main",
		)
		self.assertIn("/app/pos-opening-entry/new?", route)
		self.assertIn("ury_return=%2Fpos", route)
		self.assertIn("pos_profile=Test+POS", route)
		self.assertIn("company=Test+Co", route)
		self.assertIn("branch=Main", route)

	def test_desk_form_route_existing_doc(self):
		route = _desk_form_route("pos-opening-entry", "POS-OPE-2026-00001")
		self.assertIn("/app/pos-opening-entry/POS-OPE-2026-00001?", route)
		self.assertIn("ury_return=%2Fpos", route)

	@patch("ury.ury.api.ury_pos_shift_gate.today")
	def test_entry_is_today_matches_posting_or_period_start(self, mock_today):
		mock_today.return_value = "2026-07-08"
		self.assertTrue(_entry_is_today({"posting_date": "2026-07-08"}))
		self.assertTrue(_entry_is_today({"period_start_date": "2026-07-08 05:00:00"}))
		self.assertFalse(_entry_is_today({"posting_date": "2026-07-07"}))

	def test_profile_main_cashier_reads_applicable_users(self):
		doc = MagicMock()
		doc.applicable_for_users = [
			MagicMock(custom_main_cashier=0, user="sub@example.com"),
			MagicMock(custom_main_cashier=1, user="main@example.com"),
		]
		self.assertEqual(_profile_main_cashier(doc), "main@example.com")


class TestBuildPosShiftGate(FrappeTestCase):
	@patch("ury.ury.api.ury_pos_shift_gate.refresh_outdated_pos_opening_entries")
	@patch("ury.ury.api.ury_pos_shift_gate._get_open_entries")
	@patch("ury.ury.api.ury_pos_shift_gate.get_pos_profile_for_branch")
	@patch("ury.ury.api.ury_pos_shift_gate._get_room_context")
	def test_opening_scenario_when_no_open_entry(
		self,
		mock_room,
		mock_profile_for_branch,
		mock_open_entries,
		_mock_refresh,
	):
		mock_room.return_value = ("Main", "Hall")
		mock_profile_for_branch.return_value = "Test POS"
		mock_open_entries.return_value = []

		pos_profile_doc = MagicMock()
		pos_profile_doc.company = "Test Co"
		pos_profile_doc.restaurant = None
		pos_profile_doc.custom_enable_multiple_cashier = 0
		pos_profile_doc.applicable_for_users = []

		with patch("ury.ury.api.ury_pos_shift_gate.frappe.get_doc", return_value=pos_profile_doc):
			with patch("ury.ury.api.ury_pos_shift_gate._closing_queued", return_value=False):
				with patch("ury.ury.api.ury_pos_shift_gate._get_draft_opening", return_value=None):
					with patch("ury.ury.api.ury_pos_shift_gate._daily_close_blocked", return_value=None):
						with patch(
							"ury.ury.api.ury_pos_shift_gate.frappe.get_all",
							return_value=[],
						):
							with patch(
								"ury.ury.api.ury_pos_shift_gate._suggested_opening_balances",
								return_value=[],
							):
								result = build_pos_shift_gate()

		self.assertEqual(result["scenario"], "opening")
		self.assertEqual(result["branch"], "Main")
		self.assertEqual(result["room"], "Hall")
		self.assertIn("open_shift", result["desk_routes"])
		self.assertIn("ury_return=%2Fpos", result["desk_routes"]["open_shift"])

	@patch("ury.ury.api.ury_pos_shift_gate.refresh_outdated_pos_opening_entries")
	@patch("ury.ury.api.ury_pos_shift_gate._get_open_entries")
	@patch("ury.ury.api.ury_pos_shift_gate.get_pos_profile_for_branch")
	@patch("ury.ury.api.ury_pos_shift_gate._get_room_context")
	def test_ok_scenario_when_today_entry_exists(
		self,
		mock_room,
		mock_profile_for_branch,
		mock_open_entries,
		_mock_refresh,
	):
		mock_room.return_value = ("Main", None)
		mock_profile_for_branch.return_value = "Test POS"
		mock_open_entries.return_value = [
			{
				"name": "POS-OPE-2026-00099",
				"user": frappe.session.user,
				"period_start_date": frappe.utils.today(),
				"posting_date": frappe.utils.today(),
				"pos_profile": "Test POS",
			}
		]

		pos_profile_doc = MagicMock()
		pos_profile_doc.company = "Test Co"
		pos_profile_doc.restaurant = None
		pos_profile_doc.custom_enable_multiple_cashier = 0
		pos_profile_doc.applicable_for_users = []

		with patch("ury.ury.api.ury_pos_shift_gate.frappe.get_doc", return_value=pos_profile_doc):
			with patch(
				"ury.ury.api.ury_pos_shift_gate._shift_summary_from_entry",
				return_value={
					"opening_entry": "POS-OPE-2026-00099",
					"period_start": f"{frappe.utils.today()} 05:00:00",
					"posting_date": frappe.utils.today(),
				},
			):
				with patch(
					"ury.ury.api.ury_pos_shift_gate._suggested_opening_balances",
					return_value=[],
				):
					with patch(
						"ury.ury.api.ury_pos_shift_gate._user_full_name",
						return_value="Test User",
					):
						result = build_pos_shift_gate()

		self.assertEqual(result["scenario"], "ok")
		self.assertTrue(result["completed_steps"]["opened_today"])
		self.assertEqual(result["shift_summary"]["opening_entry"], "POS-OPE-2026-00099")
