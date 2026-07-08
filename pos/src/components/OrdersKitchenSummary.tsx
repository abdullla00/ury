import { cn } from '../lib/utils';
import { t } from '../i18n';
import type { KotFilterChip } from '../store/slices/orders-slice';

interface OrdersKitchenSummaryProps {
  counts: { inKitchen: number; delayed: number; notSent: number };
  onFilter: (filter: KotFilterChip) => void;
}

export default function OrdersKitchenSummary({ counts, onFilter }: OrdersKitchenSummaryProps) {
  const hasActivity = counts.inKitchen > 0 || counts.delayed > 0 || counts.notSent > 0;
  if (!hasActivity) {
    return null;
  }

  const segments = [
    {
      key: 'in_kitchen' as const,
      count: counts.inKitchen,
      label: t('orders.kitchen_summary.in_kitchen', { count: String(counts.inKitchen) }),
      className: 'text-amber-700',
      show: counts.inKitchen > 0,
    },
    {
      key: 'delayed' as const,
      count: counts.delayed,
      label: t('orders.kitchen_summary.delayed', { count: String(counts.delayed) }),
      className: 'text-red-600',
      show: counts.delayed > 0,
    },
    {
      key: 'not_sent' as const,
      count: counts.notSent,
      label: t('orders.kitchen_summary.not_sent', { count: String(counts.notSent) }),
      className: 'text-gray-600',
      show: counts.notSent > 0,
    },
  ].filter((s) => s.show);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs">
      {segments.map((seg, index) => (
        <span key={seg.key} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-gray-400">·</span> : null}
          <button
            type="button"
            className={cn('font-medium underline-offset-2 hover:underline', seg.className)}
            onClick={() => onFilter(seg.key)}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </div>
  );
}
