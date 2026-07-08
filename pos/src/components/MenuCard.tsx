import { FC } from 'react';
import { formatCurrency, cn } from '../lib/utils';
import { t } from '../i18n';

interface MenuCardProps {
  id: string;
  name: string;
  price: number;
  item_image: string | null;
  course?: string;
  item: string;
  hasModifiers?: boolean;
  onClick?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}

const MenuCard: FC<MenuCardProps> = ({
  name,
  price,
  item_image,
  course,
  onClick,
  onLongPress,
  hasModifiers = false,
  disabled,
}) => {
  const handlePointerDown = () => {
    if (!onLongPress || disabled) {
      return;
    }
    const timer = window.setTimeout(() => {
      onLongPress();
    }, 500);
    const clear = () => window.clearTimeout(timer);
    window.addEventListener('pointerup', clear, { once: true });
    window.addEventListener('pointercancel', clear, { once: true });
  };

  return (
    <div
      className={cn(
        'flex h-52 cursor-pointer flex-col overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md active:scale-[0.97]',
        disabled && 'pointer-events-none cursor-not-allowed opacity-50',
      )}
      onClick={disabled ? undefined : onClick}
      onContextMenu={(e) => {
        if (onLongPress && !disabled) {
          e.preventDefault();
          onLongPress();
        }
      }}
      onPointerDown={handlePointerDown}
    >
      <div className="relative h-[60%] min-h-[7rem]">
        {item_image ? (
          <img
            src={item_image}
            alt={name}
            className="h-full w-full object-cover"
            style={{ filter: 'saturate(0.7) brightness(0.95)' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const placeholder = document.createElement('div');
                placeholder.className =
                  'flex h-full w-full items-center justify-center bg-gray-200 text-2xl font-medium text-gray-400';
                placeholder.textContent = name.slice(0, 2).toUpperCase();
                parent.insertBefore(placeholder, target);
              }
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-2xl font-medium text-gray-400">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="absolute bottom-2 end-2 rounded-md bg-black/70 px-2 py-0.5 text-sm font-bold tabular-nums text-white shadow">
          {formatCurrency(price)}
        </span>
        {hasModifiers && (
          <span
            className="absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow"
            title={t('menu.customize_hint')}
          >
            +
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-gray-900" title={name}>
          {name}
        </h3>
        <div className="mt-1 h-5">
          <p className="truncate text-xs text-gray-500" title={course}>
            {course || ' '}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MenuCard;
