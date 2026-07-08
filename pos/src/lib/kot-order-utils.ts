import type { KotFilterChip, KotSummaryStatus, POSInvoice } from '../store/slices/orders-slice';

const IN_KITCHEN_STATUSES: KotSummaryStatus[] = ['in_kitchen', 'partial', 'ready'];

export function matchesKotFilter(order: POSInvoice, filter: KotFilterChip): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'delayed') {
    return Boolean(order.kot_delayed);
  }
  if (filter === 'in_kitchen') {
    return IN_KITCHEN_STATUSES.includes(order.kot_summary ?? 'not_sent');
  }
  if (filter === 'not_sent') {
    return !order.kot_summary || order.kot_summary === 'not_sent';
  }
  return true;
}

export function tallyKotCounts(orders: POSInvoice[]) {
  return orders.reduce(
    (acc, order) => {
      if (matchesKotFilter(order, 'in_kitchen')) {
        acc.inKitchen += 1;
      }
      if (matchesKotFilter(order, 'delayed')) {
        acc.delayed += 1;
      }
      if (matchesKotFilter(order, 'not_sent')) {
        acc.notSent += 1;
      }
      return acc;
    },
    { inKitchen: 0, delayed: 0, notSent: 0 },
  );
}

export function sortOrdersByKitchenRush(orders: POSInvoice[]): POSInvoice[] {
  const priority = (order: POSInvoice) => {
    if (order.kot_delayed) {
      return 0;
    }
    if (order.kot_summary === 'in_kitchen' || order.kot_summary === 'partial') {
      return 1;
    }
    if (order.kot_summary === 'ready') {
      return 2;
    }
    return 3;
  };
  return [...orders].sort((a, b) => priority(a) - priority(b));
}

export function kotFilterStorageKey(tab: string): string {
  return `ury_orders_kot_filter_${tab}`;
}

export function readKotFilter(tab: string): KotFilterChip {
  try {
    const value = sessionStorage.getItem(kotFilterStorageKey(tab));
    if (value === 'in_kitchen' || value === 'delayed' || value === 'not_sent' || value === 'all') {
      return value;
    }
  } catch {
    // ignore
  }
  return 'all';
}

export function writeKotFilter(tab: string, filter: KotFilterChip): void {
  try {
    sessionStorage.setItem(kotFilterStorageKey(tab), filter);
  } catch {
    // ignore
  }
}
