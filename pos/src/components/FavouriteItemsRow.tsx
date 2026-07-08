import { Heart } from 'lucide-react';
import { usePOSStore } from '../store/pos-store';
import { formatCurrency } from '../lib/utils';
import { t } from '../i18n';

interface FavouriteItemsRowProps {
  onItemClick: (item: ReturnType<typeof usePOSStore.getState>['menuItems'][0]) => void;
  disabled?: boolean;
}

const FavouriteItemsRow = ({ onItemClick, disabled }: FavouriteItemsRowProps) => {
  const { favouriteItems, menuItems } = usePOSStore();

  if (!favouriteItems.length) {
    return null;
  }

  const matches = favouriteItems
    .map((fav) => {
      const menuItem = menuItems.find(
        (item) => item.name === fav.item_name || item.item_name === fav.item_name,
      );
      return menuItem ? { fav, menuItem } : null;
    })
    .filter(Boolean) as Array<{
    fav: { item_name: string; qty: number };
    menuItem: (typeof menuItems)[0];
  }>;

  if (!matches.length) {
    return null;
  }

  return (
    <div className="border-b border-gray-200 bg-amber-50/60 px-3 py-2 sm:px-4">
      <div className="mx-auto max-w-screen-xl">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
          <Heart className="h-4 w-4" />
          {t('menu.favourites')}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {matches.map(({ menuItem }) => (
            <button
              key={menuItem.id}
              type="button"
              disabled={disabled}
              onClick={() => onItemClick(menuItem)}
              className="flex min-w-[8rem] flex-shrink-0 flex-col rounded-lg border border-amber-200 bg-white px-3 py-2 text-start shadow-sm transition hover:border-amber-300 active:scale-[0.98] disabled:opacity-50"
            >
              <span className="line-clamp-1 text-sm font-medium text-gray-900">{menuItem.name}</span>
              <span className="text-xs font-semibold tabular-nums text-primary">
                {formatCurrency(menuItem.price)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FavouriteItemsRow;
