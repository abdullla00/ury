import { t } from '../i18n';

export function printQrSheet(rows: Array<{ table: string; url: string }>, roomName?: string) {
  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) {
    return;
  }

  const cells = rows
    .map(
      (row) => `
      <div class="cell">
        <h2>${t('context.table')} ${row.table}</h2>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(row.url)}" alt="" width="160" height="160" />
        <p class="url">${row.url}</p>
      </div>`,
    )
    .join('');

  popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${t('actions.qr_codes')}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; }
    h1 { margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .cell { border: 1px solid #ddd; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
    .cell h2 { margin: 0 0 12px; font-size: 18px; }
    .url { font-size: 10px; word-break: break-all; color: #555; margin-top: 8px; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>${t('actions.qr_codes')}${roomName ? ` — ${roomName}` : ''}</h1>
  <div class="grid">${cells}</div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
  popup.document.close();
}
