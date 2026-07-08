import { useEffect, useRef, useState } from 'react';
import { usePOSStore } from '../store/pos-store';
import { useRootStore } from '../store/root-store';
import { cn } from '../lib/utils';
import TableSelectionDialog from './TableSelectionDialog';
import { DEFAULT_ORDER_TYPE, DINE_IN, ORDER_TYPES, type OrderType } from '../data/order-types';
import { isUserRestrictedFromTableOrders } from '../lib/role-utils';
import { t } from '../i18n';

interface OrderTypeSelectProps {
  disabled?: boolean;
}

const OrderTypeSelect = ({ disabled }: OrderTypeSelectProps) => {
  const {
    selectedOrderType,
    setSelectedOrderType,
    isUpdatingOrder,
    posProfile,
    selectedTable,
    tabName,
  } = usePOSStore();
  const { user } = useRootStore();
  const [showTableDialog, setShowTableDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [showRightFade, setShowRightFade] = useState(false);

  const isRestrictedFromTableOrders = isUserRestrictedFromTableOrders(user, posProfile);

  const updateFade = () => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setShowRightFade(el.scrollWidth > el.clientWidth + el.scrollLeft + 4);
  };

  useEffect(() => {
    updateFade();
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.addEventListener('scroll', updateFade);
    window.addEventListener('resize', updateFade);
    return () => {
      el.removeEventListener('scroll', updateFade);
      window.removeEventListener('resize', updateFade);
    };
  }, []);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
    updateFade();
  }, [selectedOrderType]);

  const handleOrderTypeSelect = (type: OrderType) => {
    if (type === DINE_IN && isRestrictedFromTableOrders) {
      return;
    }

    if (type === DINE_IN && selectedOrderType === DINE_IN && selectedTable) {
      setShowTableDialog(true);
      return;
    }

    setSelectedOrderType(type);
    if (type === DINE_IN) {
      setShowTableDialog(true);
    }
  };

  const handleTableDialogClose = () => {
    setShowTableDialog(false);
    setTimeout(() => {
      const currentState = usePOSStore.getState();
      if (currentState.selectedOrderType === DINE_IN && !currentState.selectedTable) {
        setSelectedOrderType(DEFAULT_ORDER_TYPE);
      }
    }, 100);
  };

  const getSubtitle = (value: OrderType, isSelected: boolean): string | null => {
    if (!isSelected) {
      return null;
    }
    if (value === DINE_IN && selectedTable) {
      return selectedTable;
    }
    if (tabName) {
      return tabName;
    }
    return null;
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        role="tablist"
        aria-label={t('cart.order')}
        className="scrollbar-hide flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-lg bg-gray-100 p-1"
      >
        {ORDER_TYPES.map(({ value, icon: Icon }) => {
          const isDineIn = value === DINE_IN;
          const isDisabled =
            disabled || (isDineIn && isRestrictedFromTableOrders) || isUpdatingOrder;
          const isSelected = selectedOrderType === value;
          const subtitle = getSubtitle(value, isSelected);

          return (
            <button
              key={value}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => handleOrderTypeSelect(value)}
              disabled={isDisabled}
              title={
                isDineIn && isRestrictedFromTableOrders
                  ? t('errors.dine_in_restricted')
                  : subtitle
                    ? `${t(`order_types.${value.toLowerCase().replace(/ /g, '_')}`)} — ${subtitle}`
                    : undefined
              }
              className={cn(
                'flex min-h-[44px] min-w-[5.75rem] flex-shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.98] sm:text-sm',
                isSelected
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-700 hover:bg-white/80',
                isDisabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap leading-tight">
                  {t(`order_types.${value.toLowerCase().replace(/ /g, '_')}`)}
                </span>
              </span>
              {subtitle && (
                <span
                  className={cn(
                    'max-w-[5.5rem] truncate text-[10px] font-semibold leading-tight',
                    isSelected ? 'opacity-90' : 'text-gray-500',
                  )}
                >
                  {subtitle}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {showRightFade && (
        <div
          className="pointer-events-none absolute inset-y-0 end-0 w-8 rounded-e-lg bg-gradient-to-l from-gray-100 to-transparent"
          aria-hidden
        />
      )}

      {showTableDialog && <TableSelectionDialog onClose={handleTableDialogClose} />}
    </div>
  );
};

export default OrderTypeSelect;
