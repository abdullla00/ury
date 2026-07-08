import { AlertTriangle, MessageSquare, Printer, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { t } from '../i18n';

interface CartQuickActionsProps {
  disabled?: boolean;
  hasOrderNote: boolean;
  hasAllergyNote?: boolean;
  canPrintBill: boolean;
  showCustomer: boolean;
  onOrderNote: () => void;
  onAllergyNote?: () => void;
  onPrintBill: () => void;
  onCustomer: () => void;
}

const actionButtonClass =
  'flex min-h-[40px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors active:scale-[0.98] sm:min-h-[44px] sm:text-xs';

const CartQuickActions = ({
  disabled,
  hasOrderNote,
  hasAllergyNote = false,
  canPrintBill,
  showCustomer,
  onOrderNote,
  onAllergyNote,
  onPrintBill,
  onCustomer,
}: CartQuickActionsProps) => (
  <div className="border-t border-gray-100 bg-gray-50/80 px-3 py-2 sm:px-4">
    <div
      className={cn(
        'grid gap-1.5',
        onAllergyNote ? 'grid-cols-2 sm:grid-cols-4' : showCustomer ? 'grid-cols-3' : 'grid-cols-2',
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onOrderNote}
        className={cn(
          actionButtonClass,
          hasOrderNote
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
        )}
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span className="truncate">{t('cart.order_note')}</span>
      </button>

      {onAllergyNote && (
        <button
          type="button"
          disabled={disabled}
          onClick={onAllergyNote}
          className={cn(
            actionButtonClass,
            hasAllergyNote
              ? 'border-red-300 bg-red-50 text-red-900'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('cart.allergy_note')}</span>
        </button>
      )}

      {showCustomer && (
        <button
          type="button"
          disabled={disabled}
          onClick={onCustomer}
          className={cn(actionButtonClass, 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')}
        >
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('cart.customer')}</span>
        </button>
      )}

      <button
        type="button"
        disabled={disabled || !canPrintBill}
        onClick={onPrintBill}
        className={cn(
          actionButtonClass,
          canPrintBill
            ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400',
        )}
      >
        <Printer className="h-4 w-4 shrink-0" />
        <span className="truncate">{t('actions.print_bill')}</span>
      </button>
    </div>
  </div>
);

export default CartQuickActions;
