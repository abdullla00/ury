import { Copy, ExternalLink, Printer } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { showToast } from './ui/toast';
import { t } from '../i18n';
import { mosaicUrlForStation } from '../lib/order-card-accent';
import { reprintKot } from '../lib/table-order-api';
import type { POSInvoice } from '../store/slices/orders-slice';

interface OrderCardQuickMenuProps {
  order: POSInvoice;
  anchor: { x: number; y: number };
  ordersKotOpensKds: boolean;
  enableKotReprint: boolean;
  onClose: () => void;
}

export default function OrderCardQuickMenu({
  order,
  anchor,
  ordersKotOpensKds,
  enableKotReprint,
  onClose,
}: OrderCardQuickMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [onClose]);

  const stations = order.kot_stations ?? [];
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(order.name);
      showToast.success(t('orders.copied_order'));
    } catch {
      showToast.error(t('errors.copy_failed'));
    }
    onClose();
  };

  const handleReprint = async () => {
    try {
      await reprintKot(order.name);
      showToast.success(t('actions.reprint_kot_success'));
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : t('errors.reprint_kot_failed'));
    }
    onClose();
  };

  const menuContent = (
    <div className="flex flex-col py-1">
      {ordersKotOpensKds && stations.length > 0
        ? stations.map((station) => (
            <button
              key={station.production}
              type="button"
              className="flex items-center gap-2 px-4 py-3 text-sm text-gray-800 hover:bg-gray-100 lg:py-2"
              onClick={() => {
                window.open(mosaicUrlForStation(station.production), '_blank', 'noopener,noreferrer');
                onClose();
              }}
            >
              <ExternalLink className="h-4 w-4" />
              {t('orders.open_kds_station', { station: station.production })}
            </button>
          ))
        : null}
      {enableKotReprint ? (
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-3 text-sm text-gray-800 hover:bg-gray-100 lg:py-2"
          onClick={() => void handleReprint()}
        >
          <Printer className="h-4 w-4" />
          {t('actions.reprint_kot')}
        </button>
      ) : null}
      <button
        type="button"
        className="flex items-center gap-2 px-4 py-3 text-sm text-gray-800 hover:bg-gray-100 lg:py-2"
        onClick={() => void copyOrder()}
      >
        <Copy className="h-4 w-4" />
        {t('orders.copy_order')}
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
        <div
          ref={ref}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white shadow-xl"
        >
          <div className="mx-auto my-2 h-1 w-10 rounded-full bg-gray-300" />
          {menuContent}
        </div>
      </>
    );
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-lg"
      style={{ left: anchor.x, top: anchor.y }}
    >
      {menuContent}
    </div>
  );
}
