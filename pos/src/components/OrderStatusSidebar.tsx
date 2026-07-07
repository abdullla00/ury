import { FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui';
import { getOrderStatusTypes, OrderStatusType } from '../data/order-types';
import { usePOSStore } from '../store/pos-store';
import { t } from '../i18n';

interface OrderStatusSidebarProps {
  disabled?: boolean;
  selectedStatus: OrderStatusType;
  setSelectedStatus: (status: OrderStatusType) => void;
  getStatusCount?: (status: OrderStatusType) => number;
}

const OrderStatusSidebar = ({ 
  disabled,
  selectedStatus,
  setSelectedStatus,
}: OrderStatusSidebarProps) => {
  const { posProfile } = usePOSStore();
  const statusTypes = getOrderStatusTypes(posProfile?.view_all_status, posProfile?.paid_limit);

  const stripButtonClass = (isActive: boolean) =>
    cn(
      'flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-all duration-200',
      isActive
        ? 'bg-blue-600 text-white shadow-sm'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    );

  const sidebarButtonClass = (isActive: boolean) =>
    cn(
      'w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative',
      isActive
        ? 'bg-white text-gray-900 shadow-sm font-semibold'
        : 'text-gray-700 hover:bg-white/60 hover:text-gray-900',
    );

  return (
    <>
      <div
        className={cn(
          'lg:hidden border-b border-gray-200 bg-white',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-3 py-2.5">
          {statusTypes.map((status) => (
            <Button
              key={status.value}
              onClick={() => setSelectedStatus(status.value as OrderStatusType)}
              variant="ghost"
              className={stripButtonClass(selectedStatus === status.value)}
              disabled={disabled}
            >
              <FileText className="h-4 w-4" />
              <span>{t(`order_status_types.${status.value.toLowerCase().replace(/ /g, '_')}`)}</span>
            </Button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          'hidden h-full w-56 flex-shrink-0 flex-col border-e border-gray-200 bg-white xl:w-64 lg:flex',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <nav className="flex-1 overflow-y-auto p-4 xl:p-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('orders.status_title')}
            </h2>
            <div className="space-y-1">
              {statusTypes.map((status) => (
                <Button
                  key={status.value}
                  onClick={() => setSelectedStatus(status.value as OrderStatusType)}
                  variant="ghost"
                  className={sidebarButtonClass(selectedStatus === status.value)}
                  disabled={disabled}
                >
                  {selectedStatus === status.value && (
                    <div className="absolute start-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-e-full bg-blue-600" />
                  )}
                  <div className="ms-1 flex items-center gap-3">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span>{t(`order_status_types.${status.value.toLowerCase().replace(/ /g, '_')}`)}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </>
  );
};

export default OrderStatusSidebar;
