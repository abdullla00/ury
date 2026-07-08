import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../lib/utils';
import { getActiveDirection, t } from '../i18n';
import type { PosShiftGateContext } from '../lib/pos-opening-api';
import { markShiftWelcomed } from '../lib/pos-opening-api';

interface POSShiftWelcomeProps {
  context: PosShiftGateContext;
  onComplete: () => void;
}

const WELCOME_MS = 2000;

export default function POSShiftWelcome({ context, onComplete }: POSShiftWelcomeProps) {
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const summary = context.shift_summary;
  const entryId = summary?.opening_entry ?? context.stale_opening_entry ?? '';

  const finish = () => {
    markShiftWelcomed();
    onComplete();
  };

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      finish();
      return;
    }

    const start = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / WELCOME_MS) * 100);
      setProgress(pct);
      if (elapsed >= WELCOME_MS) {
        window.clearInterval(timer);
        finish();
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, []);

  const handleCopy = async () => {
    if (!entryId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(entryId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      dir={getActiveDirection()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      onClick={finish}
      aria-label={t('pos.shift_welcome.skip')}
    >
      <div className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-10 w-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{t('pos.shift_welcome.title')}</h1>
        <p className="mt-2 text-slate-600">{t('pos.shift_welcome.subtitle')}</p>
        <p className="mt-1 text-sm font-medium text-emerald-700">{t('pos.shift_welcome.start_orders')}</p>

        {entryId ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy();
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {t('pos.shift_welcome.opening_entry')}: {entryId}
          </button>
        ) : null}

        <div className="mt-4 space-y-1 text-sm text-slate-500">
          {context.branch ? <p>{context.branch}{context.room ? ` · ${context.room}` : ''}</p> : null}
          {summary?.posting_date ? <p>{summary.posting_date}</p> : null}
        </div>

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn('h-full bg-emerald-500 transition-all duration-100')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-slate-400">{t('pos.shift_welcome.skip')}</p>
      </div>
    </button>
  );
}
