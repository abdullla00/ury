import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Send } from 'lucide-react';
import { getGuestTableMenu, guestSyncOrder } from '../lib/guest-order-api';
import type { GuestMenuItem } from '../lib/guest-order-api';
import { formatCurrency, cn } from '../lib/utils';
import { showToast } from '../components/ui/toast';
import GuestProductDialog, { type GuestCartLine } from '../components/GuestProductDialog';
import { t } from '../i18n';

const TableOrder = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tableName, setTableName] = useState('');
  const [kdsProductionUnit, setKdsProductionUnit] = useState('Kitchen');
  const [menuItems, setMenuItems] = useState<GuestMenuItem[]>([]);
  const [cart, setCart] = useState<GuestCartLine[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<GuestMenuItem | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        return;
      }
      try {
        const data = await getGuestTableMenu(token);
        setTableName(data.table);
        setMenuItems(data.menu);
        if (data.kds_production_unit) {
          setKdsProductionUnit(data.kds_production_unit);
        }
      } catch (e) {
        console.error(e);
        showToast.error(t('errors.invalid_guest_link'));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  const addLines = (lines: GuestCartLine[]) => {
    setCart((prev) => {
      const next = [...prev];
      for (const line of lines) {
        const existing = next.find((c) => c.item === line.item);
        if (existing) {
          existing.qty += line.qty;
        } else {
          next.push(line);
        }
      }
      return next;
    });
  };

  const addItem = (item: GuestMenuItem) => {
    if (item.has_modifiers) {
      setCustomizingItem(item);
      return;
    }
    addLines([
      {
        item: item.item,
        item_name: item.item_name,
        rate: typeof item.rate === 'string' ? parseFloat(item.rate) : item.rate,
        qty: 1,
        guest_label: 'Guest',
      },
    ]);
  };

  const total = cart.reduce((sum, item) => sum + item.rate * item.qty, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const handleSend = async () => {
    if (!token || cart.length === 0) {
      return;
    }
    setSubmitting(true);
    try {
      await guestSyncOrder(token, cart, note || undefined);
      setCart([]);
      setNote('');
      showToast.successWithAction(t('cart.sent_to_kitchen'), {
        label: t('header.open_kds'),
        onClick: () =>
          window.open(
            `/URYMosaic/${encodeURIComponent(kdsProductionUnit)}`,
            '_blank',
          ),
      });
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : t('errors.failed_process_order'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">
          {t('context.table')} {tableName}
        </h1>
        <p className="text-sm text-gray-500">{t('guest.subtitle')}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-40">
        <div className="grid grid-cols-2 gap-3">
          {menuItems.map((item) => (
            <button
              key={item.item}
              type="button"
              onClick={() => addItem(item)}
              className="flex min-h-[120px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-start shadow-sm active:scale-[0.98]"
            >
              {item.item_image ? (
                <img src={item.item_image} alt="" className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 items-center justify-center bg-gray-100 text-xs text-gray-400">
                  {item.item_name.slice(0, 2)}
                </div>
              )}
              <div className="flex flex-1 flex-col justify-between p-2">
                <span className="line-clamp-2 text-sm font-medium text-gray-900">
                  {item.item_name}
                </span>
                {item.has_modifiers && (
                  <span className="text-[10px] font-medium text-primary">{t('guest.customize')}</span>
                )}
                <span className="mt-1 text-sm font-semibold tabular-nums text-primary">
                  {formatCurrency(typeof item.rate === 'string' ? parseFloat(item.rate) : item.rate)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-gray-200 bg-white p-4 pb-safe">
        <textarea
          className="mb-3 w-full rounded-lg border border-gray-200 p-2 text-sm"
          rows={2}
          placeholder={t('guest.order_notes')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="mb-3 flex items-center justify-between text-sm">
          <span>{t('context.item_count', { count: itemCount })}</span>
          <span className="text-lg font-bold tabular-nums">{formatCurrency(total)}</span>
        </div>
        <button
          type="button"
          disabled={submitting || cart.length === 0}
          onClick={() => void handleSend()}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white',
            submitting || cart.length === 0 ? 'bg-gray-300' : 'bg-primary',
          )}
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {t('guest.review_and_send')}
        </button>
      </div>

      {customizingItem && (
        <GuestProductDialog
          menuItem={customizingItem}
          menuItems={menuItems}
          onClose={() => setCustomizingItem(null)}
          onAdd={addLines}
        />
      )}
    </div>
  );
};

export default TableOrder;
