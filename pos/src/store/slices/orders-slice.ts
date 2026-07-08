import { StateCreator } from 'zustand';
import { OrderType } from '../../data/order-types';
import { call } from '../../lib/frappe-sdk';
import {
  getPOSInvoices,
  getPOSInvoiceItems,
  POSInvoiceItem,
  POSInvoiceTax,
  getOrderStatusCounts,
  getKotFilterCounts,
  KotFilterCounts,
  searchPosInvoice,
} from '../../lib/invoice-api';
import { readKotFilter } from '../../lib/kot-order-utils';

export type KotSummaryStatus =
  | 'not_sent'
  | 'in_kitchen'
  | 'ready'
  | 'served'
  | 'cancel_pending'
  | 'partial';

export interface KotStationStatus {
  production: string;
  status: KotSummaryStatus;
  type?: string;
}

export type KotFilterChip = 'all' | 'in_kitchen' | 'delayed' | 'not_sent';

export interface POSInvoice {
  name: string;
  invoice_printed: number;
  grand_total: number;
  restaurant_table: string | null;
  cashier: string;
  waiter: string;
  net_total: number;
  posting_time: string;
  total_taxes_and_charges: number;
  customer: string;
  status: 'Draft' | 'Unbilled' | 'Recently Paid' | 'Paid' | 'Consolidated' | 'Return';
  mobile_number: string;
  posting_date: string;
  rounded_total: number;
  order_type: OrderType;
  custom_comments?: string | null;
  custom_allergy_note?: string | null;
  item_count?: number;
  kot_summary?: KotSummaryStatus;
  kot_stations?: KotStationStatus[];
  kot_modified?: boolean;
  kot_delayed?: boolean;
}

export interface OrdersState {
  orders: POSInvoice[];
  orderLoading: boolean;
  error: string | null;
  pagination: {
    currentPage: number;
    hasNextPage: boolean;
    itemsPerPage: number;
  };
  selectedStatus: 'Draft' | 'Unbilled' | 'Recently Paid' | 'Paid' | 'Consolidated' | 'Return';
  selectedOrder: POSInvoice | null;
  selectedOrderItems: POSInvoiceItem[];
  selectedOrderTaxes: POSInvoiceTax[];
  selectedOrderLoading: boolean;
  selectedOrderError: string | null;
  orderSearchQuery: string;
  statusCounts: Record<string, number>;
  statusCountsFetchedAt: number | null;
  kotFilterCounts: KotFilterCounts;
  kotFilterCountsFetchedAt: number | null;
  kotFilter: KotFilterChip;
}

export interface OrdersActions {
  fetchOrders: (page?: number) => Promise<void>;
  fetchStatusCounts: (force?: boolean) => Promise<void>;
  fetchKotFilterCounts: (force?: boolean) => Promise<void>;
  updateOrderStatus: (orderId: string, status: POSInvoice['status']) => Promise<void>;
  goToNextPage: () => Promise<void>;
  goToPreviousPage: () => Promise<void>;
  setSelectedStatus: (status: POSInvoice['status']) => Promise<void>;
  selectOrder: (order: POSInvoice) => Promise<void>;
  clearSelectedOrder: () => void;
  setOrderSearchQuery: (query: string) => void;
  setKotFilter: (filter: KotFilterChip) => Promise<void>;
}

export type OrdersSlice = OrdersState & OrdersActions;

const ITEMS_PER_PAGE = 10;
const STATUS_COUNTS_TTL_MS = 30_000;

const isKitchenTab = (status: OrdersState['selectedStatus']) =>
  status === 'Draft' || status === 'Unbilled';

export const createOrdersSlice: StateCreator<
  OrdersSlice,
  [],
  [],
  OrdersSlice
