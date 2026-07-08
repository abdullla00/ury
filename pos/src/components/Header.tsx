import { useState, useEffect, useRef } from 'react';
import { t } from '../i18n';
import { Link, useLocation } from 'react-router-dom';
import { 
  Command,
  User,
  ChevronDown,
  Monitor,
  LogOut,
  RefreshCw,
  Wallet,
  X,
  ChefHat,
} from 'lucide-react';
import { Button, Input } from './ui';
import { cn } from '../lib/utils';
import { useRootStore } from '../store/root-store';
import { usePOSStore } from '../store/pos-store';
import type { RootState } from '../store/root-store';
import { logout } from '../lib/auth-api';
import { showToast } from './ui/toast';
import { getPosShiftInfo, type PosShiftInfo } from '../lib/shift-api';
import { consumeShiftPillPulse } from '../lib/pos-opening-api';

const Header = () => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const user = useRootStore((state: RootState) => state.user);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const { posProfile, searchQuery, setSearchQuery } = usePOSStore();
  const { orderSearchQuery, setOrderSearchQuery } = useRootStore();
  const [orderSearchInput, setOrderSearchInput] = useState(orderSearchQuery);
  const [showLegacyBanner, setShowLegacyBanner] = useState(
    () => !localStorage.getItem('urypos_banner_dismissed'),
  );
  const [shiftInfo, setShiftInfo] = useState<PosShiftInfo | null>(null);
  const [shiftPillPulse, setShiftPillPulse] = useState(false);

  // Determine placeholder and handlers based on route
  let searchPlaceholder = t('header.search_placeholder_default');
  let searchValue: string | undefined = undefined;
  let searchOnChange: ((e: React.ChangeEvent<HTMLInputElement>) => void) | undefined = undefined;
  if (location.pathname === '/orders') {
    searchPlaceholder = t('header.search_placeholder_orders');
    searchValue = orderSearchInput;
    searchOnChange = (e) => setOrderSearchInput(e.target.value);
  } else if (location.pathname === '/') {
    searchPlaceholder = t('header.search_placeholder_menu');
    searchValue = searchQuery;
    searchOnChange = (e) => setSearchQuery(e.target.value);
  }

  // Debounce order search
  useEffect(() => {
    if (location.pathname !== '/orders') return;
    const handler = setTimeout(() => {
      setOrderSearchQuery(orderSearchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [orderSearchInput, setOrderSearchQuery, location.pathname]);

  // Keep input in sync with store (if cleared elsewhere)
  useEffect(() => {
    if (location.pathname === '/orders') {
      setOrderSearchInput(orderSearchQuery);
    }
  }, [location.pathname, orderSearchQuery]);

  useEffect(() => {
    if (!posProfile?.branch) {
      return;
    }
    getPosShiftInfo()
      .then(setShiftInfo)
      .catch(() => setShiftInfo({ status: 'closed' }));
  }, [posProfile?.branch]);

  useEffect(() => {
    if (consumeShiftPillPulse()) {
      setShiftPillPulse(true);
      const timer = window.setTimeout(() => setShiftPillPulse(false), 2000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const onFocusSearch = () => searchInputRef.current?.focus();
    window.addEventListener('ury-focus-search', onFocusSearch);
    return () => window.removeEventListener('ury-focus-search', onFocusSearch);
  }, []);

  // Handle clicks outside of menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        window.location.href = '/pos/table';
      }
      if (e.key === 'F2' && location.pathname === '/') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('ury-open-payment'));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [location.pathname]);

  const handleUserMenuToggle = () => {
    setShowUserMenu(!showUserMenu);
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login?redirect-to=%2Fpos';
    } catch (error) {
      showToast.error(t('errors.failed_logout'));
    }
  };

  const handleClearCache = () => {
    // Clear all local storage
    localStorage.clear();
    // Clear all session storage
    sessionStorage.clear();
    // Reload the page
    window.location.reload();
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      {showLegacyBanner && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:px-6">
          <span>{t('header.urypos_deprecation')}</span>
          <button
            type="button"
            className="rounded p-1 hover:bg-amber-100"
            onClick={() => {
              localStorage.setItem('urypos_banner_dismissed', '1');
              setShowLegacyBanner(false);
            }}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6">
        <div className="flex flex-shrink-0 items-center">
          <Link to="/" className="flex items-center gap-2 sm:gap-3">
            <img 
              src="/assets/ury/pos/ury_pos.png" 
              alt="URY POS" 
              className="h-8 w-auto sm:h-10"
            />
          </Link>
        </div>

        <div className="mx-1 flex min-w-0 flex-1 items-center rounded-md border border-input bg-gray-50 px-3 py-2 hover:bg-gray-100 sm:mx-4 sm:max-w-2xl sm:px-4">
          <Input
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            className="h-fit w-full min-w-0 border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            value={searchValue}
            onChange={searchOnChange}
          />
          <div className="hidden flex-shrink-0 items-center gap-2 text-gray-400 sm:flex">
            <Command className="h-4 w-4" />
            <span>K</span>
          </div>
        </div>

        {posProfile?.kds_production_unit && (
          <a
            href={`/URYMosaic/${encodeURIComponent(posProfile.kds_production_unit)}`}
            target="_blank"
            rel="noreferrer"
            title={`${t('header.open_kds')} — ${posProfile.kds_production_unit}`}
            className="me-2 hidden items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-800 md:inline-flex"
          >
            <ChefHat className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline">{t('header.open_kds')}</span>
          </a>
        )}

        {shiftInfo && (
          <button
            type="button"
            onClick={() => {
              if (shiftInfo.status === 'open' && shiftInfo.opening_entry) {
                window.open(
                  `/app/pos-opening-entry/${encodeURIComponent(shiftInfo.opening_entry)}`,
                  '_blank',
                );
              } else if (posProfile?.multiple_cashier === 1) {
                window.open('/app/sub-pos-closing', '_blank');
              }
            }}
            className={cn(
              'relative me-2 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium md:flex',
              shiftInfo.status === 'open'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-red-50 text-red-700',
            )}
            title={posProfile?.name}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {shiftPillPulse ? (
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                    shiftInfo.status === 'open' ? 'bg-emerald-400' : 'bg-red-400',
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  'relative inline-flex h-2 w-2 rounded-full',
                  shiftInfo.status === 'open' ? 'bg-emerald-500' : 'bg-red-500',
                )}
              />
            </span>
            <span className="max-w-[10rem] truncate">
              {shiftInfo.status === 'open'
                ? `${t('header.shift_open')} · ${shiftInfo.opening_entry}`
                : t('header.shift_closed')}
            </span>
          </button>
        )}

        <div className="flex flex-shrink-0 items-center">
          <div className="relative" ref={userMenuRef}>
            <Button
              onClick={handleUserMenuToggle}
              variant="ghost"
              className="flex items-center gap-1 px-2 text-gray-600 hover:text-gray-900 sm:gap-2 sm:px-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="hidden max-w-[8rem] truncate text-sm font-medium md:inline">
                {user?.full_name || 'User'}
              </span>
              <ChevronDown className="hidden h-4 w-4 sm:inline" />
            </Button>

            {/* User dropdown */}
            {showUserMenu && (
              <div className="absolute end-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{user?.full_name || 'User'}</p>
                  <p className="text-sm text-gray-500">{user?.name || ''}</p>
                </div>
                <div className="py-2">
                  {posProfile?.multiple_cashier === 1 && (
                    <Button
                      variant="ghost"
                      className="flex w-full items-center justify-start px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                      onClick={() => window.open('/app/sub-pos-closing', '_blank')}
                    >
                      <Wallet className="me-3 h-4 w-4" />
                      {t('header.sub_pos_closing')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="flex w-full items-center justify-start px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                    onClick={() => {
                      window.location.href = '/app';
                    }}
                  >
                    <Monitor className="w-4 h-4 me-3" />
                    {t('header.switch_to_desk')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex justify-start items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    onClick={handleClearCache}
                  >
                    <RefreshCw className="w-4 h-4 me-3" />
                    {t('header.clear_cache')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex justify-start items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 me-3" />
                    {t('header.logout')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 