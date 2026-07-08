import { call } from './frappe-sdk';

export interface PosShiftInfo {
  status: 'open' | 'closed';
  opening_entry?: string;
  period_start?: string;
  pos_profile?: string;
}

export async function getPosShiftInfo(): Promise<PosShiftInfo> {
  const res = await call.get('ury.ury_pos.api.get_pos_shift_info');
  return res.message as PosShiftInfo;
}

export async function getOccupiedTableCount(): Promise<number> {
  const res = await call.get('ury.ury_pos.api.get_occupied_table_count');
  return Number(res.message) || 0;
}
