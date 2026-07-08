import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Layout, Loader2, Printer, QrCode, Square, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatRelativeTableTime, getTableAttentionState } from '../lib/table-utils';
import { usePOSStore } from '../store/pos-store';
import { getRooms, getTables, getTableCount ,type Room, type Table } from '../lib/table-api';
import { Spinner } from '../components/ui/spinner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { DINE_IN } from '../data/order-types';
import { TableShapeIcon } from '../components/TableShapeIcon';
import { getTableOrder } from '../lib/order-api';
import { printOrder } from '../lib/print';
import { showToast } from '../components/ui/toast';
import { t } from '../i18n';

import { printQrSheet } from '../lib/print-qr-sheet';
import LayoutView from '../components/LayoutView';

const GUEST_ACTIVITY_MINUTES = 30;

function hasRecentGuestActivity(guestOrderAt?: string | null): boolean {
  if (!guestOrderAt) {
    return false;
  }
  const elapsed = Date.now() - new Date(guestOrderAt).getTime();
  return elapsed < GUEST_ACTIVITY_MINUTES * 60 * 1000;
}

const sortTables = (tables: Table[]) => [...tables].sort((a, b) => a.name.localeCompare(b.name));

const TableView = () => {
  const navigate = useNavigate();
  const { posProfile, startDineInFromTable, startDirectOrder, startTabOrder } = usePOSStore();

  const branch = posProfile?.branch ?? null;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesCache, setTablesCache] = useState<Record<string, Table[]>>({});
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  const [loadingRoomCounts, setLoadingRoomCounts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printingTable, setPrintingTable] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [showQrSheet, setShowQrSheet] = useState(false);
  const [qrUrls, setQrUrls] = useState<Array<{ table: string; url: string }>>([]);
  const [tabNameInput, setTabNameInput] = useState('');
  const [pullStartY, setPullStartY] = useState<number | null>(null);

  const persistRoomCounts = useCallback((counts: Record<string, number>) => {
    if (!branch) return;
    sessionStorage.setItem(`ury_room_counts_${branch}`, JSON.stringify(counts));
  }, [branch]);

  useEffect(() => {
    async function fetchRooms() {
      if (!branch) return;
      setLoadingRooms(true);
      setError(null);

      try {
        const sessionKey = `ury_rooms_${branch}`;
        const cachedRooms = sessionStorage.getItem(sessionKey);

        if (cachedRooms) {
          const parsedRooms = JSON.parse(cachedRooms) as Room[];
          setRooms(parsedRooms);
          setSelectedRoom(prev => prev ?? (parsedRooms[0]?.name ?? null));
        } else {
          const fetchedRooms = await getRooms(branch);
          setRooms(fetchedRooms);
          setSelectedRoom(prev => prev ?? (fetchedRooms[0]?.name ?? null));
          sessionStorage.setItem(sessionKey, JSON.stringify(fetchedRooms));
        }
      } catch (e) {
        console.error(e);
        setError('Failed to load rooms');
      } finally {
        setLoadingRooms(false);
      }
    }

    fetchRooms();
  }, [branch]);

  useEffect(() => {
    if (!branch || rooms.length === 0) return;
    const cacheKey = `ury_room_counts_${branch}`;
    const cachedCounts = sessionStorage.getItem(cacheKey);
    let shouldFetch = true;

    if (cachedCounts) {
      try {
        const parsedCounts = JSON.parse(cachedCounts) as Record<string, number>;
        setRoomCounts(parsedCounts);
        const hasAllRooms = rooms.every(room => typeof parsedCounts[room.name] === 'number');
        if (hasAllRooms) {
          shouldFetch = false;
        }
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    if (!shouldFetch) return;

  async function fetchRoomCounts() {
      setLoadingRoomCounts(true);
      try {
        const counts = await Promise.all(
          rooms.map(room => getTableCount(room.name, room.branch))
        );
        const nextCounts = rooms.reduce((acc, room, index) => {
          acc[room.name] = counts[index];
          return acc;
        }, {} as Record<string, number>);
        setRoomCounts(nextCounts);
        persistRoomCounts(nextCounts);
      } catch (error) {
        console.error('Failed to load room counts', error);
      } finally {
        setLoadingRoomCounts(false);
      }
    }

    fetchRoomCounts();
  }, [branch, rooms, persistRoomCounts]);

  const loadTables = useCallback(
    async (roomName: string, options?: { useCache?: boolean }) => {
      if (!roomName) return;
      setError(null);

      const shouldUseCache = options?.useCache !== false;
      if (shouldUseCache && tablesCache[roomName]) {
        setTables(sortTables(tablesCache[roomName]));
        setLoadingTables(false);
        return;
      }

      setLoadingTables(true);
      try {
        const fetchedTables = await getTables(roomName);
        const sortedTables = sortTables(fetchedTables);
        setTables(sortedTables);
        setTablesCache(prev => ({ ...prev, [roomName]: sortedTables }));
      } catch (e) {
        console.error(e);
        setError('Failed to load tables');
        setTables([]);
      } finally {
        setLoadingTables(false);
      }
    },
    [tablesCache]
  );

  useEffect(() => {
    if (!selectedRoom) return;
    loadTables(selectedRoom);
  }, [selectedRoom, loadTables]);

  const handleNavigateToPOS = async (tableName: string) => {
    if (!selectedRoom) return;
    await startDineInFromTable(tableName, selectedRoom);
    navigate('/');
  };

  const handlePrintTable = async (table: Table, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!posProfile) {
      showToast.error('POS profile not loaded yet');
      return;
    }

    setPrintingTable(table.name);
    try {
      const orderResponse = await getTableOrder(table.name);
      const invoiceId = orderResponse.message?.name;

      if (!invoiceId) {
        showToast.error('No active order found for this table');
        return;
      }

      await printOrder({ orderId: invoiceId, posProfile });
      showToast.success('Printed successfully');
      await loadTables(table.restaurant_room, { useCache: false });
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to print order');
    } finally {
      setPrintingTable(null);
    }
  };

  const tablesToDisplay = useMemo(() => {
    const sorted = sortTables(tables);
    if (!tableSearch.trim()) {
      return sorted;
    }
    const q = tableSearch.trim().toLowerCase();
    return sorted.filter((tbl) => tbl.name.toLowerCase().includes(q));
  }, [tables, tableSearch]);

  const hasRooms = rooms.length > 0;
  const showGridSkeleton = loadingTables || !selectedRoom;
  const allTablesAvailable =
    tablesToDisplay.length > 0 && tablesToDisplay.every((tbl) => tbl.occupied !== 1);

  const handlePullRefresh = (endY: number) => {
    if (pullStartY === null || !selectedRoom) {
      return;
    }
    if (endY - pullStartY > 80) {
      void loadTables(selectedRoom, { useCache: false });
    }
    setPullStartY(null);
  };

  const handleRoomChange = (roomName: string) => {
    if (roomName === selectedRoom) {
      loadTables(roomName, { useCache: false });
      return;
    }

    setSelectedRoom(roomName);

    if (tablesCache[roomName]) {
      setTables(sortTables(tablesCache[roomName]));
      setLoadingTables(false);
    } else {
      setLoadingTables(true);
      setTables([]);
    }
  };

  const attentionMinutes = posProfile?.tableAttention ?? 0;

  const handlePrintQrSheet = async () => {
    if (!selectedRoom) {
      return;
    }
    try {
      const { getRoomQrTokens } = await import('../lib/table-order-api');
      const tokens = await getRoomQrTokens(selectedRoom);
      setQrUrls(tokens.map((row) => ({ table: row.table, url: row.url })));
      setShowQrSheet(true);
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : t('errors.failed_load_tables'));
    }
  };

  const handleStartTab = () => {
    const name = tabNameInput.trim();
    if (!name) {
      return;
    }
    startTabOrder(name);
    navigate('/');
  };

  const [isLayoutView, setIsLayoutView] = useState(false);

  const handleLayoutView = () => {
    if (selectedRoom) {
      loadTables(selectedRoom, { useCache: false });
    }
    setIsLayoutView(true);
  };

  if (isLayoutView && selectedRoom) {
    return (
      <LayoutView
        selectedRoom={selectedRoom}
        tables={tablesToDisplay}
        onBackToGrid={() => setIsLayoutView(false)}
        onRefresh={() => loadTables(selectedRoom, { useCache: false })}
        onOpenTable={(table) => void handleNavigateToPOS(table)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="search"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder={t('tables.jump_placeholder')}
                className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm sm:order-last"
              />
              <div className="flex flex-wrap gap-2">
                {loadingRooms && (
                  <div className="flex-1 min-w-[160px]">
                    <Spinner message="Loading rooms..." />
                  </div>
                )}

                {!loadingRooms && !hasRooms && (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    No rooms found for this branch
                  </div>
                )}

                {rooms.map(room => (
                  <Button
                    key={room.name}
                    variant="tab"
                    data-selected={selectedRoom === room.name}
                    onClick={() => handleRoomChange(room.name)}
                    className="h-fit"
                  >
                    {room.name}
                    {typeof roomCounts[room.name] === 'number' ? (
                      <Badge variant="outline" className="ml-2 bg-white/60">
                        {roomCounts[room.name]}
                      </Badge>
                    ) : null}
                  </Button>
                ))}
              </div>

              <div className="flex flex-shrink-0 flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { startDirectOrder(); navigate('/'); }}>
                  {t('actions.new_order')}
                </Button>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tabNameInput}
                    onChange={(e) => setTabNameInput(e.target.value)}
                    placeholder={t('actions.tab_name')}
                    className="h-9 w-28 rounded-lg border border-gray-200 px-2 text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={handleStartTab}>
                    {t('actions.set_tab')}
                  </Button>
                </div>
                <Button variant="tab" className="flex items-center gap-2 text-sm" onClick={() => void handlePrintQrSheet()}>
                  <QrCode className="w-4 h-4" />
                  {t('actions.qr_codes')}
                </Button>
                <Button
                  variant="tab"
                  className="flex items-center gap-2 text-sm"
                  onClick={() => handleLayoutView()}
                >
                  <Layout className="w-4 h-4" />
                  {t('tables.layout_view')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto bg-gray-50 p-4 pb-6 sm:p-6"
        onTouchStart={(e) => setPullStartY(e.touches[0].clientY)}
        onTouchEnd={(e) => handlePullRefresh(e.changedTouches[0].clientY)}
      >
        <div className="max-w-screen-xl mx-auto h-full">
          {allTablesAvailable && !showGridSkeleton && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
              <Square className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="font-semibold">{t('tables.all_available_title')}</p>
                <p className="text-sm text-emerald-800">{t('tables.all_available_subtitle')}</p>
              </div>
            </div>
          )}
          {error && !loadingTables ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-red-500">
              <AlertTriangle className="w-10 h-10" />
              <p>{error}</p>
            </div>
          ) : showGridSkeleton ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="min-h-[140px] animate-pulse rounded-xl border-2 border-gray-200 bg-gray-200/70"
                />
              ))}
            </div>
          ) : tablesToDisplay.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-500">
              <Square className="w-10 h-10" />
              <p>{t('tables.no_tables_found')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tablesToDisplay.map(table => {
                const isOccupied = table.occupied === 1;
                const attentionState = getTableAttentionState(
                  table.occupied,
                  table.latest_invoice_time,
                  attentionMinutes,
                );

                const guestActive = hasRecentGuestActivity(table.custom_guest_order_at);

                return (
                  <div
                    key={table.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleNavigateToPOS(table.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void handleNavigateToPOS(table.name);
                      }
                    }}
                    className={cn(
                      'relative min-h-[140px] rounded-xl border-2 p-4 transition-all flex flex-col justify-between gap-y-4 cursor-pointer active:scale-[0.98]',
                      attentionState === 'attention'
                        ? 'border-red-400 bg-red-50 text-red-900 hover:border-red-500 hover:shadow-md'
                        : isOccupied
                          ? 'border-amber-400 bg-amber-50 text-amber-900 hover:border-amber-500 hover:shadow-md'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400 hover:shadow-md',
                    )}
                  >
                    {isOccupied && (
                      <button
                        type="button"
                        onClick={(event) => void handlePrintTable(table, event)}
                        disabled={printingTable === table.name}
                        className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-amber-800 shadow-sm hover:bg-white disabled:opacity-60"
                        title={t('order.print')}
                      >
                        {printingTable === table.name ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <TableShapeIcon shape={table.table_shape || 'Rectangle'} />
                          <span className="font-bold text-xl text-gray-900">{table.name}</span>
                        </div>
                        <Badge
                          variant={
                            attentionState === 'attention'
                              ? 'destructive'
                              : isOccupied
                                ? 'warning'
                                : 'success'
                          }
                        >
                          {attentionState === 'attention'
                            ? t('tables.attention')
                            : isOccupied
                              ? t('tables.occupied')
                              : t('tables.available')}
                        </Badge>
                        {guestActive && (
                          <Badge variant="info" className="ms-1">
                            {t('tables.guest_ordering')}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2 text-sm text-gray-700">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{t('tables.room')}</span>
                          <span>{table.restaurant_room}</span>
                        </div>
                        {isOccupied && (
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{t('tables.started_at')}</span>
                            <span>{formatRelativeTableTime(table.latest_invoice_time)}</span>
                          </div>
                        )}
                        {typeof table.no_of_seats === 'number' && (
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{t('tables.seats')}</span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {table.no_of_seats}
                            </span>
                          </div>
                        )}
                        {table.is_take_away === 1 && (
                          <Badge variant="pending" className="mt-2">
                            Take away
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-gray-500">
                      {isOccupied ? t('tables.tap_to_resume') : t('tables.tap_to_start')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status Legend */}
      <div className="fixed bottom-[4.5rem] w-full p-4 bg-white border-t border-gray-200">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border border-emerald-300 bg-emerald-50"></div>
              <span>{t('tables.available')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border border-amber-400 bg-amber-50"></div>
              <span>{t('tables.occupied')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border border-red-400 bg-red-50"></div>
              <span>{t('tables.attention')}</span>
            </div>
          </div>
        </div>
      </div>

      {showQrSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <h2 className="mb-3 text-lg font-semibold">{t('actions.qr_codes')}</h2>
            <div className="space-y-2">
              {qrUrls.map((row) => (
                <div key={row.table} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <p className="font-medium">{t('context.table')} {row.table}</p>
                  <a href={row.url} className="break-all text-primary underline" target="_blank" rel="noreferrer">
                    {row.url}
                  </a>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => setShowQrSheet(false)}>
                {t('common.close')}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => printQrSheet(qrUrls, selectedRoom ?? undefined)}
              >
                {t('actions.print_qr_sheet')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableView;