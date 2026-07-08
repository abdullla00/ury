import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';

interface OrderNotePopoverProps {
  label: string;
  text: string;
  icon: ReactNode;
  tone?: 'amber' | 'red';
}

export default function OrderNotePopover({
  label,
  text,
  icon,
  tone = 'amber',
}: OrderNotePopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="inline-flex items-center"
        aria-expanded={open}
        aria-controls={popoverId}
        title={text}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        {icon}
      </button>
      {open ? (
        <div
          id={popoverId}
          role="tooltip"
          className={cn(
            'absolute start-0 top-full z-30 mt-1 max-w-[14rem] rounded-lg border px-2.5 py-2 text-xs shadow-lg',
            tone === 'red'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-950',
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="mb-0.5 font-semibold">{label}</p>
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      ) : null}
    </div>
  );
}
