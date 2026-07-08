import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  DoorOpen,
  FileWarning,
  Loader2,
  Mail,
  Monitor,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Button } from './ui';
import { cn, formatCurrency } from '../lib/utils';
import { getActiveDirection, t } from '../i18n';
import { useFocusTrap } from '../hooks/use-focus-trap';
import type { PosShiftGateContext, PosShiftScenario } from '../lib/pos-opening-api';

interface POSShiftGateProps {
  context: PosShiftGateContext;
  onCheckAgain: () => void;
  isChecking: boolean;
  errorMessage?: string | null;
  errorTimestamp?: Date | null;
  sessionExpired?: boolean;
  retryBackoffSeconds?: number;
}

const POLL_MS = 15000;
const LOGO_URL = '/assets/ury/pos/ury_pos.png';

function scenarioMeta(scenario: PosShiftScenario) {
  switch (scenario) {
    case 'draft':
      return { icon: FileWarning, tone: 'amber' as const };
    case 'opening':
      return { icon: DoorOpen, tone: 'emerald' as const };
    case 'outdated':
    case 'closing':
      return { icon: Clock, tone: 'amber' as const };
    case 'waiting_main':
      return { icon: Users, tone: 'blue' as const };
    case 'closing_queued':
      return { icon: Loader2, tone: 'amber' as const };
    case 'blocked_by_other':
      return { icon: AlertTriangle, tone: 'red' as const };
    case 'error':
      return { icon: AlertTriangle, tone: 'red' as const };
    default:
      return { icon: DoorOpen, tone: 'slate' as const };
  }
}

function titleForScenario(scenario: PosShiftScenario): string {
  switch (scenario) {
    case 'draft':
      return t('pos.shift_gate.draft.title');
    case 'opening':
      return t('pos.shift_gate.opening.title');
    case 'outdated':
      return t('pos.shift_gate.outdated.title');
    case 'closing':
      return t('pos.shift_gate.closing.title');
    case 'waiting_main':
      return t('pos.shift_gate.waiting_main.title');
    case 'closing_queued':
      return t('pos.shift_gate.closing_queued.title');
    case 'blocked_by_other':
      return t('pos.shift_gate.blocked_by_other.title');
    case 'error':
      return t('pos.shift_gate.error.title');
    default:
      return t('pos.shift_gate.opening.title');
  }
}

