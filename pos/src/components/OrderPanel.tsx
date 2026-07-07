import { useState } from 'react';
import { Trash2, Edit, FrownIcon, Plus, Loader2, MessageSquare, ShoppingCart, ChevronUp } from 'lucide-react';
import { usePOSStore } from '../store/pos-store';
import { formatCurrency, cn } from '../lib/utils';
import { CustomerSelect } from './CustomerSelect';
import ProductDialog from './ProductDialog';
import OrderTypeSelect from './OrderTypeSelect';
import CommentDialog from './CommentDialog';
import MobileDrawer from './MobileDrawer';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import { syncOrder } from '../lib/order-api';
import { useRootStore } from '../store/root-store';
import type { RootState } from '../store/root-store';
import { showToast } from './ui/toast';
import { DINE_IN, DEFAULT_PAYMENT_MODE } from '../data/order-types';
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
    orderComment,
    setOrderComment
  } = usePOSStore();
  const user = useRootStore((state: RootState) => state.user);
  const [editingItem, setEditingItem] = useState<typeof activeOrders[0] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const handleSubmit = async () => {
    try {
      if (!posProfile) {
        throw new Error(t('errors.pos_profile_not_found'));
      }

      if (!user?.name) {
        throw new Error(t('errors.user_not_logged_in'));
      }

      if (selectedOrderType === 'Aggregators') {
        if (!selectedAggregator?.customer) {
          showToast.error(t('errors.select_aggregator'));
          return;
        }
      } else if (!selectedCustomer?.name) {
        showToast.error(t('errors.select_customer'));
        return;
      }

      if (selectedOrderType === DINE_IN && !selectedTable) {
        showToast.error(t('errors.select_table', { order_type: DINE_IN }));
        return;
      }

      if (activeOrders.length === 0) {
        showToast.error(t('errors.empty_cart'));
        return;
      }

      setIsSubmitting(true);
      
      const orderData = {
        items: activeOrders.map(item => ({
          item: item.id || item.item,
          item_name: item.name || item.item_name,
          rate: item.selectedVariant?.price || item.price,
          qty: item.quantity,
          comment: item.comment || undefined
        })),
        no_of_pax: 1,
        pos_profile: posProfile.name,
        order_type: selectedOrderType,
        table: selectedTable || undefined,
        room: selectedRoom || undefined,
        customer: selectedOrderType === 'Aggregators' ? selectedAggregator?.customer : selectedCustomer?.name,
        aggregator_id: selectedOrderType === 'Aggregators' ? selectedAggregator?.customer : undefined,
        cashier: posProfile.cashier || user.name,
        owner: posProfile.owner || posProfile.cashier || user.name,
        mode_of_payment: paymentModes[0] || DEFAULT_PAYMENT_MODE,
        last_invoice: isUpdatingOrder ? orderId : null,
        invoice: isUpdatingOrder ? orderId : null,
        waiter: user.name,
        comments: orderComment || undefined
      };

      await syncOrder(orderData);
      
      resetOrderState();
      setMobileOpen(false);
      showToast.success(isUpdatingOrder ? t('success.order_updated') : t('success.order_created'));
    } catch (error) {
      console.error('Failed to sync order:', error);
      const apiError = error as {
        _server_messages?: string;
        exception?: string;
        message?: string;
      };

      if (apiError._server_messages) {
        try {
          const messages = JSON.parse(apiError._server_messages);
          const messageObj = JSON.parse(messages[0]);
          showToast.error(messageObj.message || 'API error');
        } catch {
          showToast.error('API error');
        }
      } else if (apiError.exception) {
        const match = apiError.exception.match(/ValidationError: (.+)/);
        showToast.error(match?.[1] || apiError.exception);
      } else if (error instanceof Error) {
        showToast.error(error.message);
      } else {
        showToast.error(t('errors.failed_process_order'));
      }
    } finally {
      setIsSubmitting(false);
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
        {t('cart.double_click_hint')}
      </div>
    </div>
  );

  const LoadingOrderUI = () => (
    <div className="h-64 sm:h-96">
      <Spinner message={t('cart.loading_order')} />
    </div>
  );

  const PanelHeader = () => (
    <div className="flex-shrink-0 border-b border-gray-200 p-3 sm:p-4">
      <OrderTypeSelect disabled={isInteractionDisabled} />
      <div className="mt-3">
        <CustomerSelect disabled={isInteractionDisabled} />
      </div>
    </div>
  );

  const CartItems = () => (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6">
      {activeOrders.map((item) => (
        <div
          key={item.uniqueId}
          className={cn(
            'flex flex-col border-b border-gray-100 py-3 sm:py-4',
            isInteractionDisabled && 'opacity-50',
          )}
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
    <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCommentDialog(true)}
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 w-8 p-0',
              orderComment ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700',
            )}
            disabled={isInteractionDisabled}
            title={orderComment ? t('cart.edit_comment') : t('cart.add_comment')}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <span className="text-base font-semibold sm:text-lg">{t('cart.total')}</span>
        </div>
        <span className="text-base font-semibold sm:text-lg">{formatCurrency(total)}</span>
      </div>
      <Button
        onClick={handleSubmit}
        variant="default"
        size="default"
        className="w-full"
        disabled={isInteractionDisabled}
      >
        {isSubmitting ? (
          <div className="flex items-center">
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            {isUpdatingOrder ? t('cart.updating_order') : t('cart.processing_order')}
          </div>
        ) : isUpdatingOrder ? (
          t('cart.update_order')
        ) : (
          t('cart.add_new_order')
        )}
      </Button>
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
      <div className="fixed end-0 top-14 z-10 hidden h-[calc(100vh-3.5rem)] w-80 flex-col border-s border-gray-200 bg-white lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] lg:w-96">
        <PanelBody />
      </div>

      {/* Mobile cart bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-14 z-20 px-3 pb-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-600 px-4 py-3 text-white shadow-lg shadow-blue-600/25 transition-transform active:scale-[0.98]"
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
    </>
  );
};

export default OrderPanel;
