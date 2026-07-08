import { call } from './frappe-sdk';
import type { PaymentPreview } from './payment-calculations';

interface PaymentMode {
  mode_of_payment: string;
  opening_amount: number;
}

interface PaymentModeResponse {
  message: PaymentMode[];
}

export interface ValidatedCoupon {
  coupon_name: string;
  coupon_code: string;
  label: string;
  coupon_type: string;
}

export const getPaymentModes = async (): Promise<string[]> => {
  const cached = sessionStorage.getItem('payment_modes');
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const response = await call.get<PaymentModeResponse>('ury.ury_pos.api.getModeOfPayment');
    const paymentModes = response.message.map((mode: PaymentMode) => mode.mode_of_payment);
    sessionStorage.setItem('payment_modes', JSON.stringify(paymentModes));
    return paymentModes;
  } catch (error) {
    console.error('Failed to fetch payment modes:', error);
    throw error;
  }
};

export async function validatePosCoupon(
  couponCode: string,
  invoice?: string,
): Promise<ValidatedCoupon> {
  const response = await call.get<{ message: ValidatedCoupon }>(
    'ury.ury.api.ury_pos_payment.validate_pos_coupon',
    { coupon_code: couponCode, invoice },
  );
  return response.message;
}

export async function previewPaymentTotals(params: {
  invoice: string;
  additional_discount_percentage?: number;
  additional_discount_amount?: number;
  coupon_code?: string | null;
  tip_amount?: number;
}): Promise<PaymentPreview> {
  const response = await call.get<{ message: PaymentPreview }>(
    'ury.ury.api.ury_pos_payment.preview_payment_totals',
    {
      invoice: params.invoice,
      additional_discount_percentage: params.additional_discount_percentage ?? 0,
      additional_discount_amount: params.additional_discount_amount ?? 0,
      coupon_code: params.coupon_code || undefined,
      tip_amount: params.tip_amount ?? 0,
    },
  );
  return response.message;
}
