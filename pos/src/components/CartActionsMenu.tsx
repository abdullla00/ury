import { useState } from 'react';
import {
  MoreHorizontal,
  X,
  DoorOpen,
  ArrowRightLeft,
  Printer,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { Button } from './ui/button';
import { usePOSStore } from '../store/pos-store';
import { useRootStore } from '../store/root-store';
import type { RootState } from '../store/root-store';
import { showToast } from './ui/toast';
import { cancelOrder, reprintKot } from '../lib/table-order-api';
import { printOrder } from '../lib/print';
import { t } from '../i18n';
import TableTransferDialog from './TableTransferDialog';
import CaptainTransferDialog from './CaptainTransferDialog';

interface CartActionsMenuProps {
  disabled?: boolean;
}

const CartActionsMenu = ({ disabled }: CartActionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCaptain, setShowCaptain] = useState(false);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const {
    activeOrders,
    orderId,
    selectedTable,
    selectedOrderType,
    releaseTable,
    resetOrderState,
    posProfile,
    hasTransferAccess,
  } = usePOSStore();
  const user = useRootStore((s: RootState) => s.user);
  const canTransfer = hasTransferAccess(user?.roles ?? []);

  const handleReleaseTable = () => {
    if (activeOrders.length > 0) {
      showToast.error(t('actions.release_table_blocked'));
      return;
    }
    releaseTable();
    setOpen(false);
    showToast.success(t('actions.table_released'));
  };

  const handleCancel = async () => {
    if (!orderId || !cancelReason.trim()) {
      showToast.error(t('errors.enter_cancel_reason'));
      return;
    }
    try {
      await cancelOrder(orderId, cancelReason.trim());
      resetOrderState();
      setShowCancelReason(false);
      setCancelReason('');
      setOpen(false);
      showToast.success(t('success.order_cancelled'));
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : t('errors.failed_cancel_order'));
    }
  };

  const handlePrintBill = async () => {
    if (!orderId || !posProfile) {
      return;
    }
    try {
      await printOrder({ orderId, posProfile });
      usePOSStore.setState({ invoicePrinted: 1 });
      showToast.success(t('actions.print_bill_success'));
      setOpen(false);
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : t('errors.print_failed'));
    }
  };

  const handleReprintKot = async () => {
    if (!orderId) {
      return;
    }
    try {
      await reprintKot(orderId);
      showToast.success(t('actions.reprint_kot_success'));
      setOpen(false);
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : t('errors.reprint_kot_failed'));
    }
  };

  const enableKotReprint = posProfile?.enable_kot_reprint === 1;

  if (!open) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onClick={() => setOpen(true)}
          title={t('actions.menu')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        {showTransfer && orderId && selectedTable && (
          <TableTransferDialog
            currentTable={selectedTable}
            invoiceId={orderId}
            onClose={() => setShowTransfer(false)}
          />
        )}
        {showCaptain && orderId && user?.name && (
          <CaptainTransferDialog
            invoiceId={orderId}
            currentCaptain={user.name}
            onClose={() => setShowCaptain(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="relative">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
        <X className="h-4 w-4" />
      </Button>
      <div className="absolute end-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
        {orderId && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => {
              if (orderId && !window.confirm(t('actions.cancel_kot_confirm'))) {
                return;
              }
              setShowCancelReason(true);
            }}
          >
            <X className="h-4 w-4 text-red-500" />
            {t('order.cancel_order')}
          </button>
        )}
        {orderId && selectedTable && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => void handlePrintBill()}
          >
            <Printer className="h-4 w-4" />
            {t('actions.print_bill')}
          </button>
        )}
        {orderId && enableKotReprint && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => void handleReprintKot()}
          >
            <RefreshCw className="h-4 w-4" />
            {t('actions.reprint_kot')}
          </button>
        )}
        {orderId && selectedTable && selectedOrderType === 'Dine In' && canTransfer && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => {
              setShowTransfer(true);
              setOpen(false);
            }}
          >
            <ArrowRightLeft className="h-4 w-4" />
            {t('actions.transfer_merge_table')}
          </button>
        )}
        {orderId && selectedOrderType === 'Dine In' && canTransfer && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => {
              setShowCaptain(true);
              setOpen(false);
            }}
          >
            <UserRound className="h-4 w-4" />
            {t('actions.captain_transfer')}
          </button>
        )}
        {selectedTable && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={handleReleaseTable}
          >
            <DoorOpen className="h-4 w-4" />
            {t('actions.release_table')}
          </button>
        )}
      </div>
      {showCancelReason && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
            <h3 className="mb-2 font-semibold">{t('order.cancel_order')}</h3>
            <textarea
              className="mb-3 w-full rounded border border-gray-200 p-2 text-sm"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('order.enter_cancel_reason')}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCancelReason(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => void handleCancel()}>
                {t('common.confirm_cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {showTransfer && orderId && selectedTable && (
        <TableTransferDialog
          currentTable={selectedTable}
          invoiceId={orderId}
          onClose={() => setShowTransfer(false)}
        />
      )}
      {showCaptain && orderId && user?.name && (
        <CaptainTransferDialog
          invoiceId={orderId}
          currentCaptain={user.name}
          onClose={() => setShowCaptain(false)}
        />
      )}
    </div>
  );
};

export default CartActionsMenu;
