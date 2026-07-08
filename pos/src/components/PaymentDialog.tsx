import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CreditCard,
  Gift,
  Mail,
  Percent,
  Sparkles,
  Ticket,
  Wallet,
  X,
} from 'lucide-react';
import { usePOSStore } from '../store/pos-store';
import { cn, formatCurrency } from '../lib/utils';
import { Button, Input, Dialog, DialogContent } from './ui';
import PaymentNumpad from './PaymentNumpad';
import { call } from '../lib/frappe-sdk';
import { DEFAULT_PAYMENT_MODE } from '../data/order-types';
import { t } from '../i18n';
import { previewPaymentTotals, validatePosCoupon } from '../lib/payment-api';
import {
  buildPaymentsList,
  type DiscountType,
  type PaymentPreview,
  paymentsTotal,
} from '../lib/payment-calculations';

interface PaymentDialogProps {
  onClose: () => void;
  grandTotal: number;
  roundedTotal: number;
  invoice: string;
  customer: string;
  posProfile: string;
  table: string | null;
  cashier: string;
  owner: string;
  fetchOrders: () => Promise<void>;
  clearSelectedOrder: () => void;
  fullscreen?: boolean;
}

type AdjustTab = 'discount' | 'voucher' | 'tip';

const DISCOUNT_PRESETS = [5, 10, 15, 20];

