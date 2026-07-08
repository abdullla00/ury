export type DiscountType = 'percent' | 'amount';

export interface PaymentPreview {
  subtotal: number;
  net_total: number;
  discount_amount: number;
  additional_discount_percentage: number;
  coupon_code: string | null;
  rounding_adjustment: number;
  grand_total: number;
  rounded_total: number;
  tip_amount: number;
  total_with_tip: number;
  total_taxes: number;
}

export function localDiscountAmount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: string,
): number {
  const value = parseFloat(discountValue);
  if (isNaN(value) || value <= 0) {
    return 0;
  }
  if (discountType === 'percent') {
    return Math.min(subtotal, (subtotal * value) / 100);
  }
  return Math.min(subtotal, value);
}

export function paymentsTotal(
  paymentInputs: Record<string, string>,
): number {
  return Object.values(paymentInputs).reduce((sum, raw) => {
    const amount = parseFloat(raw || '');
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
}

export function buildPaymentsList(
  paymentModes: Array<string | { id: string }>,
  paymentInputs: Record<string, string>,
) {
  return paymentModes
    .map((mode) => {
      const id = typeof mode === 'string' ? mode : mode.id;
      const amount = parseFloat(paymentInputs[id] || '');
      return amount > 0 ? { mode_of_payment: id, amount } : null;
    })
    .filter(Boolean) as Array<{ mode_of_payment: string; amount: number }>;
}
