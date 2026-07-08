import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClipboardList, LayoutGrid, Table } from 'lucide-react';
import { cn } from '../lib/utils';
import { t } from '../i18n';
import { usePOSStore } from '../store/pos-store';
import { getOccupiedTableCount } from '../lib/shift-api';
import { Badge } from './ui/badge';

const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { posProfile } = usePOSStore();
  const [occupiedCount, setOccupiedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!posProfile?.branch) {
      return;
    }
    const load = () => {
      getOccupiedTableCount()
        .then(setOccupiedCount)
        .catch(() => setOccupiedCount(null));
    };
    load();
    const interval = window.setInterval(load, 60000);
    return () => window.clearInterval(interval);
  }, [posProfile?.branch, location.pathname]);

  const handleNavigate = (path: string, end?: boolean) => {
    const isActive = end ? location.pathname === path : location.pathname.startsWith(path);
    if (isActive) {
      return;
    }
    navigate(path);
  };

  const navItems = [
    { icon: Table, label: t('footer.table'), path: '/table', badge: occupiedCount },
    { icon: LayoutGrid, label: t('footer.pos'), path: '/', end: true, center: true },
    { icon: ClipboardList, label: t('footer.orders'), path: '/orders' },
  ] as const;

  return (
    <div className="relative border-t border-gray-200 bg-white pb-safe">
      <nav className="mx-auto max-w-screen-xl px-2 sm:px-4">
        <div className="flex items-stretch justify-around gap-1 py-0 sm:justify-center sm:gap-2">
          {navItems.map((item) => {
            const isActive = item.end
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleNavigate(item.path, item.end)}
                className={cn(
                  'relative flex min-h-[var(--touch-min)] min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-t-xl px-3 py-2 text-gray-600 transition-all duration-150 active:scale-[0.98] sm:min-w-[5.5rem] sm:flex-none sm:px-5',
                  isActive &&
                    'border-t-2 border-primary bg-primary-50/50 font-semibold text-primary-700',
                  item.center && isActive && 'sm:scale-[1.02]',
                )}
              >
                <item.icon
                  className={cn('h-5 w-5 transition-colors', isActive && 'text-primary')}
                  strokeWidth={isActive ? 2.25 : 2}
                />
                <span className="mt-1 text-[11px] font-medium sm:text-xs">{item.label}</span>
                {'badge' in item && typeof item.badge === 'number' && item.badge > 0 && (
                  <Badge
                    variant="warning"
                    className="absolute end-2 top-1 min-w-[1.25rem] px-1 text-[10px]"
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Footer;
