import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { db } from '../lib/frappe-sdk';
import { formatCurrency, cn } from '../lib/utils';
import { t } from '../i18n';
import type { GuestMenuItem } from '../lib/guest-order-api';

export interface GuestCartLine {
  item: string;
  item_name: string;
  rate: number;
  qty: number;
  comment?: string;
  guest_label?: string;
}

interface GuestProductDialogProps {
  menuItem: GuestMenuItem;
  menuItems: GuestMenuItem[];
  onClose: () => void;
  onAdd: (lines: GuestCartLine[]) => void;
}

const GuestProductDialog = ({ menuItem, menuItems, onClose, onAdd }: GuestProductDialogProps) => {
  const [selectedItem, setSelectedItem] = useState(menuItem);
  const [selectedAddons, setSelectedAddons] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [variantOptions, setVariantOptions] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [addonOptions, setAddonOptions] = useState<Array<{ id: string; name: string; price: number }>>([]);

  useEffect(() => {
    async function loadModifiers() {
      setLoading(true);
      try {
        const doc = await db.getDoc('Item', selectedItem.item);
        const variants = Array.isArray(doc.custom_pos_item_variants)
          ? doc.custom_pos_item_variants
              .map((row: { item: string }) => menuItems.find((m) => m.item === row.item))
              .filter(Boolean)
              .map((m: GuestMenuItem) => ({
                id: m.item,
                name: m.item_name,
                price: typeof m.rate === 'string' ? parseFloat(m.rate) : m.rate,
              }))
          : [];
        const addons = Array.isArray(doc.custom_pos_add_on_items)
          ? doc.custom_pos_add_on_items
              .map((row: { item: string }) => menuItems.find((m) => m.item === row.item))
              .filter(Boolean)
              .map((m: GuestMenuItem) => ({
                id: m.item,
                name: m.item_name,
                price: typeof m.rate === 'string' ? parseFloat(m.rate) : m.rate,
              }))
          : [];
        setVariantOptions(variants);
        setAddonOptions(addons);
      } finally {
        setLoading(false);
      }
    }
    void loadModifiers();
  }, [selectedItem.item, menuItems]);

  const baseRate =
    typeof selectedItem.rate === 'string' ? parseFloat(selectedItem.rate) : selectedItem.rate;
  const addonsTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
  const lineTotal = (baseRate + addonsTotal) * quantity;

  const handleAdd = () => {
    const lines: GuestCartLine[] = [
      {
        item: selectedItem.item,
        item_name: selectedItem.item_name,
        rate: baseRate,
        qty: quantity,
        guest_label: 'Guest',
      },
      ...selectedAddons.map((addon) => ({
        item: addon.id,
        item_name: addon.name,
        rate: addon.price,
        qty: quantity,
        guest_label: 'Guest',
      })),
    ];
    onAdd(lines);
    onClose();
  };

  const toggleAddon = (addon: { id: string; name: string; price: number }) => {
    setSelectedAddons((current) =>
      current.some((a) => a.id === addon.id)
        ? current.filter((a) => a.id !== addon.id)
        : [...current, addon],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold">{selectedItem.item_name}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : (
            <>
              {variantOptions.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 text-sm font-semibold">{t('product_dialog.variants')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {variantOptions.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          const next = menuItems.find((m) => m.item === variant.id);
                          if (next) {
                            setSelectedItem(next);
                          }
                        }}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm',
                          selectedItem.item === variant.id
                            ? 'border-primary bg-primary-50 text-primary-800'
                            : 'border-gray-200',
                        )}
                      >
                        {variant.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {addonOptions.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 text-sm font-semibold">{t('product_dialog.addons')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {addonOptions.map((addon) => (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm',
                          selectedAddons.some((a) => a.id === addon.id)
                            ? 'border-primary bg-primary-50 text-primary-800'
                            : 'border-gray-200',
                        )}
                      >
                        {addon.name} (+{formatCurrency(addon.price)})
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('product_dialog.quantity')}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="h-9 w-9 rounded-lg border border-gray-200"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center font-semibold">{quantity}</span>
                  <button
                    type="button"
                    className="h-9 w-9 rounded-lg border border-gray-200"
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="border-t border-gray-200 p-4">
          <button
            type="button"
            disabled={loading}
            onClick={handleAdd}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-50"
          >
            {t('product_dialog.add_to_order')} · {formatCurrency(lineTotal)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestProductDialog;
