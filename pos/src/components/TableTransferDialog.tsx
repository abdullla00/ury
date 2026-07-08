import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usePOSStore } from '../store/pos-store';
import { getTables, type Table } from '../lib/table-api';
import { mergeTable, transferTable } from '../lib/table-order-api';
import { Button } from './ui/button';
import { showToast } from './ui/toast';
import { t } from '../i18n';
import { cn } from '../lib/utils';

interface TableTransferDialogProps {
  currentTable: string;
  invoiceId: string;
  onClose: () => void;
}

const TableTransferDialog = ({ currentTable, invoiceId, onClose }: TableTransferDialogProps) => {
  const { selectedRoom, setSelectedTable, loadTableOrder } = usePOSStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (!selectedRoom) {
      return;
    }
    setLoading(true);
    getTables(selectedRoom)
      .then((fetched) => {
        setTables(fetched.filter((tbl) => tbl.name !== currentTable));
      })
      .catch(() => showToast.error(t('errors.failed_load_tables')))
      .finally(() => setLoading(false));
  }, [selectedRoom, currentTable]);

  const handleSelect = async (target: Table) => {
    setTransferring(true);
    try {
      if (target.occupied === 1) {
        await mergeTable(currentTable, target.name, invoiceId);
        setSelectedTable(target.name, selectedRoom, true);
        await loadTableOrder(target.name);
        showToast.success(t('actions.merge_success'));
      } else {
        await transferTable(currentTable, target.name, invoiceId);
        setSelectedTable(target.name, selectedRoom, true);
        showToast.success(t('actions.transfer_success'));
      }
      onClose();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : t('actions.transfer_failed'));
    } finally {
      setTransferring(false);
    }
  };

  const available = tables.filter((t) => t.occupied !== 1);
  const occupied = tables.filter((t) => t.occupied === 1);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold">{t('actions.transfer_merge_table')}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-sm text-gray-600">
            {t('actions.transfer_from', { table: currentTable })}
          </p>
          {loading ? (
            <p className="text-sm text-gray-500">{t('common.loading_tables')}</p>
          ) : tables.length === 0 ? (
            <p className="text-sm text-gray-500">{t('actions.no_available_tables')}</p>
          ) : (
            <div className="space-y-4">
              {available.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-gray-500">
                    {t('actions.transfer_to_empty')}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {available.map((table) => (
                      <Button
                        key={table.name}
                        variant="outline"
                        className="h-12"
                        disabled={transferring}
                        onClick={() => void handleSelect(table)}
                      >
                        {table.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {occupied.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-gray-500">
                    {t('actions.merge_to_occupied')}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {occupied.map((table) => (
                      <Button
                        key={table.name}
                        variant="outline"
                        className={cn('h-12 border-amber-300 bg-amber-50')}
                        disabled={transferring}
                        onClick={() => void handleSelect(table)}
                      >
                        {table.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableTransferDialog;
