import { Minus, Plus, Clock } from 'lucide-react';
import { usePOSStore } from '../store/pos-store';
import { formatCurrency, cn } from '../lib/utils';
import { DINE_IN, isDefaultCustomerForType } from '../data/order-types';
import { t } from '../i18n';
import { Button } from './ui/button';

const OrderContextBar = () => {
  const {
    selectedOrderType,
    selectedTable,
    selectedRoom,
    selectedCustomer,
    activeOrders,
    isUpdatingOrder,
    orderId,
    noOfPax,
    setNoOfPax,
    posProfile,
    orderStartedAt,
  } = usePOSStore();

  const itemCount = activeOrders.reduce((sum, item) => sum + item.quantity, 0);
  const total = activeOrders.reduce((sum, item) => {
    const basePrice = item.selectedVariant?.price || item.price;
    const addonsTotal = item.selectedAddons?.reduce((a, addon) => a + addon.price, 0) || 0;
    return sum + (basePrice + addonsTotal) * item.quantity;
  }, 0);

  const warnMinutes = posProfile?.kot_warning_time ?? 0;
  const kotDelayed =
    warnMinutes > 0 &&
    orderStartedAt &&
    Date.now() - new Date(orderStartedAt).getTime() > warnMinutes * 60 * 1000;

  const showEditing = isUpdatingOrder && Boolean(orderId);
  const hasRealCustomer =
    selectedCustomer?.name &&
    selectedOrderType &&
    !isDefaultCustomerForType(selectedCustomer.name, selectedOrderType);

  const metadataParts: string[] = [];

  if (selectedRoom && selectedOrderType === DINE_IN && selectedTable) {
    metadataParts.push(selectedRoom);
  }
  if (hasRealCustomer && selectedCustomer?.name) {
    metadataParts.push(selectedCustomer.name);
  }
  if (itemCount > 0) {
    metadataParts.push(t('context.item_count', { count: String(itemCount) }));
  }

  const shouldShow =
    showEditing ||
    kotDelayed ||
    itemCount > 0 ||
    metadataParts.length > 0;

  if (!shouldShow) {
    return null;
  }

  return (
    <div
      className={cn(
        'border-b border-gray-100 bg-gray-50 px-4 py-2.5 sm:px-6',
        'animate-in fade-in slide-in-from-top-1 duration-150',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {showEditing && orderId && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              {t('context.editing', { orderId })}
            </span>
          )}
          {kotDelayed && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
              <Clock className="h-3 w-3" />
              {t('context.kot_delayed', { minutes: String(warnMinutes) })}
            </span>
          )}
          {metadataParts.length > 0 && (
            <p className="min-w-0 text-sm text-gray-700">
              {metadataParts.map((part, index) => (
                <span key={`${part}-${index}`}>
                  {index > 0 && <span className="text-gray-300"> · </span>}
                  <span className="font-medium text-gray-800">{part}</span>
                </span>
              ))}
            </p>
          )}
          {selectedOrderType === DINE_IN && selectedTable && itemCount > 0 && (
            <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1 py-0.5">
              <span className="px-1 text-xs text-gray-600">{t('context.pax')}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setNoOfPax(noOfPax - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[1.25rem] text-center text-sm font-semibold">{noOfPax}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setNoOfPax(noOfPax + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {itemCount > 0 && (
          <span className="text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">
            {formatCurrency(total)}
          </span>
        )}
      </div>
    </div>
  );
};

export default OrderContextBar;
