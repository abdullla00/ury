import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Flame,
} from 'lucide-react';
import type { OrderType } from '../data/order-types';
import type { KotStationStatus, KotSummaryStatus, POSInvoice } from '../store/slices/orders-slice';

const ORDER_TYPE_STRIPE: Record<string, string> = {
  'Dine In': 'border-emerald-500',
  'Take Away': 'border-sky-500',
  Delivery: 'border-orange-500',
  'Phone In': 'border-violet-500',
  Aggregators: 'border-amber-500',
};

const STATUS_HEADER_TINT: Record<string, string> = {
  Draft: 'bg-amber-50',
  Unbilled: 'bg-blue-50',
  'Recently Paid': 'bg-green-50',
  Paid: 'bg-slate-50',
  Consolidated: 'bg-gray-50',
  Return: 'bg-red-50',
};

const KOT_STATUS_ICON: Record<KotSummaryStatus, LucideIcon> = {
  not_sent: CircleDashed,
  in_kitchen: Flame,
  ready: Bell,
  served: CheckCircle2,
  cancel_pending: AlertTriangle,
  partial: CircleDot,
};

const KOT_STATUS_DOT_CLASS: Record<KotSummaryStatus, string> = {
  not_sent: 'bg-gray-400',
  in_kitchen: 'bg-amber-500',
  ready: 'bg-green-500',
  served: 'bg-slate-400',
  cancel_pending: 'bg-red-500',
  partial: 'bg-orange-500',
};

const KOT_STATUS_CLASS: Record<KotSummaryStatus, string> = {
  not_sent: 'text-gray-400',
  in_kitchen: 'text-amber-600',
  ready: 'text-green-600',
  served: 'text-slate-500',
  cancel_pending: 'text-red-600',
  partial: 'text-orange-600',
};

export function getOrderTypeStripeClass(orderType: string): string {
  return ORDER_TYPE_STRIPE[orderType] ?? 'border-gray-300';
}

export function getOrderStatusHeaderTint(status: string): string {
  return STATUS_HEADER_TINT[status] ?? 'bg-gray-50';
}

export function orderTypeKey(orderType: string): string {
  return orderType.toLowerCase().replace(/ /g, '_');
}

export function getKotStatusIcon(status: KotSummaryStatus): LucideIcon {
  return KOT_STATUS_ICON[status] ?? CircleDashed;
}

export function getKotStatusClass(status: KotSummaryStatus, delayed?: boolean): string {
  if (delayed) {
    return 'text-red-600 animate-pulse';
  }
  return KOT_STATUS_CLASS[status] ?? 'text-gray-500';
}

export function getKotStatusDotClass(status: KotSummaryStatus, delayed?: boolean): string {
  if (delayed) {
    return 'bg-red-500 animate-pulse';
  }
  return KOT_STATUS_DOT_CLASS[status] ?? 'bg-gray-400';
}

export function getKitchenRowsForOrder(
  order: Pick<POSInvoice, 'kot_stations' | 'kot_summary'>,
  billingStatus: string,
): KotStationStatus[] {
  if (!shouldShowKotRows(billingStatus, order.kot_summary)) {
    return [];
  }
  const stations = order.kot_stations ?? [];
  if (stations.length > 0) {
    return stations;
  }
  return [{ production: '', status: order.kot_summary ?? 'not_sent' }];
}

export function canModifyOrder(displayStatus: string): boolean {
  return displayStatus === 'Draft' || displayStatus === 'Unbilled' || displayStatus === 'Recently Paid';
}

export function getDisplayBillingStatus(
  order: Pick<POSInvoice, 'status' | 'invoice_printed' | 'restaurant_table'>,
  selectedStatus: string,
): string {
  if (selectedStatus === 'Unbilled') {
    return 'Unbilled';
  }
  if (selectedStatus === 'Draft' && order.status === 'Draft') {
    return 'Draft';
  }
  if (selectedStatus === 'Recently Paid') {
    return 'Recently Paid';
  }
  return order.status;
}

export function shouldShowKotRows(
  billingStatus: string,
  kotSummary?: KotSummaryStatus,
): boolean {
  if (!kotSummary) {
    return false;
  }
  if (billingStatus === 'Paid' || billingStatus === 'Consolidated' || billingStatus === 'Return') {
    return kotSummary !== 'not_sent';
  }
  return true;
}

export function mosaicUrlForStation(production: string): string {
  return `/URYMosaic/${encodeURIComponent(production)}`;
}

export type { OrderType, KotStationStatus, KotSummaryStatus };
