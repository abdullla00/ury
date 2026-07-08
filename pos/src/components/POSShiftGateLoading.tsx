import { t } from '../i18n';

export default function POSShiftGateLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-6 w-32 animate-pulse rounded-lg bg-slate-200" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-slate-200" />
            <div className="mx-auto h-8 w-3/4 animate-pulse rounded-lg bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
        <p className="text-center text-sm text-slate-500">{t('common.checking_pos_status')}</p>
      </div>
    </div>
  );
}
