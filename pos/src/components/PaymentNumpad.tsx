import { Delete } from 'lucide-react';
import { cn } from '../lib/utils';

interface PaymentNumpadProps {
  onKey: (key: string) => void;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

const PaymentNumpad = ({ onKey, disabled }: PaymentNumpadProps) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => onKey(key)}
          className={cn(
            'flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-900 shadow-sm transition active:scale-[0.97] hover:bg-slate-50 disabled:opacity-50 sm:h-14 sm:text-xl',
            key === 'back' && 'col-span-1',
          )}
        >
          {key === 'back' ? <Delete className="h-5 w-5 sm:h-6 sm:w-6" /> : key}
        </button>
      ))}
    </div>
  );
};

export default PaymentNumpad;