function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatErrorTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function POSShiftGate({
  context,
  onCheckAgain,
  isChecking,
  errorMessage,
  errorTimestamp,
  sessionExpired = false,
  retryBackoffSeconds = 0,
}: POSShiftGateProps) {
  const [navigating, setNavigating] = useState(false);
  const [localTime, setLocalTime] = useState(() => formatLocalTime(new Date()));
  const [pollStatus, setPollStatus] = useState('');
  const [copiedUser, setCopiedUser] = useState(false);
  const gateRef = useRef<HTMLDivElement>(null);
  const { icon: Icon, tone } = scenarioMeta(context.scenario);
  const direction = getActiveDirection();

  useFocusTrap(gateRef, true);

  useEffect(() => {
    const timer = window.setInterval(() => setLocalTime(formatLocalTime(new Date())), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const navigateDesk = useCallback((url?: string | null) => {
    if (!url || navigating) {
      return;
    }
    setNavigating(true);
    window.location.href = url;
    window.setTimeout(() => setNavigating(false), 3000);
  }, [navigating]);

  useEffect(() => {
    if (context.scenario !== 'waiting_main' && context.scenario !== 'closing_queued') {
      return;
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setPollStatus(t('pos.shift_gate.poll_checking'));
        onCheckAgain();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      setPollStatus(t('pos.shift_gate.poll_checking'));
      onCheckAgain();
    }, POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [context.scenario, onCheckAgain]);

  useEffect(() => {
    if (!isChecking && pollStatus) {
      setPollStatus(t('pos.shift_gate.poll_updated'));
    }
  }, [isChecking, pollStatus]);

  const primary = useMemo(() => {
    const disabled =
      navigating ||
      isChecking ||
      (context.scenario === 'opening' && !context.can_create_opening) ||
      ((context.scenario === 'outdated' || context.scenario === 'closing') &&
        !context.can_close_shift);

    switch (context.scenario) {
      case 'draft':
        return {
          label: t('pos.shift_gate.draft.resume'),
          action: () => navigateDesk(context.desk_routes.resume_draft),
          disabled: !context.desk_routes.resume_draft || disabled,
        };
      case 'opening':
        return {
          label: navigating ? t('pos.shift_gate.navigating_open') : t('pos.shift_gate.primary_open'),
          action: () => navigateDesk(context.desk_routes.open_shift),
          disabled: disabled || !context.desk_routes.open_shift,
        };
      case 'outdated':
        if (!context.completed_steps.closed_previous) {
          return {
            label: navigating ? t('pos.shift_gate.navigating_close') : t('pos.shift_gate.primary_close'),
            action: () => navigateDesk(context.desk_routes.close_shift),
            disabled: disabled || !context.desk_routes.close_shift,
          };
        }
        return {
          label: navigating ? t('pos.shift_gate.navigating_open') : t('pos.shift_gate.outdated.step_open'),
          action: () => navigateDesk(context.desk_routes.open_shift),
          disabled: disabled || !context.can_create_opening || !context.desk_routes.open_shift,
        };
      case 'closing':
        return {
          label: navigating ? t('pos.shift_gate.navigating_close') : t('pos.shift_gate.primary_close'),
          action: () => navigateDesk(context.desk_routes.close_shift),
          disabled: disabled || !context.desk_routes.close_shift,
        };
      case 'blocked_by_other':
        return {
          label: t('pos.shift_gate.blocked_by_other.view'),
          action: () => navigateDesk(context.desk_routes.view_opening),
          disabled: !context.desk_routes.view_opening || navigating,
        };
      case 'waiting_main':
      case 'closing_queued':
      case 'error':
        return null;
      default:
        return null;
    }
  }, [context, navigating, isChecking, navigateDesk]);

  useEffect(() => {
    const onEnter = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        return;
      }
      if (primary && !primary.disabled) {
        event.preventDefault();
        primary.action();
      } else if (
        (context.scenario === 'waiting_main' ||
          context.scenario === 'closing_queued' ||
          context.scenario === 'error') &&
        !isChecking &&
        retryBackoffSeconds <= 0
      ) {
        event.preventDefault();
        onCheckAgain();
      }
    };
    document.addEventListener('keydown', onEnter);
    return () => document.removeEventListener('keydown', onEnter);
  }, [primary, context.scenario, isChecking, onCheckAgain, retryBackoffSeconds]);

  const toneRing =
    tone === 'emerald'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'amber'
        ? 'bg-amber-100 text-amber-700'
        : tone === 'blue'
          ? 'bg-blue-100 text-blue-700'
          : tone === 'red'
            ? 'bg-red-100 text-red-700'
            : 'bg-slate-100 text-slate-700';

  const showFloats =
    (context.scenario === 'opening' || context.scenario === 'draft') &&
    context.suggested_opening_balances.length > 0;

  const showOpeningChecklist = context.scenario === 'opening';

  const copyMainCashier = async () => {
    if (!context.main_cashier) {
      return;
    }
    try {
      await navigator.clipboard.writeText(context.main_cashier);
      setCopiedUser(true);
      window.setTimeout(() => setCopiedUser(false), 1500);
    } catch {
      // ignore
    }
  };

  const retryLabel =
    retryBackoffSeconds > 0
      ? t('pos.shift_gate.error_retry_in', { seconds: String(retryBackoffSeconds) })
      : t('pos.shift_gate.error_retry');

  const canRetry = !isChecking && retryBackoffSeconds <= 0;

  return (
    <div
      ref={gateRef}
      dir={direction}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-shift-gate-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-8"
    >
      <img
        src={LOGO_URL}
        alt=""
        aria-hidden
        className="pointer-events-none fixed bottom-6 end-6 w-40 opacity-[0.06] sm:w-48"
      />

      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {pollStatus}
        {isChecking ? t('pos.shift_gate.poll_checking') : ''}
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="space-y-4">
          <div className={cn('inline-flex h-16 w-16 items-center justify-center rounded-2xl', toneRing)}>
            <Icon className={cn('h-8 w-8', context.scenario === 'closing_queued' && 'animate-spin')} />
          </div>
          <h1 id="pos-shift-gate-title" className="text-3xl font-bold tracking-tight text-slate-900">
            {titleForScenario(context.scenario)}
          </h1>

          <div className="flex flex-wrap gap-2 text-xs">
            {context.branch ? (
              <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                {context.branch}
              </span>
            ) : null}
            {context.room ? (
              <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                {context.room}
              </span>
            ) : null}
            {context.pos_profile ? (
              <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                {context.pos_profile}
              </span>
            ) : null}
            <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
              {t('pos.shift_gate.business_date')}: {context.business_date}
            </span>
            <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
              {localTime}
            </span>
          </div>

          {sessionExpired ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t('pos.shift_gate.session_expired')}
            </div>
          ) : null}

          {context.scenario === 'draft' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t('pos.shift_gate.draft.warning')}
            </div>
          ) : null}

          {context.scenario === 'closing_queued' ? (
            <p className="text-slate-600">{t('pos.shift_gate.closing_queued.message')}</p>
          ) : null}

          {context.scenario === 'waiting_main' && context.main_cashier_name ? (
            <div className="space-y-2">
              <p className="text-slate-600">
                {t('pos.shift_gate.waiting_main.main_cashier', { name: context.main_cashier_name })}
              </p>
              {context.main_cashier ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={() => void copyMainCashier()}
                  >
                    {copiedUser ? (
                      <Check className="me-2 h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="me-2 h-4 w-4" />
                    )}
                    {context.main_cashier}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10"
                    asChild
                  >
                    <a href={`mailto:${encodeURIComponent(context.main_cashier)}`}>
                      <Mail className="me-2 h-4 w-4" />
                      {t('pos.shift_gate.waiting_main.contact')}
                    </a>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {context.scenario === 'blocked_by_other' && context.open_entry_owner_name ? (
            <p className="text-slate-600">
              {t('pos.shift_gate.blocked_by_other.message', { name: context.open_entry_owner_name })}
            </p>
          ) : null}

          {(context.scenario === 'outdated' || context.scenario === 'closing') && (
            <ol className="space-y-2 text-sm text-slate-600">
              <li className={cn('flex gap-2', context.completed_steps.closed_previous && 'text-emerald-700')}>
                <span>{context.completed_steps.closed_previous ? '✓' : '1.'}</span>
                <span>{t('pos.shift_gate.outdated.step_close')}</span>
              </li>
              <li className={cn('flex gap-2', context.completed_steps.opened_today && 'text-emerald-700')}>
                <span>{context.completed_steps.opened_today ? '✓' : '2.'}</span>
                <span>{t('pos.shift_gate.outdated.step_open')}</span>
              </li>
              <li className="flex gap-2 text-slate-500">
                <span>*</span>
                <span>{t('pos.shift_gate.zero_sales_hint')}</span>
              </li>
              <li className="flex gap-2 text-slate-500">
                <span>*</span>
                <span>{t('pos.shift_gate.business_day_rule')}</span>
              </li>
            </ol>
          )}

          {context.scenario === 'opening' && (
            <ul className="space-y-1 text-sm text-slate-600">
              <li>1. {t('pos.shift_gate.opening.step1')}</li>
              <li>2. {t('pos.shift_gate.opening.step2')}</li>
              <li>3. {t('pos.shift_gate.opening.step3')}</li>
            </ul>
          )}

          {showOpeningChecklist ? (
            <ul className="space-y-1 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                {t('pos.shift_gate.opening.checklist_profile')}
              </li>
              <li className="flex items-center gap-2">
                {showFloats ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <span className="inline-block h-4 w-4 rounded-full border border-slate-300" />
                )}
                {t('pos.shift_gate.opening.checklist_floats')}
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 rounded-full border border-slate-300" />
                {t('pos.shift_gate.opening.checklist_submit')}
              </li>
            </ul>
          ) : null}

          {!context.can_create_opening &&
          (context.scenario === 'opening' || context.scenario === 'draft') ? (
            <p className="text-sm text-red-600">{t('pos.shift_gate.no_permission')}</p>
          ) : null}

          {context.scenario === 'draft' && !context.allow_start_fresh ? (
            <p className="text-sm text-slate-500">{t('pos.shift_gate.draft.start_fresh_blocked')}</p>
          ) : null}

          {errorMessage ? (
            <p className="text-sm text-red-600" role="alert">
              {errorMessage}
              {errorTimestamp ? (
                <span className="mt-1 block text-xs text-red-500">
                  {t('pos.shift_gate.error_at', { time: formatErrorTime(errorTimestamp) })}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          {showFloats ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">
                {t('pos.shift_gate.expected_floats')}
              </p>
              <div className="space-y-1 text-sm">
                {context.suggested_opening_balances.map((row) => (
                  <div key={row.mode_of_payment} className="flex justify-between gap-4">
                    <span className="text-slate-600">{row.mode_of_payment}</span>
                    <span className="font-medium tabular-nums text-slate-900">
                      {formatCurrency(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">{t('pos.shift_gate.expected_floats_hint')}</p>
            </div>
          ) : null}

          {primary ? (
            <Button
              className="h-12 w-full text-base"
              onClick={primary.action}
              disabled={primary.disabled}
            >
              {primary.label}
            </Button>
          ) : null}

          {context.scenario === 'outdated' && !context.completed_steps.closed_previous ? (
            <Button variant="outline" className="h-12 w-full text-base" disabled>
              {t('pos.shift_gate.outdated.step_open')}
            </Button>
          ) : null}

          {context.scenario === 'draft' && context.allow_start_fresh ? (
            <Button
              variant="outline"
              className="h-12 w-full"
              disabled={navigating || !context.desk_routes.open_shift}
              onClick={() => navigateDesk(context.desk_routes.open_shift)}
            >
              {t('pos.shift_gate.draft.start_fresh')}
            </Button>
          ) : null}

          {(context.scenario === 'outdated' || context.scenario === 'closing') &&
          context.stale_opening_entry &&
          context.desk_routes.view_opening ? (
            <Button
              variant="outline"
              className="h-12 w-full"
              disabled={navigating}
              onClick={() => navigateDesk(context.desk_routes.view_opening)}
            >
              {t('pos.shift_gate.view_stale_entry')}
            </Button>
          ) : null}

          <Button
            variant="secondary"
            className="h-12 w-full"
            onClick={onCheckAgain}
            disabled={isChecking}
          >
            {isChecking ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="me-2 h-4 w-4" />
            )}
            {t('pos.shift_gate.check_again')}
          </Button>

          {context.scenario === 'error' ? (
            <Button className="h-12 w-full" onClick={onCheckAgain} disabled={!canRetry}>
              {retryLabel}
            </Button>
          ) : null}

          <Button
            variant="ghost"
            className="h-12 w-full text-slate-500"
            onClick={() => {
              window.location.href = '/app';
            }}
          >
            <Monitor className="me-2 h-4 w-4" />
            {t('pos.shift_gate.advanced_desk')}
          </Button>
        </div>
      </div>
    </div>
  );
}
