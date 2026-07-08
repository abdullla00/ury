import React, { useRef } from 'react';
import { AlertTriangle, StickyNote } from 'lucide-react';
import { Badge, Card, CardContent } from './ui';
import KotStatusIndicator from './KotStatusIndicator';
import OrderNotePopover from './OrderNotePopover';
import { cn, formatCurrency } from '../lib/utils';
import { t } from '../i18n';
import {
  getDisplayBillingStatus,
  getKitchenRowsForOrder,
  getKotStatusClass,
  getOrderStatusHeaderTint,
  getOrderTypeStripeClass,
  mosaicUrlForStation,
  orderTypeKey,
} from '../lib/order-card-accent';
import type { KotStationStatus, POSInvoice } from '../store/slices/orders-slice';

interface OrderListCardProps {
  order: POSInvoice;
  selectedStatus: string;
  isSelected: boolean;
  ordersKotOpensKds: boolean;
  onSelect: (order: POSInvoice) => void;
  onLongPress: (order: POSInvoice, anchor: { x: number; y: number }) => void;
  getBadgeVariant: (status: string) => 'default' | 'secondary' | 'destructive';
}

const LONG_PRESS_MS = 500;
const LONG_PRESS_CLICK_GUARD_MS = 400;

export default function OrderListCard({
  order,
  selectedStatus,
  isSelected,
  ordersKotOpensKds,
  onSelect,
  onLongPress,
  getBadgeVariant,
}: OrderListCardProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressAt = useRef(0);
  const displayStatus = getDisplayBillingStatus(order, selectedStatus);
  const kotRows = getKitchenRowsForOrder(order, displayStatus);
  const showMultiStation = kotRows.length > 1;

  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const fireLongPress = (anchor: { x: number; y: number }) => {
    longPressAt.current = Date.now();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    onLongPress(order, anchor);
  };

  const handleCardClick = () => {
    if (Date.now() - longPressAt.current < LONG_PRESS_CLICK_GUARD_MS) {
      return;
    }
    onSelect(order);
  };

  const handleKotRowClick = (e: React.MouseEvent, station: KotStationStatus) => {
    if (!ordersKotOpensKds || !station.production) {
      return;
    }
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    window.open(mosaicUrlForStation(station.production), '_blank', 'noopener,noreferrer');
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    fireLongPress({ x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    pressTimer.current = setTimeout(() => {
      fireLongPress({ x: touch.clientX, y: touch.clientY });
    }, LONG_PRESS_MS);
  };

  const renderKotLine = (station: KotStationStatus, index: number) => {
    const statusLabel = t(`kot_status.${station.status}`);
    const label = showMultiStation && station.production
      ? `${station.production} · ${statusLabel}`
      : statusLabel;

    return (
      <button
        key={`${station.production}-${index}`}
        type="button"
        className={cn(
          'flex min-h-[44px] w-full items-center gap-2 rounded-md px-1 py-1.5 text-start text-xs',
          ordersKotOpensKds && station.production && 'hover:bg-gray-100',
        )}
        onClick={(e) => handleKotRowClick(e, station)}
        disabled={!ordersKotOpensKds || !station.production}
      >
        <KotStatusIndicator status={station.status} delayed={order.kot_delayed} />
        <span className={cn('truncate', getKotStatusClass(station.status, order.kot_delayed))}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <Card
      className={cn(
        'flex cursor-pointer flex-col overflow-hidden rounded-xl border shadow-sm border-inline-start-4 bg-white p-0 transition-all hover:-translate-y-0.5 hover:shadow-md',
        getOrderTypeStripeClass(order.order_type),
        isSelected && 'ring-2 ring-primary',
      )}
      onClick={handleCardClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearPressTimer}
      onTouchMove={clearPressTimer}
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        pressTimer.current = setTimeout(() => {
          fireLongPress({ x: e.clientX, y: e.clientY });
        }, LONG_PRESS_MS);
      }}
      onMouseUp={clearPressTimer}
      onMouseLeave={clearPressTimer}
    >
      <CardContent className="flex h-full flex-col p-0">
        <div className={cn('border-b px-3 py-2', getOrderStatusHeaderTint(displayStatus))}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate text-sm font-medium text-gray-900" title={order.name}>
                {order.name}
              </h3>
              {order.custom_comments ? (
                <OrderNotePopover
                  label={t('orders.order_note')}
                  text={order.custom_comments}
                  tone="amber"
                  icon={<StickyNote className="h-3.5 w-3.5 text-amber-500" />}
                />
              ) : null}
              {order.custom_allergy_note ? (
                <OrderNotePopover
                  label={t('orders.allergy_note')}
                  text={order.custom_allergy_note}
                  tone="red"
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                />
              ) : null}
            </div>
            <Badge variant={getBadgeVariant(displayStatus)} className="shrink-0">
              {t(`order_status_types.${displayStatus.toLowerCase().replace(/ /g, '_')}`)}
            </Badge>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-gray-500">
              {order.restaurant_table
                ? `${t('context.table')} ${order.restaurant_table} · `
                : ''}
              {t(`order_types.${orderTypeKey(order.order_type)}`)}
            </p>
            {order.kot_modified ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                MOD
              </span>
            ) : null}
          </div>
        </div>

        {kotRows.length > 0 ? (
          <div className="border-b px-2 py-1">{kotRows.map(renderKotLine)}</div>
        ) : null}

        <div className="flex items-center justify-end px-3 py-2 text-xs text-gray-500">
          <span className="font-semibold tabular-nums text-gray-900">
            {order.item_count != null ? `${order.item_count} ${t('orders.items_label')} · ` : ''}
            {formatCurrency(order.rounded_total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