> = (set, get) => ({
  orders: [],
  orderLoading: false,
  error: null,
  pagination: {
    currentPage: 1,
    hasNextPage: false,
    itemsPerPage: ITEMS_PER_PAGE,
  },
  selectedStatus: 'Draft',
  selectedOrder: null,
  selectedOrderItems: [],
  selectedOrderTaxes: [],
  selectedOrderLoading: false,
  selectedOrderError: null,
  orderSearchQuery: '',
  statusCounts: {},
  statusCountsFetchedAt: null,
  kotFilterCounts: { in_kitchen: 0, delayed: 0, not_sent: 0 },
  kotFilterCountsFetchedAt: null,
  kotFilter: 'all',

  fetchStatusCounts: async (force = false) => {
    const now = Date.now();
    const { statusCountsFetchedAt } = get();
    if (!force && statusCountsFetchedAt && now - statusCountsFetchedAt < STATUS_COUNTS_TTL_MS) {
      return;
    }
    try {
      const counts = await getOrderStatusCounts();
      set({ statusCounts: counts, statusCountsFetchedAt: now });
    } catch {
      // non-blocking
    }
  },

  fetchKotFilterCounts: async (force = false) => {
    const { selectedStatus } = get();
    if (!isKitchenTab(selectedStatus)) {
      set({ kotFilterCounts: { in_kitchen: 0, delayed: 0, not_sent: 0 } });
      return;
    }
    const now = Date.now();
    const { kotFilterCountsFetchedAt } = get();
    if (!force && kotFilterCountsFetchedAt && now - kotFilterCountsFetchedAt < STATUS_COUNTS_TTL_MS) {
      return;
    }
    try {
      const counts = await getKotFilterCounts(selectedStatus);
      set({ kotFilterCounts: counts, kotFilterCountsFetchedAt: now });
    } catch {
      // non-blocking
    }
  },

  fetchOrders: async (page = 1) => {
    try {
      set({ orderLoading: true, error: null });
      const { orderSearchQuery, selectedStatus, kotFilter } = get();
      void get().fetchStatusCounts();
      if (isKitchenTab(selectedStatus)) {
        void get().fetchKotFilterCounts();
      }

      const posProfile = sessionStorage.getItem('posProfile');
      const profile = posProfile ? JSON.parse(posProfile) : null;
      const paidLimit = profile?.paid_limit;

      if (orderSearchQuery && orderSearchQuery.trim()) {
        const res = await searchPosInvoice(
          orderSearchQuery,
          selectedStatus,
          isKitchenTab(selectedStatus) ? kotFilter : undefined,
        );
        set({
          orders: res.data || [],
          pagination: {
            currentPage: 1,
            hasNextPage: false,
            itemsPerPage: ITEMS_PER_PAGE,
          },
          orderLoading: false,
        });
        return;
      }

      const limitStart = (page - 1) * ITEMS_PER_PAGE;
      const { invoices, hasMore } = await getPOSInvoices({
        status: selectedStatus,
        limit: ITEMS_PER_PAGE,
        limit_start: limitStart,
        paid_limit: paidLimit,
        kot_filter: isKitchenTab(selectedStatus) ? kotFilter : undefined,
      });
      set({
        orders: invoices,
        pagination: {
          currentPage: page,
          hasNextPage: hasMore,
          itemsPerPage: ITEMS_PER_PAGE,
        },
        orderLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch orders',
        orderLoading: false,
      });
    }
  },

  goToNextPage: async () => {
    const { pagination, orderLoading } = get();
    if (!orderLoading && pagination.hasNextPage) {
      await get().fetchOrders(pagination.currentPage + 1);
    }
  },

  goToPreviousPage: async () => {
    const { pagination, orderLoading } = get();
    if (!orderLoading && pagination.currentPage > 1) {
      await get().fetchOrders(pagination.currentPage - 1);
    }
  },

  setSelectedStatus: async (status) => {
    set({ selectedStatus: status, kotFilter: readKotFilter(status) });
    get().clearSelectedOrder();
    await get().fetchStatusCounts(true);
    await get().fetchKotFilterCounts(true);
    await get().fetchOrders(1);
  },

  selectOrder: async (order) => {
    try {
      set({
        selectedOrder: order,
        selectedOrderLoading: true,
        selectedOrderError: null,
      });

      const { items, taxes } = await getPOSInvoiceItems(order.name);

      set({
        selectedOrderItems: items,
        selectedOrderTaxes: taxes,
        selectedOrderLoading: false,
      });
    } catch (error) {
      set({
        selectedOrderError: error instanceof Error ? error.message : 'Failed to fetch order details',
        selectedOrderLoading: false,
      });
    }
  },

  clearSelectedOrder: () => {
    set({
      selectedOrder: null,
      selectedOrderItems: [],
      selectedOrderTaxes: [],
      selectedOrderError: null,
    });
  },

  updateOrderStatus: async (orderId: string, status: POSInvoice['status']) => {
    try {
      set({ orderLoading: true, error: null });

      await call.post('ury.ury_pos.api.updatePosInvoiceStatus', {
        invoice: orderId,
        status,
      });

      await get().fetchStatusCounts(true);
      await get().fetchKotFilterCounts(true);
      await get().fetchOrders(get().pagination.currentPage);

      set({ orderLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update order status',
        orderLoading: false,
      });
    }
  },

  setOrderSearchQuery: (query) => set({ orderSearchQuery: query }),

  setKotFilter: async (filter) => {
    set({ kotFilter: filter });
    get().clearSelectedOrder();
    await get().fetchOrders(1);
  },
});