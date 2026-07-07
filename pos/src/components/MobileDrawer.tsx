import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

const MobileDrawer = ({ open, onClose, children, title, className }: MobileDrawerProps) => (
  <>
    <div
      aria-hidden={!open}
      className={cn(
        'lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      onClick={onClose}
    />
    <div
      role="dialog"
      aria-modal={open}
      className={cn(
        'lg:hidden fixed inset-x-0 bottom-0 z-50 flex max-h-[min(88dvh,calc(100vh-3.5rem))] flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out',
        open ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        className,
      )}
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-1 w-10 rounded-full bg-gray-300 lg:hidden" />
          {title ? <h2 className="text-base font-semibold text-gray-900">{title}</h2> : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  </>
);

export default MobileDrawer;
