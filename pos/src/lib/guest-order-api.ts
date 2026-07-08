import { call } from './frappe-sdk';

export interface GuestMenuItem {
  item: string;
  item_name: string;
  rate: number;
  item_image?: string | null;
  has_modifiers?: boolean;
  variant_items?: string[];
  addon_items?: string[];
}

export async function getGuestTableMenu(token: string) {
  const res = await call.get('ury.ury_pos.api.get_guest_table_menu', { token });
  return res.message as {
    table: string;
    room: string;
    menu: GuestMenuItem[];
    pos_profile: string;
    kds_production_unit?: string | null;
  };
}

export async function guestSyncOrder(
  token: string,
  items: Array<{
    item: string;
    item_name: string;
    rate: number;
    qty: number;
    comment?: string;
    guest_label?: string;
  }>,
  comments?: string,
) {
  return call.post('ury.ury_pos.api.guest_sync_order', {
    token,
    items,
    comments,
  });
}
