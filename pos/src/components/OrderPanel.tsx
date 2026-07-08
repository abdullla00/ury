import { useState, useEffect, useCallback } from 'react';
import { Trash2, Edit, FrownIcon, Plus, Loader2, ShoppingCart, ChevronUp, Check, StickyNote } from 'lucide-react';
import { usePOSStore } from '../store/pos-store';
import { formatCurrency, cn } from '../lib/utils';
import { CustomerSelect } from './CustomerSelect';
import ProductDialog from './ProductDialog';
import OrderTypeSelect from './OrderTypeSelect';
import OrderContextBar from './OrderContextBar';
import CommentDialog from './CommentDialog';
import MobileDrawer from './MobileDrawer';
import CartActionsMenu from './CartActionsMenu';
import CartQuickActions from './CartQuickActions';
import PaymentScreen from './PaymentScreen';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import { syncOrder } from '../lib/order-api';
import { printOrder } from '../lib/print';
import { useRootStore } from '../store/root-store';
import type { RootState } from '../store/root-store';
import { showToast } from './ui/toast';
import { DINE_IN, DEFAULT_PAYMENT_MODE, isDefaultCustomerForType } from '../data/order-types';
import { t } from '../i18n';

const OrderPanel = () => {
  const { 
    activeOrders, 
    removeFromOrder, 
    updateQuantity, 
    clearOrder, 
    setSelectedItem,
    orderLoading,
    isOrderInteractionDisabled,
    isUpdatingOrder,
    posProfile,
    selectedOrderType,
    selectedTable,
    selectedRoom,
    selectedCustomer,
    selectedAggregator,
    resetOrderState,
    paymentModes,
    orderId,
    invoicePrinted,
    orderComment,
    setOrderComment,
    orderAllergyNote,
    setOrderAllergyNote,
    setOrderFromSync,
    noOfPax,
  } = usePOSStore();
  const user = useRootStore((state: RootState) => state.user);
  const [editingItem, setEditingItem] = useState<typeof activeOrders[0] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [showAllergyDialog, setShowAllergyDialog] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [customerExpanded, setCustomerExpanded] = useState(false);

  const calculateItemTotal = (item: typeof activeOrders[0]) => {
    const basePrice = item.selectedVariant?.price || item.price;
    const addonsTotal = item.selectedAddons?.reduce((sum, addon) => sum + addon.price, 0) || 0;
    return (basePrice + addonsTotal) * item.quantity;
  };

  const total = activeOrders.reduce(
    (sum, item) => sum + calculateItemTotal(item),
    0
  );

  const itemCount = activeOrders.reduce((sum, item) => sum + item.quantity, 0);

  const isDefaultCustomer = isDefaultCustomerForType(
    selectedCustomer?.name,
    selectedOrderType,
  );
  const showCustomerLink =
    selectedOrderType !== 'Aggregators' &&
    (isDefaultCustomer || !selectedCustomer?.name) &&
    !customerExpanded;

  useEffect(() => {
    setCustomerExpanded(false);
  }, [selectedOrderType]);

  const handleEdit = (item: typeof activeOrders[0]) => {
    const menuItem = {
      ...item,
      variants: item.variants,
      addons: item.addons,
    };
    setSelectedItem(menuItem);
    setEditingItem(item);
  };

  const handleCommentSave = (comment: string) => {
    setOrderComment(comment);
  };

  const validateOrder = (): boolean => {
    if (!posProfile) {
      showToast.error(t('errors.pos_profile_not_found'));
      return false;
    }
    if (!user?.name) {
      showToast.error(t('errors.user_not_logged_in'));
      return false;
    }
    if (selectedOrderType === 'Aggregators') {
      if (!selectedAggregator?.customer) {
        showToast.error(t('errors.select_aggregator'));
        return false;
      }
    } else if (!selectedCustomer?.name) {
      showToast.error(t('errors.select_customer'));
      return false;
    }
    if (selectedOrderType === DINE_IN && !selectedTable) {
      showToast.error(t('errors.select_table', { order_type: DINE_IN }));
      return false;
    }
    if (activeOrders.length === 0) {
      showToast.error(t('errors.empty_cart'));
      return false;
    }
    return true;
  };

  const buildKotItemName = (item: (typeof activeOrders)[number]) => {
    const baseName = item.name || item.item_name || '';
    const parts: string[] = [];
    if (item.selectedVariant?.name) {
      parts.push(item.selectedVariant.name);
    }
    if (item.selectedAddons?.length) {
      item.selectedAddons.forEach((addon) => parts.push(`+ ${addon.name}`));
    }
    if (!parts.length) return baseName;
    return `${baseName} (${parts.join(', ')})`;
  };

  const buildOrderData = () => ({
    items: activeOrders.map((item) => ({
      item: item.id || item.item,
      item_name: buildKotItemName(item),
      variant_label: item.selectedVariant?.name,
      addon_labels: item.selectedAddons?.map((a) => a.name),
      rate: item.selectedVariant?.price || item.price,
      qty: item.quantity,
      comment: item.comment || undefined,
    })),
    no_of_pax: noOfPax,
    pos_profile: posProfile!.name,
    order_type: selectedOrderType,
    table: selectedTable || undefined,
    room: selectedRoom || undefined,
    customer:
      selectedOrderType === 'Aggregators'
        ? selectedAggregator?.customer
        : selectedCustomer?.name,
    aggregator_id:
      selectedOrderType === 'Aggregators' ? selectedAggregator?.customer : undefined,
    cashier: posProfile!.cashier || user!.name,
    owner: posProfile!.owner || posProfile!.cashier || user!.name,
    mode_of_payment: paymentModes[0] || DEFAULT_PAYMENT_MODE,
    last_invoice: isUpdatingOrder ? orderId : null,
    invoice: isUpdatingOrder ? orderId : null,
    waiter: user!.name,
    comments: orderComment || undefined,
    allergy_note: orderAllergyNote || undefined,
  });

  const syncCart = async (options?: {
    resetAfter?: boolean;
    keepTable?: boolean;
    successKey?: string;
    showSuccessToast?: boolean;
  }) => {
    if (!validateOrder()) {
      return null;
    }

    setIsSubmitting(true);
    setCartError(null);
    try {
      const result = await syncOrder(buildOrderData());
      const invoice =
        (result as { message?: { name?: string } })?.message ??
        (result as { name?: string });
      const invoiceName =
        invoice && typeof invoice === 'object' && 'name' in invoice
          ? invoice.name
          : null;

      if (invoiceName) {
        setOrderFromSync(invoiceName);
      }

      if (options?.resetAfter) {
        resetOrderState({ keepTable: options.keepTable });
        setMobileOpen(false);
        setCustomerExpanded(false);
        if (options.showSuccessToast !== false) {
          showToast.success(
            options.successKey
              ? t(options.successKey)
              : isUpdatingOrder
                ? t('success.order_updated')
                : t('success.order_created'),
          );
        }
      } else {
        const kdsUnit = posProfile?.kds_production_unit;
        const mosaicUrl = kdsUnit
          ? `/URYMosaic/${encodeURIComponent(kdsUnit)}`
          : null;
        if (mosaicUrl) {
          showToast.successWithAction(t('cart.sent_to_kitchen'), {
            label: t('header.open_kds'),
            onClick: () => window.open(mosaicUrl, '_blank'),
          });
        } else {
          showToast.success(t('cart.sent_to_kitchen'));
        }
        setSendSuccess(true);
        window.setTimeout(() => setSendSuccess(false), 600);
      }

      return invoiceName;
    } catch (error) {
      console.error('Failed to sync order:', error);
      const apiError = error as {
        _server_messages?: string;
        exception?: string;
        message?: string;
      };
      let message = t('errors.failed_process_order');

      if (apiError._server_messages) {
        try {
          const messages = JSON.parse(apiError._server_messages);
          const messageObj = JSON.parse(messages[0]);
          message = messageObj.message || message;
        } catch {
          message = 'API error';
        }
      } else if (apiError.exception) {
        const match = apiError.exception.match(/ValidationError: (.+)/);
        message = match?.[1] || apiError.exception;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setCartError(message);
      showToast.error(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async () => {
    const invoiceName = await syncCart({
      resetAfter: true,
      keepTable: selectedOrderType === DINE_IN && Boolean(selectedTable),
      showSuccessToast: false,
    });
    if (!invoiceName) {
      return;
    }
    const kdsUnit = posProfile?.kds_production_unit;
    const mosaicUrl = kdsUnit
      ? `/URYMosaic/${encodeURIComponent(kdsUnit)}`
      : null;
    if (mosaicUrl) {
      showToast.successWithAction(t('cart.sent_to_kitchen'), {
        label: t('header.open_kds'),
        onClick: () => window.open(mosaicUrl, '_blank'),
      });
    } else {
      showToast.success(t('cart.sent_to_kitchen'));
    }
  };

  const handleOpenPayment = async () => {
    let invoice = orderId;
    if (!invoice) {
      invoice = await syncCart({ resetAfter: false });
    }
    if (!invoice || !posProfile) {
      return;
    }

    if (
      selectedTable &&
      selectedOrderType === DINE_IN &&
      invoicePrinted === 0
    ) {
      try {
        await printOrder({ orderId: invoice, posProfile });
        usePOSStore.setState({ invoicePrinted: 1 });
      } catch (err) {
        showToast.error(
          err instanceof Error ? err.message : t('errors.print_failed', { reason: '' }),
        );
        return;
      }
    }

    setShowPayment(true);
  };

  const openPaymentShortcut = useCallback(() => {
    if (activeOrders.length === 0) {
      return;
    }
    void handleOpenPayment();
  }, [activeOrders.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        openPaymentShortcut();
      }
    };
    const onOpenPayment = () => {
      openPaymentShortcut();
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('ury-open-payment', onOpenPayment);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('ury-open-payment', onOpenPayment);
    };
  }, [openPaymentShortcut]);

  useEffect(() => {
    const onClose = () => {
      setMobileOpen(false);
      setShowPayment(false);
    };
    window.addEventListener('ury-close-overlays', onClose);
    return () => window.removeEventListener('ury-close-overlays', onClose);
  }, []);

  const handlePrintBill = async () => {
    if (!orderId || !posProfile) {
      showToast.error(t('errors.no_active_order'));
      return;
    }
    try {
      await printOrder({ orderId, posProfile });
      usePOSStore.setState({ invoicePrinted: 1 });
      showToast.success(t('actions.print_bill_success'));
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : t('errors.print_failed', { reason: '' }));
    }
  };

  const isInteractionDisabled = isOrderInteractionDisabled() || isSubmitting;

  const EmptyCartUI = () => (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-8">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 sm:mb-6 sm:h-24 sm:w-24">
        <FrownIcon className="h-10 w-10 text-gray-400 sm:h-12 sm:w-12" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-gray-900 sm:text-lg">
        {t('cart.empty_title')}
      </h3>
      <p className="mb-4 max-w-xs text-sm leading-relaxed text-gray-500 sm:mb-6">
        {t('cart.empty_subtitle')}
      </p>
      <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-blue-600">
        <Plus className="h-4 w-4" />
        <span className="text-sm font-medium">{t('cart.click_to_add')}</span>
      </div>
      <div className="mt-3 text-xs text-gray-400 sm:mt-4">
        {t('cart.long_press_hint')}
      </div>
    </div>
  );

  const LoadingOrderUI = () => (
    <div className="h-64 sm:h-96">
      <Spinner message={t('cart.loading_order')} />
    </div>
  );

  const PanelHeader = () => (
    <div className="flex-shrink-0 border-b border-gray-200">
      <OrderContextBar />
      {cartError && (
        <div className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-4">
          {cartError}
        </div>
      )}
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{t('cart.order')}</span>
          <CartActionsMenu disabled={isInteractionDisabled} />
        </div>
        <OrderTypeSelect disabled={isInteractionDisabled} />
        {showCustomerLink && (
          <button
            type="button"
            className="mt-2 text-xs font-medium text-primary-700 hover:underline"
            onClick={() => setCustomerExpanded(true)}
            disabled={isInteractionDisabled}
          >
            {t('customer.add_customer')}
          </button>
        )}
        <div className={cn(showCustomerLink ? 'mt-0' : 'mt-3')}>
          <CustomerSelect
            disabled={isInteractionDisabled}
            expanded={customerExpanded}
            onExpandedChange={setCustomerExpanded}
          />
        </div>
      </div>
    </div>
  );

  const CartItems = () => (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6">
      {orderAllergyNote.trim() && (
        <button
          type="button"
          onClick={() => setShowAllergyDialog(true)}
          disabled={isInteractionDisabled}
          className="mb-3 flex w-full items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-start text-sm text-red-900 transition-colors hover:bg-red-100/80"
        >
          <span className="font-semibold">{t('cart.allergy_note')}:</span>
          <span className="line-clamp-3">{orderAllergyNote}</span>
        </button>
      )}
      {orderComment.trim() && (
        <button
          type="button"
          onClick={() => setShowCommentDialog(true)}
          disabled={isInteractionDisabled}
          className="mb-3 flex w-full items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-start text-sm text-amber-900 transition-colors hover:bg-amber-100/80"
        >
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="line-clamp-3">{orderComment}</span>
        </button>
      )}
      {activeOrders.map((item) => (
        <div
          key={item.uniqueId}
          className={cn(
            'flex flex-col border-b border-gray-100 py-3 sm:py-4',
            isInteractionDisabled && 'opacity-50',
          )}
          onTouchStart={(e) => {
            (e.currentTarget as HTMLElement & { _touchX?: number })._touchX = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const el = e.currentTarget as HTMLElement & { _touchX?: number };
            const startX = el._touchX;
            if (startX === undefined || isInteractionDisabled) {
              return;
            }
            const delta = e.changedTouches[0].clientX - startX;
            if (delta < -80) {
              removeFromOrder(item.uniqueId!);
            }
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-medium text-gray-900">{item.name}</h3>
              {item.selectedVariant && (
                <p className="text-sm text-gray-600">{item.selectedVariant.name}</p>
              )}
              {item.selectedAddons && item.selectedAddons.length > 0 && (
                <p className="text-sm text-gray-500">
                  {item.selectedAddons.map(addon => addon.name).join(', ')}
                </p>
              )}
              <p className="text-sm text-gray-600">{formatCurrency(calculateItemTotal(item))}</p>
              {item.comment?.trim() && (
                <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                  <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{item.comment}</span>
                </div>
              )}
            </div>

            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
              <Button
                onClick={() => handleEdit(item)}
                variant="ghost"
                size="icon"
                className="text-blue-600 hover:text-blue-700"
                title={t('cart.edit_item')}
                disabled={isInteractionDisabled}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  onClick={() => {
                    const newQuantity = Math.max(0, item.quantity - 1);
                    if (newQuantity === 0) {
                      removeFromOrder(item.uniqueId!);
                    } else {
                      updateQuantity(item.uniqueId!, newQuantity);
                    }
                  }}
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={isInteractionDisabled}
                >
                  -
                </Button>
                <span className="w-5 text-center text-sm sm:w-6">{item.quantity}</span>
                <Button
                  onClick={() => updateQuantity(item.uniqueId!, item.quantity + 1)}
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={isInteractionDisabled}
                >
                  +
                </Button>
              </div>
              <Button
                onClick={() => removeFromOrder(item.uniqueId!)}
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-600"
                disabled={isInteractionDisabled}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
      {activeOrders.length > 0 && (
        <Button
          onClick={clearOrder}
          variant="ghost"
          size="sm"
          className="mt-4 w-full text-gray-600 hover:text-gray-800"
          disabled={isInteractionDisabled}
        >
          {t('cart.clear_cart')}
        </Button>
      )}
    </div>
  );

  const PanelFooter = () => (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white">
      {activeOrders.length > 0 && (
        <CartQuickActions
          disabled={isInteractionDisabled}
          hasOrderNote={Boolean(orderComment.trim())}
          hasAllergyNote={Boolean(orderAllergyNote.trim())}
          canPrintBill={Boolean(orderId && posProfile)}
          showCustomer={selectedOrderType !== 'Aggregators'}
          onOrderNote={() => setShowCommentDialog(true)}
          onAllergyNote={() => setShowAllergyDialog(true)}
          onPrintBill={() => void handlePrintBill()}
          onCustomer={() => setCustomerExpanded(true)}
        />
      )}
      <div className="p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <span className="text-base font-semibold sm:text-lg">{t('cart.total')}</span>
        <span className="text-xl font-bold tabular-nums sm:text-2xl">{formatCurrency(total)}</span>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => void handleSend()}
          variant="outline"
          size="default"
          className={cn('min-h-[48px] flex-1', sendSuccess && 'border-emerald-500 bg-emerald-50 text-emerald-800')}
          disabled={isInteractionDisabled}
        >
          {isSubmitting ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : sendSuccess ? (
            <Check className="me-2 h-4 w-4" />
          ) : null}
          {sendSuccess ? t('cart.sent_to_kitchen') : t('cart.send_to_kitchen')}
        </Button>
        <Button
          onClick={() => void handleOpenPayment()}
          variant="default"
          size="default"
          className="min-h-[48px] flex-1"
          disabled={isInteractionDisabled}
        >
          {t('cart.payment')}
        </Button>
      </div>
      </div>
    </div>
  );

  const PanelBody = () => (
    <>
      <PanelHeader />
      {orderLoading ? (
        <LoadingOrderUI />
      ) : activeOrders.length === 0 ? (
        <EmptyCartUI />
      ) : (
        <>
          <CartItems />
          <PanelFooter />
        </>
      )}
    </>
  );

  return (
    <>
      {/* Desktop panel */}
      <div className="fixed end-0 top-14 z-10 hidden h-[calc(100vh-3.5rem)] w-80 flex-col border-s border-gray-200 bg-gray-50 lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] lg:w-[var(--cart-width)]">
        <PanelBody />
      </div>

      {/* Mobile cart bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-14 z-20 flex gap-2 px-3 pb-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="pointer-events-auto flex flex-1 items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-600 px-4 py-3 text-white shadow-lg shadow-blue-600/25 transition-transform active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -end-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-blue-600">
                  {itemCount}
                </span>
              )}
            </div>
            <div className="text-start">
              <p className="text-sm font-semibold">
                {itemCount > 0
                  ? t('cart.items_in_cart', { count: String(itemCount) })
                  : t('cart.view_cart')}
              </p>
              {itemCount > 0 && (
                <p className="text-xs text-blue-100">{formatCurrency(total)}</p>
              )}
            </div>
          </div>
          <ChevronUp className="h-5 w-5 flex-shrink-0" />
        </button>
        {itemCount > 0 && (
          <button
            type="button"
            onClick={() => void handleOpenPayment()}
            className="pointer-events-auto min-w-[5.5rem] rounded-2xl bg-white px-4 py-3 text-sm font-bold text-primary shadow-lg ring-1 ring-primary/20 active:scale-[0.98]"
          >
            {t('cart.payment')}
          </button>
        )}
      </div>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title={t('cart.view_cart')}
      >
        <PanelBody />
      </MobileDrawer>

      {editingItem && (
        <ProductDialog
          onClose={() => {
            setEditingItem(null);
            setSelectedItem(null);
          }}
          editMode
          initialVariant={editingItem.selectedVariant}
          initialAddons={editingItem.selectedAddons}
          initialQuantity={editingItem.quantity}
          itemToReplace={editingItem}
        />
      )}

      <CommentDialog
        isOpen={showCommentDialog}
        onClose={() => setShowCommentDialog(false)}
        onSave={handleCommentSave}
        initialComment={orderComment}
      />

      <CommentDialog
        isOpen={showAllergyDialog}
        onClose={() => setShowAllergyDialog(false)}
        onSave={setOrderAllergyNote}
        initialComment={orderAllergyNote}
        title={t('cart.allergy_note')}
      />

      {showPayment && orderId && posProfile && selectedCustomer && (
        <PaymentScreen
          onClose={() => setShowPayment(false)}
          grandTotal={total}
          roundedTotal={Math.round(total)}
          invoice={orderId}
          customer={
            selectedOrderType === 'Aggregators'
              ? selectedAggregator?.customer ?? ''
              : selectedCustomer.name
          }
          posProfile={posProfile.name}
          table={selectedTable}
          cashier={posProfile.cashier || user?.name || ''}
          owner={posProfile.owner || posProfile.cashier || user?.name || ''}
          clearSelectedOrder={() => {
            resetOrderState();
            setShowPayment(false);
            setMobileOpen(false);
          }}
        />
      )}
    </>
  );
};

export default OrderPanel;
