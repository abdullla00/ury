import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearShiftWelcomeQuery,
  getPosShiftGate,
  markShiftPillPulse,
  shouldShowShiftWelcome,
  type PosShiftGateContext,
} from '../lib/pos-opening-api';
import { usePOSStore } from '../store/pos-store';
import POSShiftGate from './POSShiftGate';
import POSShiftGateLoading from './POSShiftGateLoading';
import POSShiftWelcome from './POSShiftWelcome';

interface POSOpeningProviderProps {
  children: React.ReactNode;
}

type ProviderPhase = 'loading' | 'gate' | 'welcome' | 'ready';

const MAX_RETRY_BACKOFF = 30;

function isSessionExpiredError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error ?? '');
  const lower = message.toLowerCase();
  return (
    lower.includes('session') ||
    lower.includes('authentication') ||
    lower.includes('not permitted') ||
    lower.includes('403') ||
    lower.includes('401')
  );
}

const POSOpeningProvider = ({ children }: POSOpeningProviderProps) => {
  const [phase, setPhase] = useState<ProviderPhase>('loading');
  const [gateContext, setGateContext] = useState<PosShiftGateContext | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorTimestamp, setErrorTimestamp] = useState<Date | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [retryBackoffSeconds, setRetryBackoffSeconds] = useState(0);
  const retryCountRef = useRef(0);
  const { posProfile } = usePOSStore();

  useEffect(() => {
    if (retryBackoffSeconds <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setRetryBackoffSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryBackoffSeconds]);

  const retryBackoffRef = useRef(0);
  retryBackoffRef.current = retryBackoffSeconds;

  const runGateCheck = useCallback(async (showLoading = false) => {
    if (!posProfile) {
      return;
    }
    if (retryBackoffRef.current > 0) {
      return;
    }
    try {
      if (showLoading) {
        setPhase('loading');
      }
      setIsChecking(true);
      setErrorMessage(null);
      setSessionExpired(false);

      const context = await getPosShiftGate();
      retryCountRef.current = 0;
      setRetryBackoffSeconds(0);
      setErrorTimestamp(null);

      if (context.scenario === 'ok') {
        setGateContext(context);
        if (shouldShowShiftWelcome()) {
          setPhase('welcome');
        } else {
          clearShiftWelcomeQuery();
          setPhase('ready');
        }
        return;
      }

      setGateContext(context);
      setPhase('gate');
    } catch (error) {
      console.error('Failed to check POS shift gate:', error);
      const expired = isSessionExpiredError(error);
      setSessionExpired(expired);
      setErrorTimestamp(new Date());
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to check shift status',
      );
      retryCountRef.current += 1;
      const backoff = Math.min(MAX_RETRY_BACKOFF, 3 * 2 ** (retryCountRef.current - 1));
      setRetryBackoffSeconds(backoff);
      setGateContext({
        scenario: 'error',
        pos_profile: posProfile.name,
        company: posProfile.company,
        branch: posProfile.branch,
        restaurant: posProfile.restaurant ?? null,
        room: null,
        stale_opening_entry: null,
        draft_opening_entry: null,
        main_cashier: null,
        main_cashier_name: null,
        is_main_cashier: true,
        main_cashier_open: true,
        can_create_opening: false,
        can_close_shift: false,
        open_entry_owner: null,
        open_entry_owner_name: null,
        suggested_opening_balances: [],
        business_date: new Date().toISOString().slice(0, 10),
        completed_steps: { closed_previous: false, opened_today: false },
        desk_routes: {},
        shift_summary: null,
      });
      setPhase('gate');
    } finally {
      setIsChecking(false);
    }
  }, [posProfile]);

  useEffect(() => {
    if (posProfile) {
      void runGateCheck(true);
    }
  }, [posProfile, runGateCheck]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && phase === 'gate') {
        void runGateCheck(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [phase, runGateCheck]);

  const handleWelcomeComplete = () => {
    markShiftPillPulse();
    clearShiftWelcomeQuery();
    setPhase('ready');
  };

  if (phase === 'loading') {
    return <POSShiftGateLoading />;
  }

  if (phase === 'gate' && gateContext) {
    return (
      <POSShiftGate
        context={gateContext}
        onCheckAgain={() => void runGateCheck(false)}
        isChecking={isChecking}
        errorMessage={errorMessage}
        errorTimestamp={errorTimestamp}
        sessionExpired={sessionExpired}
        retryBackoffSeconds={retryBackoffSeconds}
      />
    );
  }

  if (phase === 'welcome' && gateContext) {
    return <POSShiftWelcome context={gateContext} onComplete={handleWelcomeComplete} />;
  }

  return <>{children}</>;
};

export default POSOpeningProvider;
