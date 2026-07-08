import { cn } from '../lib/utils';
import { getKotStatusClass, getKotStatusDotClass, getKotStatusIcon } from '../lib/order-card-accent';
import type { KotSummaryStatus } from '../store/slices/orders-slice';

interface KotStatusIndicatorProps {
  status: KotSummaryStatus;
  delayed?: boolean;
  iconClassName?: string;
}

export default function KotStatusIndicator({
  status,
  delayed,
  iconClassName,
}: KotStatusIndicatorProps) {
  const Icon = getKotStatusIcon(status);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span
        className={cn('h-2 w-2 rounded-full', getKotStatusDotClass(status, delayed))}
        aria-hidden
      />
      <Icon className={cn('h-3.5 w-3.5', getKotStatusClass(status, delayed), iconClassName)} />
    </span>
  );
}
