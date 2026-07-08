export function getTableElapsedMinutes(latestInvoiceTime: string | null): number | null {
  if (!latestInvoiceTime) {
    return null;
  }

  const parsed = new Date(latestInvoiceTime);
  if (!Number.isNaN(parsed.getTime())) {
    return Math.floor((Date.now() - parsed.getTime()) / 60000);
  }

  const timeOnlyMatch = latestInvoiceTime.match(/^(\d{1,2}):(\d{2}):(\d{2})/);
  if (timeOnlyMatch) {
    const now = new Date();
    const started = new Date(now);
    started.setHours(Number(timeOnlyMatch[1]), Number(timeOnlyMatch[2]), Number(timeOnlyMatch[3]), 0);
    if (started > now) {
      started.setDate(started.getDate() - 1);
    }
    return Math.floor((now.getTime() - started.getTime()) / 60000);
  }

  return null;
}

export type TableAttentionState = 'available' | 'occupied' | 'attention';

export function getTableAttentionState(
  occupied: number,
  latestInvoiceTime: string | null,
  attentionMinutes: number,
): TableAttentionState {
  if (occupied !== 1) {
    return 'available';
  }
  const elapsed = getTableElapsedMinutes(latestInvoiceTime);
  if (elapsed !== null && attentionMinutes > 0 && elapsed > attentionMinutes) {
    return 'attention';
  }
  return 'occupied';
}

export function formatRelativeTableTime(latestInvoiceTime: string | null): string {
  const elapsed = getTableElapsedMinutes(latestInvoiceTime);
  if (elapsed === null) {
    return '';
  }
  if (elapsed < 1) {
    return '<1 min';
  }
  if (elapsed < 60) {
    return `${elapsed} min`;
  }
  const hours = Math.floor(elapsed / 60);
  const mins = elapsed % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
