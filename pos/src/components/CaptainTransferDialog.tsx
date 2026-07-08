import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { db } from '../lib/frappe-sdk';
import { captainTransfer } from '../lib/table-order-api';
import { Button } from './ui/button';
import { showToast } from './ui/toast';
import { t } from '../i18n';

interface CaptainTransferDialogProps {
  invoiceId: string;
  currentCaptain: string;
  onClose: () => void;
}

const CaptainTransferDialog = ({
  invoiceId,
  currentCaptain,
  onClose,
}: CaptainTransferDialogProps) => {
  const [captains, setCaptains] = useState<Array<{ name: string }>>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    db.getDocList('User', { fields: ['name'], limit: 200 })
      .then((docs) => setCaptains(docs as Array<{ name: string }>))
      .catch(() => showToast.error(t('errors.failed_load_captains')))
      .finally(() => setLoading(false));
  }, []);

  const handleTransfer = async () => {
    if (!selected) {
      return;
    }
    setTransferring(true);
    try {
      await captainTransfer(currentCaptain, selected, invoiceId);
      showToast.success(t('actions.captain_transfer_success'));
      onClose();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : t('actions.captain_transfer_failed'));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold">{t('actions.captain_transfer')}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : (
            <div className="space-y-1">
              {captains
                .filter((c) => c.name !== currentCaptain)
                .map((captain) => (
                  <button
                    key={captain.name}
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-start text-sm ${
                      selected === captain.name ? 'bg-primary-50 text-primary-800' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelected(captain.name)}
                  >
                    {captain.name}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!selected || transferring} onClick={() => void handleTransfer()}>
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CaptainTransferDialog;
