import { NavLink } from 'react-router-dom';
import { 
  LayoutGrid, 
  ClipboardList, 
  Table,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { t } from '../i18n';

const Footer = () => {

  const navItems = [
    { icon: LayoutGrid, label: t('footer.pos'), path: '/' },
    {icon: Table, label: t('footer.table'), path: '/table'},
    { icon: ClipboardList, label: t('footer.orders'), path: '/orders' },
  ];

  return (
    <div className="relative border-t border-gray-200 bg-white pb-safe">
      <nav className="mx-auto max-w-screen-xl px-2 sm:px-4">
        <div className="flex items-center justify-around gap-1 py-1 sm:justify-center sm:gap-4 sm:py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex min-w-[4.5rem] flex-col items-center rounded-xl px-3 py-2.5 text-gray-700 transition-colors active:bg-gray-100 sm:min-w-0 sm:rounded-lg sm:p-2 sm:hover:bg-gray-100',
                  isActive && 'bg-blue-50 text-blue-600 sm:bg-transparent',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="mt-1 text-[11px] font-medium sm:text-xs">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Footer; 