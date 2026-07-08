import { cn } from '../lib/utils';
import { t } from '../i18n';
import type { KotFilterChip } from '../store/slices/orders-slice';

interface ChipDef {
  id: KotFilterChip;
  labelKey: string;
  count?: number;
}

interface OrdersKotFilterChipsProps {
  active: KotFilterChip;
  counts: { inKitchen: number; delayed: number; notSent: number };
  onChange: (filter: KotFilterChip) => void;
}

export default function OrdersKotFilterChips({
  active,
  counts,
  onChange,
}: OrdersKotFilterChipsProps) {
  const chips: ChipDef[] = [
    { id: 'all', labelKey: 'orders.kot_filter.all' },
    { id: 'in_kitchen', labelKey: 'orders.kot_filter.in_kitchen', count: counts.inKitchen },
    { id: 'delayed', labelKey: 'orders.kot_filter.delayed', count: counts.delayed },
    { id: 'not_sent', labelKey: 'orders.kot_filter.not_sent', count: counts.notSent },
  ];

  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
      {chips.map((chip) => {
        const isActive = active === chip.id;
        const label = t(chip.labelKey);
        const text =
          chip.count != null && chip.id !== 'all' ? `${label} (${chip.count})` : label;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              isActive ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200',
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