function modeIcon(mode: string) {
  const lower = mode.toLowerCase();
  if (lower.includes('cash')) {
    return Banknote;
  }
  if (lower.includes('voucher') || lower.includes('coupon') || lower.includes('gift')) {
    return Ticket;
  }
  if (lower.includes('card') || lower.includes('credit') || lower.includes('debit')) {
    return CreditCard;
  }
  if (lower.includes('wallet') || lower.includes('upi')) {
    return Wallet;
  }
  return CreditCard;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  onClose,
  grandTotal,
  roundedTotal,
  invoice,
  customer,
  posProfile,
  table,
  cashier,
  owner,
  fetchOrders,
  clearSelectedOrder,
  fullscreen = false,
}) => {
  const { paymentModes, fetchPaymentModes, posProfile: storePosProfile } = usePOSStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustTab, setAdjustTab] = useState<AdjustTab>('discount');
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [appliedDiscountValue, setAppliedDiscountValue] = useState('');
  const [appliedDiscountType, setAppliedDiscountType] = useState<DiscountType>('percent');
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; label: string } | null>(null);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [activeMode, setActiveMode] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [emailInvoice, setEmailInvoice] = useState(false);
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const tipsEnabled = storePosProfile?.enable_tips !== 0;
  const allowPartial = storePosProfile?.allow_partial_payment === 1;
  const discountEnabled = storePosProfile?.enable_discount === 1;
  const hasTipItem = Boolean(storePosProfile?.tip_item);

  useEffect(() => {
    fetchPaymentModes();
  }, [fetchPaymentModes]);

  useEffect(() => {
    if (paymentModes.length && !activeMode) {
      const preferred = paymentModes.find((m) => m === DEFAULT_PAYMENT_MODE) || paymentModes[0];
      setActiveMode(typeof preferred === 'string' ? preferred : preferred);
    }
  }, [paymentModes, activeMode]);

  const additionalDiscountPct =
    appliedDiscountType === 'percent' ? parseFloat(appliedDiscountValue || '0') || 0 : 0;
  const additionalDiscountAmt =
    appliedDiscountType === 'amount' ? parseFloat(appliedDiscountValue || '0') || 0 : 0;

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const result = await previewPaymentTotals({
        invoice,
        additional_discount_percentage: additionalDiscountPct,
        additional_discount_amount: additionalDiscountAmt,
        coupon_code: appliedCoupon?.code,
        tip_amount: tipAmount,
      });
      setPreview(result);
      setError(null);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : t('errors.payment_preview_failed'));
    } finally {
      setPreviewLoading(false);
    }
  }, [
    invoice,
    additionalDiscountPct,
    additionalDiscountAmt,
    appliedCoupon?.code,
    tipAmount,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPreview();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [refreshPreview]);

  const dueTotal = preview?.total_with_tip ?? roundedTotal + tipAmount;
  const enteredTotal = paymentsTotal(paymentInputs);
  const changeDue = Math.max(0, enteredTotal - dueTotal);
  const remaining = Math.max(0, dueTotal - enteredTotal);
  const payments = buildPaymentsList(paymentModes, paymentInputs);

  useEffect(() => {
    if (!dueTotal || !activeMode) {
      return;
    }
    const hasDefault = paymentModes.includes(DEFAULT_PAYMENT_MODE);
    const fillMode = hasDefault ? DEFAULT_PAYMENT_MODE : activeMode;
    setPaymentInputs((prev) => {
      const hasEnteredAmount = Object.values(prev).some(
        (value) => value && parseFloat(value) > 0,
      );
      if (hasEnteredAmount) {
        return prev;
      }
      return { [fillMode]: String(dueTotal) };
    });
  }, [dueTotal, paymentModes, activeMode]);

  const handleNumpadKey = (key: string) => {
    if (!activeMode) {
      return;
    }
    setPaymentInputs((inputs) => {
      const current = inputs[activeMode] || '';
      if (key === 'back') {
        return { ...inputs, [activeMode]: current.slice(0, -1) };
      }
      if (key === 'clear') {
        return { ...inputs, [activeMode]: '' };
      }
      if (key === '.' && current.includes('.')) {
        return inputs;
      }
      return { ...inputs, [activeMode]: current + key };
    });
  };

  const handleApplyDiscount = (value?: string, type?: DiscountType) => {
    const nextType = type ?? discountType;
    const nextValue = value ?? discountValue;
    const parsed = parseFloat(nextValue);
    if (isNaN(parsed) || parsed <= 0) {
      setError(t('errors.invalid_discount'));
      return;
    }
    if (nextType === 'percent' && parsed > 100) {
      setError(t('errors.discount_exceeds_max'));
      return;
    }
    setAppliedDiscountType(nextType);
    setAppliedDiscountValue(nextValue);
    setDiscountValue(nextValue);
    setError(null);
  };

  const clearDiscount = () => {
    setDiscountValue('');
    setAppliedDiscountValue('');
    setAppliedDiscountType('percent');
  };

  const handleApplyVoucher = async () => {
    if (!voucherInput.trim()) {
      setError(t('payment.voucher_required'));
      return;
    }
    try {
      const result = await validatePosCoupon(voucherInput.trim(), invoice);
      setAppliedCoupon({ code: result.coupon_code, label: result.label });
      setVoucherInput('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payment.voucher_invalid'));
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      if (!allowPartial && enteredTotal + 0.01 < dueTotal) {
        setError(t('errors.full_payment_required'));
        setIsProcessing(false);
        return;
      }

      await call.post('ury.ury.doctype.ury_order.ury_order.make_invoice', {
        additionalDiscount: additionalDiscountPct || 0,
        additional_discount_amount: additionalDiscountAmt || 0,
        coupon_code: appliedCoupon?.code || undefined,
        cashier,
        customer,
        invoice,
        owner,
        payments,
        pos_profile: posProfile,
        table: table ?? '',
        tip_amount: hasTipItem ? tipAmount : 0,
        email_invoice: emailInvoice ? 1 : 0,
      });
      onClose();
      clearSelectedOrder();
      await fetchOrders();
    } catch (err) {
      setError((err as Error).message);
      if (
        err &&
        typeof err === 'object' &&
        '_server_messages' in err &&
        typeof (err as { _server_messages: string })._server_messages === 'string'
      ) {
        try {
          const messages = JSON.parse((err as { _server_messages: string })._server_messages);
          const messageObj = JSON.parse(messages[0]);
          setError(messageObj.message || (err as Error).message);
        } catch {
          // keep default
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const fillRemaining = () => {
    if (!activeMode) {
      return;
    }
    setPaymentInputs((prev) => ({
      ...prev,
      [activeMode]: String(remaining > 0 ? remaining : dueTotal),
    }));
  };

  const summary = preview ?? {
    subtotal: grandTotal,
    net_total: grandTotal,
    discount_amount: 0,
    additional_discount_percentage: 0,
    coupon_code: null,
    rounding_adjustment: roundedTotal - grandTotal,
    grand_total: grandTotal,
    rounded_total: roundedTotal,
    tip_amount: tipAmount,
    total_with_tip: roundedTotal + tipAmount,
    total_taxes: 0,
  };

  const adjustTabs = useMemo(() => {
    const tabs: Array<{ id: AdjustTab; label: string; icon: React.ElementType }> = [];
    if (discountEnabled) {
      tabs.push({ id: 'discount', label: t('payment.discount'), icon: Percent });
    }
    tabs.push({ id: 'voucher', label: t('payment.voucher'), icon: Ticket });
    if (tipsEnabled) {
      tabs.push({ id: 'tip', label: t('payment.tip'), icon: Sparkles });
    }
    return tabs;
  }, [discountEnabled, tipsEnabled]);

  useEffect(() => {
    if (!adjustTabs.some((tab) => tab.id === adjustTab)) {
      setAdjustTab(adjustTabs[0]?.id ?? 'voucher');
    }
  }, [adjustTabs, adjustTab]);

  const body = (
    <div
      className={cn(
        'flex h-full flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 lg:flex-row',
        fullscreen ? 'w-full' : 'max-h-[92vh] w-full max-w-6xl',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-slate-200/80 lg:border-b-0 lg:border-e">
        <div className="border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('payment.title')}
              </p>
              <h2 className="truncate text-lg font-semibold text-slate-900">{invoice}</h2>
              <p className="truncate text-sm text-slate-500">
                {customer}
                {table ? ` · ${t('context.table')} ${table}` : ''}
              </p>
            </div>
            <Button onClick={onClose} variant="ghost" size="icon" className="shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">{t('payment.amount_due')}</p>
              <p className="text-4xl font-bold tabular-nums tracking-tight text-primary">
                {formatCurrency(dueTotal)}
              </p>
            </div>
            <div className="text-end text-sm">
              <p className="text-slate-500">{t('payment.total_entered')}</p>
              <p
                className={cn(
                  'font-semibold tabular-nums',
                  enteredTotal + 0.01 >= dueTotal ? 'text-emerald-600' : 'text-amber-600',
                )}
              >
                {formatCurrency(enteredTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('payment.payment_methods')}
          </p>
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {paymentModes.map((mode) => {
              const Icon = modeIcon(mode);
              const entered = parseFloat(paymentInputs[mode] || '') || 0;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setActiveMode(mode)}
                  className={cn(
                    'relative flex min-h-[5rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-3 text-center transition-all',
                    activeMode === mode
                      ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
                  )}
                >
                  <Icon className={cn('h-5 w-5', activeMode === mode ? 'text-white' : 'text-slate-600')} />
                  <span className="text-sm font-semibold leading-tight">{mode}</span>
                  {entered > 0 && (
                    <span
                      className={cn(
                        'text-xs font-medium tabular-nums',
                        activeMode === mode ? 'text-white/90' : 'text-emerald-600',
                      )}
                    >
                      {formatCurrency(entered)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={fillRemaining} disabled={!activeMode}>
              {t('payment.fill_remaining')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => activeMode && setPaymentInputs((p) => ({ ...p, [activeMode]: '' }))}
              disabled={!activeMode}
            >
              {t('payment.clear_mode')}
            </Button>
          </div>

          <PaymentNumpad onKey={handleNumpadKey} disabled={isProcessing || !activeMode} />

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex gap-1 overflow-x-auto">
              {adjustTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAdjustTab(tab.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition',
                      adjustTab === tab.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {adjustTab === 'discount' && discountEnabled && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium',
                      discountType === 'percent' ? 'bg-primary text-white' : 'bg-slate-100',
                    )}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('amount')}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium',
                      discountType === 'amount' ? 'bg-primary text-white' : 'bg-slate-100',
                    )}
                  >
                    $
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DISCOUNT_PRESETS.map((pct) => (
                    <Button
                      key={pct}
                      type="button"
                      size="sm"
                      variant={appliedDiscountValue === String(pct) && appliedDiscountType === 'percent' ? 'default' : 'outline'}
                      onClick={() => {
                        setDiscountType('percent');
                        handleApplyDiscount(String(pct), 'percent');
                      }}
                    >
                      {pct}%
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={
                      discountType === 'percent'
                        ? t('payment.discount_placeholder')
                        : t('payment.discount_amount_placeholder')
                    }
                    size="sm"
                    className="flex-1"
                  />
                  <Button onClick={() => handleApplyDiscount()} variant="default" size="sm">
                    {t('common.apply')}
                  </Button>
                  {appliedDiscountValue ? (
                    <Button onClick={clearDiscount} variant="ghost" size="sm">
                      {t('common.clear')}
                    </Button>
                  ) : null}
                </div>
              </div>
            )}

            {adjustTab === 'voucher' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">{t('payment.voucher_hint')}</p>
                <div className="flex gap-2">
                  <Input
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    placeholder={t('payment.voucher_placeholder')}
                    size="sm"
                    className="flex-1 uppercase"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void handleApplyVoucher();
                      }
                    }}
                  />
                  <Button onClick={() => void handleApplyVoucher()} variant="default" size="sm">
                    {t('common.apply')}
                  </Button>
                </div>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 font-medium text-emerald-800">
                      <Gift className="h-4 w-4" />
                      {appliedCoupon.label}
                    </span>
                    <button
                      type="button"
                      className="text-emerald-700 underline"
                      onClick={() => setAppliedCoupon(null)}
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {adjustTab === 'tip' && tipsEnabled && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[10, 15, 20].map((pct) => (
                    <Button
                      key={pct}
                      type="button"
                      variant={
                        tipAmount === Math.round(summary.rounded_total * pct) / 100 ? 'default' : 'outline'
                      }
                      size="sm"
                      onClick={() => {
                        setTipAmount(Math.round((summary.rounded_total * pct) / 100));
                        setCustomTip('');
                      }}
                    >
                      {pct}%
                    </Button>
                  ))}
                  <Input
                    type="number"
                    min="0"
                    placeholder={t('payment.tip_custom')}
                    value={customTip}
                    onChange={(e) => {
                      setCustomTip(e.target.value);
                      const val = parseFloat(e.target.value);
                      setTipAmount(!isNaN(val) && val >= 0 ? val : 0);
                    }}
                    className="w-28"
                    size="sm"
                  />
                </div>
              </div>
            )}

            <label className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={emailInvoice}
                onChange={(e) => setEmailInvoice(e.target.checked)}
                className="rounded border-slate-300"
              />
              <Mail className="h-4 w-4 text-slate-500" />
              {t('payment.email_invoice')}
            </label>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col bg-slate-900 p-4 text-white sm:p-6 lg:w-[24rem] xl:w-[26rem]">
        {error && (
          <div className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3">
            <p className="text-sm text-red-100">{error}</p>
          </div>
        )}

        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {t('payment.order_summary')}
        </h3>
        <div className="mt-4 flex-1 space-y-2 text-sm">
          <div className="flex justify-between text-slate-300">
            <span>{t('payment.subtotal')}</span>
            <span className="tabular-nums">{formatCurrency(summary.subtotal)}</span>
          </div>
          {summary.discount_amount > 0 && (
            <div className="flex justify-between text-emerald-300">
              <span>{t('payment.discount')}</span>
              <span className="tabular-nums">-{formatCurrency(summary.discount_amount)}</span>
            </div>
          )}
          {appliedCoupon && (
            <div className="flex justify-between text-emerald-300">
              <span>{t('payment.voucher')}</span>
              <span>{appliedCoupon.label}</span>
            </div>
          )}
          {Math.abs(summary.rounding_adjustment) > 0.001 && (
            <div className="flex justify-between text-sky-300">
              <span>{t('payment.adjustment')}</span>
              <span className="tabular-nums">
                {summary.rounding_adjustment > 0 ? '+' : ''}
                {formatCurrency(summary.rounding_adjustment)}
              </span>
            </div>
          )}
          {tipAmount > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>{t('payment.tip_amount')}</span>
              <span className="tabular-nums">{formatCurrency(tipAmount)}</span>
            </div>
          )}
          <div className="border-t border-slate-700 pt-3">
            <div className="flex justify-between text-lg font-bold">
              <span>{t('payment.total')}</span>
              <span className="tabular-nums">{formatCurrency(dueTotal)}</span>
            </div>
          </div>
          {changeDue > 0.01 && (
            <div className="flex justify-between rounded-lg bg-amber-500/15 px-3 py-2 text-amber-200">
              <span>{t('payment.change_due')}</span>
              <span className="font-semibold tabular-nums">{formatCurrency(changeDue)}</span>
            </div>
          )}
          {remaining > 0.01 && (
            <div className="flex justify-between text-amber-300">
              <span>{t('payment.remaining')}</span>
              <span className="tabular-nums">{formatCurrency(remaining)}</span>
            </div>
          )}
        </div>

        <Button
          onClick={() => void handlePayment()}
          disabled={isProcessing || payments.length === 0 || previewLoading}
          className="mt-6 h-14 w-full bg-white text-lg font-bold text-slate-900 hover:bg-slate-100"
        >
          {isProcessing
            ? t('payment.processing')
            : t('payment.pay_button', {
                amount: formatCurrency(enteredTotal > 0 ? enteredTotal : dueTotal),
              })}
        </Button>
        <p className="mt-3 text-center text-xs text-slate-500">{t('payment.bill_split_hint')}</p>
      </div>
    </div>
  );

  if (fullscreen) {
    return <div className="flex h-full flex-col overflow-hidden">{body}</div>;
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        variant="xlarge"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden border-0 bg-transparent p-0 shadow-2xl"
        showCloseButton={false}
      >
        {body}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
