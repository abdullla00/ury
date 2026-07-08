import { call } from './frappe-sdk';

export interface POSOpeningResponse {
  message: number;
}

export type POSOpeningStatus = 0 | 1 | 2;

export interface POSCloseValidationResponse {
  message: string;
}

export type PosShiftScenario =
  | 'draft'
  | 'opening'
  | 'outdated'
  | 'closing'
  | 'waiting_main'
  | 'closing_queued'
  | 'blocked_by_other'
  | 'error'
  | 'ok';

export interface SuggestedOpeningBalance {
  mode_of_payment: string;
  amount: number;
}

export interface PosShiftGateContext {
  scenario: PosShiftScenario;
  pos_profile: string;
  company: string;
  branch: string;
  restaurant: string | null;
  room: string | null;
  stale_opening_entry: string | null;
  draft_opening_entry: string | null;
  main_cashier: string | null;
  main_cashier_name: string | null;
  is_main_cashier: boolean;
  main_cashier_open: boolean;
  can_create_opening: boolean;
  can_close_shift: boolean;
  open_entry_owner: string | null;
  open_entry_owner_name: string | null;
  suggested_opening_balances: SuggestedOpeningBalance[];
  business_date: string;
  completed_steps: { closed_previous: boolean; opened_today: boolean };
  desk_routes: {
    open_shift?: string | null;
    resume_draft?: string | null;
    close_shift?: string | null;
    view_opening?: string | null;
  };
  shift_summary: {
    opening_entry: string;
    period_start: string | null;
    posting_date: string | null;
  } | null;
  allow_start_fresh?: boolean;
}

export const SHIFT_WELCOME_SESSION_KEY = 'ury_shift_welcomed';
export const SHIFT_PILL_PULSE_KEY = 'ury_shift_pill_pulse';

export function markShiftPillPulse(): void {
  sessionStorage.setItem(SHIFT_PILL_PULSE_KEY, '1');
}

export function consumeShiftPillPulse(): boolean {
  const shouldPulse = sessionStorage.getItem(SHIFT_PILL_PULSE_KEY) === '1';
  if (shouldPulse) {
    sessionStorage.removeItem(SHIFT_PILL_PULSE_KEY);
  }
  return shouldPulse;
}

export const checkPOSOpening = async (): Promise<POSOpeningResponse> => {
  const response = await call.get<POSOpeningResponse>('ury.ury_pos.api.posOpening');
  return response;
};

export const refreshPosOpeningForToday = async () => {
  const response = await call.post<{ message: { updated: string[]; status: string } }>(
    'ury.ury_pos.api.refresh_pos_opening_for_today',
  );
  return response.message;
};

export const validatePOSClose = async (posProfile: string): Promise<POSCloseValidationResponse> => {
  const response = await call.get<POSCloseValidationResponse>(
    'ury.ury_pos.api.validate_pos_close',
    { pos_profile: posProfile },
  );
  return response;
};

export const getPosShiftGate = async (): Promise<PosShiftGateContext> => {
  const response = await call.get<{ message: PosShiftGateContext }>(
    'ury.ury_pos.api.get_pos_shift_gate',
  );
  return response.message;
};

export function shouldShowShiftWelcome(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get('shift_opened') !== '1') {
    return false;
  }
  return sessionStorage.getItem(SHIFT_WELCOME_SESSION_KEY) !== '1';
}

export function markShiftWelcomed(): void {
  sessionStorage.setItem(SHIFT_WELCOME_SESSION_KEY, '1');
}

export function clearShiftWelcomeQuery(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('shift_opened');
  url.searchParams.delete('opening_entry');
  url.searchParams.delete('shift_closed');
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}
