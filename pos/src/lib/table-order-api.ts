import { call } from './frappe-sdk';

export async function transferTable(table: string, newTable: string, invoice: string) {
  return call.post('ury.ury.doctype.ury_order.ury_order.table_transfer', {
    table,
    newTable,
    invoice,
  });
}

export async function mergeTable(table: string, targetTable: string, invoice: string) {
  return call.post('ury.ury.doctype.ury_order.ury_order.table_merge', {
    table,
    targetTable,
    invoice,
  });
}

export async function cancelOrder(invoiceId: string, reason: string) {
  return call.post('ury.ury.doctype.ury_order.ury_order.cancel_order', {
    invoice_id: invoiceId,
    reason,
  });
}

export async function captainTransfer(
  currentCaptain: string,
  newCaptain: string,
  invoice: string,
) {
  return call.post('ury.ury.doctype.ury_order.ury_order.captain_transfer', {
    currentCaptain,
    newCaptain,
    invoice,
  });
}

export async function reprintKot(invoiceNumber: string) {
  return call.get('ury.ury.api.ury_kot_reprint.reprint_kot', {
    invoice_number: invoiceNumber,
  });
}

export async function getRoomQrTokens(room: string) {
  const res = await call.get('ury.ury_pos.api.get_room_qr_tokens', { room });
  return res.message as Array<{ table: string; token: string; url: string }>;
}
