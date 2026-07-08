import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../lib/storage';
import { getRestaurantMenu, getAggregatorMenu, MenuItem as APIMenuItem } from '../lib/menu-api';
import { getCurrencyInfo, PosProfileCombined, getCombinedPosProfile } from '../lib/pos-profile-api';
import { getMenuCourses } from '../lib/menu-course-api';
import { getCustomerGroups, getCustomerTerritories } from '../lib/customer-api';
import { DEFAULT_ORDER_TYPE, DINE_IN, ORDER_TYPE_DEFAULT_CUSTOMER, OrderType } from '../data/order-types';
import { getTableOrder, TableOrder } from '../lib/order-api';
import { getPaymentModes } from '../lib/payment-api';

// Constants
const MAX_QUANTITY = 99;
const MIN_QUANTITY = 0;
const ITEMS_PER_PAGE = 10;

// Custom error class for cart operations
class CartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CartError';
  }
}

// Extend the API MenuItem to include UI-specific properties
export interface MenuItem extends Omit<APIMenuItem, 'rate' | 'item_image'> {
  id: string;
  name: string;
  image: string | null;
  price: number;
  quantity?: number;
  description?: string;
  special_dish?: 1 | 0;
  variants?: Array<{ id: string; name: string; price: number }>;
  addons?: Array<{ id: string; name: string; price: number; category: 'sides' | 'drinks' | 'desserts' }>;
  has_modifiers?: boolean;
  selectedVariant?: { id: string; name: string; price: number };
  selectedAddons?: Array<{ id: string; name: string; price: number }>;
  uniqueId?: string;
  tax_rate?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
}

export interface OrderItem extends MenuItem {
  quantity: number;
  selectedVariant?: { id: string; name: string; price: number };
  selectedAddons?: { id: string; name: string; price: number }[];
  uniqueId?: string;
  comment?: string;
}

export interface PaymentMode {
  id: string;
  name: string;
  enabled: boolean;
}

export interface Category {
  name: string;
  label: string;
}

export interface Order {
  id: string;
  cartId: string;
  customerId?: string;
  paymentModeId: string;
  paymentMode: string;
  orderType: OrderType;
  status: 'pending' | 'paid' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
  updatedAt: string;
}

interface CartTotals {
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
}

interface Aggregator {
  customer: string;
}

interface POSState {
  menuItems: MenuItem[];
  categories: Category[];
  activeOrders: OrderItem[];
  selectedCategory: string;
  selectedTable: string | null;
  selectedRoom: string | null;
  searchQuery: string;
  selectedCustomer: Customer | null;
  selectedOrderType: OrderType;
  quickFilter: 'all' | 'special';
  selectedItem: MenuItem | null;
  cartId: string | null;
  loading: boolean;
  menuLoading: boolean;
  orderLoading: boolean;
  profileLoading: boolean;
  error: string | null;
  paymentModes: string[];
  orders: Order[];
  selectedAggregator: Aggregator | null;
  currency: string;
  currencySymbol: string | null;
  isUpdatingOrder: boolean;
  orderId: string | null;
  posProfile: PosProfileCombined | null;
  customerGroups: string[];
  territories: string[];
  tableOrder: TableOrder | null;
  isInitializing: boolean;
  orderComment: string;
  orderAllergyNote: string;
  noOfPax: number;
  tabName: string | null;
  invoicePrinted: number;
  orderStartedAt: string | null;
  favouriteItems: Array<{ item_name: string; qty: number }>;
}

interface POSStore extends POSState {
  fetchMenuItems: () => Promise<void>;
  fetchAggregatorMenu: (aggregator: string) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchPaymentModes: () => Promise<void>;
  addToOrder: (item: OrderItem) => Promise<void>;
  removeFromOrder: (uniqueId: string) => Promise<void>;
  updateQuantity: (uniqueId: string, quantity: number) => Promise<void>;
  clearOrder: () => Promise<void>;
  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  setSelectedTable: (table: string | null, room: string | null, doNotLoadOrder?: boolean) => void;
  setSelectedOrderType: (type: OrderType) => void;
  setQuickFilter: (filter: 'all' | 'special') => void;
  setSelectedItem: (item: MenuItem | null) => void;
  initializeCart: () => Promise<void>;
  processPayment: (paymentMode: string, amount: number) => Promise<void>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
  fetchPosProfile: () => Promise<void>;
  fetchCustomerGroups: () => Promise<void>;
  fetchTerritories: () => Promise<void>;
  fetchCurrencySymbol: () => Promise<void>;
  getCartTotals: () => CartTotals;
  itemExistsInCart: (uniqueId: string) => boolean;
  validateQuantity: (quantity: number) => boolean;
  getItemPrice: (item: OrderItem) => number;
  getItemQuantityFromCart: (item: MenuItem) => number;
  loadTableOrder: (table: string) => Promise<void>;
  clearTableOrder: () => void;
  startDineInFromTable: (table: string, room: string) => Promise<void>;
  isMenuInteractionDisabled: () => boolean;
  isOrderInteractionDisabled: () => boolean;
  initializeApp: () => Promise<void>;
  setOrderForUpdate: (orderId: string | null) => void;
  resetOrderState: (options?: { keepTable?: boolean }) => void;
  setSelectedAggregator: (aggregator: Aggregator | null) => void;
  setOrderComment: (comment: string) => void;
  setOrderAllergyNote: (note: string) => void;
  repriceActiveOrders: () => void;
  releaseTable: () => void;
  setOrderFromSync: (invoiceName: string) => void;
  setNoOfPax: (pax: number) => void;
  startDirectOrder: () => void;
  startTabOrder: (name: string) => void;
  restoreDraftCart: () => void;
  fetchFavouriteItems: () => Promise<void>;
  hasTransferAccess: (userRoles: string[]) => boolean;
}

const generateUniqueId = (item: OrderItem): string => {
  const variantId = item.selectedVariant?.id || 'default';
  const addonIds = item.selectedAddons?.map(addon => addon.id).sort().join('-') || 'no-addons';
  return `${item.id}-${variantId}-${addonIds}`;
};

const calculateItemPrice = (item: OrderItem): number => {
  const basePrice = item.selectedVariant?.price || item.price;
  const addonsTotal = item.selectedAddons?.reduce((sum, addon) => sum + addon.price, 0) || 0;
  return basePrice + addonsTotal;
};

function defaultCustomerForType(type: OrderType): Customer | null {
  const name = ORDER_TYPE_DEFAULT_CUSTOMER[type];
  return name ? { id: name, name, phone: '' } : null;
}

export const usePOSStore = create<POSStore>((set, get) => ({
  menuItems: [],
  categories: [],
  activeOrders: [],
  selectedCategory: '',
  selectedTable: null,
  selectedRoom: null,
  searchQuery: '',
  selectedCustomer: ORDER_TYPE_DEFAULT_CUSTOMER[DEFAULT_ORDER_TYPE]
    ? {
        id: ORDER_TYPE_DEFAULT_CUSTOMER[DEFAULT_ORDER_TYPE]!,
        name: ORDER_TYPE_DEFAULT_CUSTOMER[DEFAULT_ORDER_TYPE]!,
        phone: '',
      }
    : null,
  selectedOrderType: DEFAULT_ORDER_TYPE as OrderType,
  quickFilter: "all",
  selectedItem: null,
  cartId: null,
  loading: false,
  menuLoading: false,
  orderLoading: false,
  profileLoading: false,
  error: null,
  paymentModes: ['Cash'],
  orders: [],
  posProfile: null,
  customerGroups: [],
  territories: [],
  selectedAggregator: null,
  currency: storage.getItem('currency') || 'INR',
  currencySymbol: storage.getItem('currencySymbol') || null,
  tableOrder: null,
  isInitializing: true,
  isUpdatingOrder: false,
  orderId: null,
  orderComment: '',
  orderAllergyNote: '',
  noOfPax: 1,
  tabName: null,
  invoicePrinted: 0,
  orderStartedAt: null,
  favouriteItems: [],

  initializeApp: async () => {
    try {
      set({ isInitializing: true, error: null });
      
      const [profileResult, menuResult, categoriesResult, paymentModesResult] = await Promise.allSettled([
        get().fetchPosProfile(),
        get().fetchMenuItems(),
        get().fetchCategories(),
        get().fetchPaymentModes()
      ]);

      if (profileResult.status === 'rejected' || 
          menuResult.status === 'rejected' || 
          categoriesResult.status === 'rejected' ||
          paymentModesResult.status === 'rejected') {
        set({ 
          error: 'Failed to initialize app. Please refresh the page.',
          isInitializing: false 
        });
        return;
      }

      get().restoreDraftCart();
      set({ isInitializing: false });
    } catch (error) {
      set({ 
        error: 'Failed to initialize app. Please refresh the page.',
        isInitializing: false 
      });
    }
  },

  fetchPosProfile: async () => {
    try {
      set({ profileLoading: true, error: null });
      const combinedProfile = await getCombinedPosProfile();

      sessionStorage.setItem('posProfile', JSON.stringify(combinedProfile));
      set({
        posProfile: combinedProfile,
        profileLoading: false,
        currency: combinedProfile.currency || 'INR'
      });

      if (!storage.getItem('currencySymbol')) {
        await get().fetchCurrencySymbol();
      }
    } catch (error) {
      console.error('Error fetching POS profile:', error);
      sessionStorage.removeItem('posProfile');
      set({
        error: 'Failed to fetch POS profile',
        profileLoading: false
      });
    }
  },

  fetchCurrencySymbol: async () => {
    try {
      const currency = get().currency;
      const response = await getCurrencyInfo(currency);
      const { symbol } = response;
      
      set({ currencySymbol: symbol });
      storage.setItem('currencySymbol', symbol);
    } catch (error) {
      console.error('Error fetching currency symbol:', error);
      set({ currencySymbol: get().currency });
      storage.setItem('currencySymbol', get().currency);
    }
  },

  fetchMenuItems: async () => {
    const { posProfile, selectedRoom, selectedOrderType } = get();
    if (!posProfile?.restaurant) return;

    try {
      set({ menuLoading: true, error: null });
      const items = await getRestaurantMenu(posProfile.name, selectedRoom, selectedOrderType);
      
      const menuItems: MenuItem[] = items.map(item => ({
        id: item.item,
        name: item.item_name,
        image: item.item_image || null,
        price: typeof item.rate === 'string' ? parseFloat(item.rate) : item.rate || 0,
        item: item.item,
        item_name: item.item_name,
        item_image: item.item_image,
        course: item.course,
        course_label: item.course_label || item.course,
        description: item.description || '',
        special_dish: item.special_dish || 0,
        tax_rate: 0,
        has_modifiers: Boolean((item as { has_modifiers?: boolean }).has_modifiers),
      }));

      set({ menuItems });
    } catch (error) {
      set({ error: 'Failed to load menu items' });
      console.error('Error loading menu items:', error);
    } finally {
      set({ menuLoading: false });
    }
  },

  fetchAggregatorMenu: async (aggregator: string) => {
    try {
      set({ menuLoading: true, error: null });
      const items = await getAggregatorMenu(aggregator);
      
      const menuItems: MenuItem[] = items.map(item => ({
        ...item,
        id: item.item,
        name: item.item_name,
        image: item.item_image || null,
        price: typeof item.rate === 'string' ? parseFloat(item.rate) : item.rate || 0,
        category: item.course
      }));

      set({ menuItems, menuLoading: false });
    } catch (error) {
      set({ error: 'Failed to load aggregator menu', menuLoading: false });
      console.error('Error loading aggregator menu:', error);
    }
  },

  fetchCategories: async () => {
    try {
      const cached = sessionStorage.getItem('menuCategories');
      if (cached) {
        const categories = JSON.parse(cached);
        set({ categories });
        return;
      }

      const courses = await getMenuCourses();
      sessionStorage.setItem('menuCategories', JSON.stringify(courses));
      set({ categories: courses });
    } catch (error) {
      set({ error: 'Failed to load menu categories' });
      throw error;
    }
  },

  fetchPaymentModes: async () => {
    try {
      const modes = await getPaymentModes();
      set({ paymentModes: modes });
    } catch (error) {
      console.error('Failed to fetch payment modes:', error);
    }
  },

  initializeCart: async () => {
    set({ cartId: uuidv4() });
  },

  addToOrder: async (item: OrderItem) => {
    try {
      if (!get().validateQuantity(item.quantity)) {
        throw new CartError(`Quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}`);
      }

      const uniqueId = generateUniqueId(item);
      const existingItemIndex = get().activeOrders.findIndex(orderItem => orderItem.uniqueId === uniqueId);

      if (existingItemIndex !== -1) {
        const existingItem = get().activeOrders[existingItemIndex];
        const newQuantity = existingItem.quantity + item.quantity;
        const newComment = item.comment !== undefined ? item.comment : existingItem?.comment || "";

        if (!get().validateQuantity(newQuantity)) {
          throw new CartError(`Cannot add item. Total quantity would exceed ${MAX_QUANTITY}`);
        }

        const newOrders = [...get().activeOrders];
        newOrders[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          comment: newComment
        };
        
        set({ activeOrders: newOrders });
      } else {
        const newOrders = [...get().activeOrders, { ...item, uniqueId }];
        set({ activeOrders: newOrders });
      }
      sessionStorage.setItem('ury_pos_draft_cart', JSON.stringify(get().activeOrders));
    } catch (error) {
      if (error instanceof CartError) {
        set({ error: error.message });
      } else {
        set({ error: 'Failed to add item to cart' });
      }
    }
  },

  removeFromOrder: async (uniqueId: string) => {
    try {
      const newOrders = get().activeOrders.filter(item => item.uniqueId !== uniqueId);
      set({ activeOrders: newOrders });
    } catch (error) {
      set({ error: 'Failed to remove item from cart' });
    }
  },

  updateQuantity: async (uniqueId: string, quantity: number) => {
    try {
      if (!get().validateQuantity(quantity)) {
        throw new CartError(`Quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}`);
      }

      const newOrders = get().activeOrders.map(item =>
        item.uniqueId === uniqueId ? { ...item, quantity } : item
      );
      set({ activeOrders: newOrders });
    } catch (error) {
      if (error instanceof CartError) {
        set({ error: error.message });
      } else {
        set({ error: 'Failed to update quantity' });
      }
    }
  },

  clearOrder: async () => {
    try {
      set({ activeOrders: [] });
    } catch (error) {
      set({ error: 'Failed to clear cart' });
    }
  },

  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCustomer: (customer) => {
    set({ selectedCustomer: customer });
    void get().fetchFavouriteItems();
  },
  setSelectedTable: (table: string | null, room: string | null, doNotLoadOrder: boolean = false) => {
    set({ selectedTable: table, selectedRoom: room });
    if (table ) {
      if (!doNotLoadOrder) 
        get().loadTableOrder(table);
    } else {
      get().clearTableOrder();
    }
    if (room) {
      get().fetchMenuItems();
    }
  },
  setSelectedOrderType: (type) => {
    set({
      selectedOrderType: type,
      selectedCustomer: defaultCustomerForType(type),
      ...(type !== DINE_IN
        ? {
            selectedTable: null,
            selectedRoom: null,
            isUpdatingOrder: false,
            orderId: null,
            tableOrder: null,
          }
        : {}),
      ...(type !== 'Aggregators' ? { selectedAggregator: null } : {}),
    });

    const refresh = async () => {
      if (type !== 'Aggregators') {
        await get().fetchMenuItems();
        get().repriceActiveOrders();
      }
    };
    void refresh();
  },
  setQuickFilter: (filter) => set({ quickFilter: filter }),
  setSelectedItem: (item) => set({ selectedItem: item }),
  setSelectedAggregator: (aggregator) => set({ selectedAggregator: aggregator }),
  setOrderComment: (comment: string) => set({ orderComment: comment }),
  setOrderAllergyNote: (note: string) => set({ orderAllergyNote: note }),

  processPayment: async (paymentMode: string, amount: number) => {
    try {
      const { activeOrders, cartId, selectedCustomer, selectedOrderType } = get();
      
      const order: Order = {
        id: uuidv4(),
        cartId: cartId!,
        customerId: selectedCustomer?.id,
        paymentModeId: paymentMode,
        paymentMode,
        orderType: selectedOrderType,
        status: 'paid',
        totalAmount: amount,
        paidAmount: amount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const newOrders = [...get().orders, order];
      set({ orders: newOrders });
      
      await get().clearOrder();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateOrderStatus: async (orderId: string, status: Order['status']) => {
    try {
      const newOrders = get().orders.map(order => 
        order.id === orderId 
          ? { ...order, status, updatedAt: new Date().toISOString() }
          : order
      );
      set({ orders: newOrders });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  fetchCustomerGroups: async () => {
    const cached = sessionStorage.getItem('customerGroups');
    if (cached) {
      set({ customerGroups: JSON.parse(cached) });
      return;
    }
    const groups = await getCustomerGroups();
    const names = groups.map((g: any) => g.name);
    set({ customerGroups: names });
    sessionStorage.setItem('customerGroups', JSON.stringify(names));
  },

  fetchTerritories: async () => {
    const cached = sessionStorage.getItem('territories');
    if (cached) {
      set({ territories: JSON.parse(cached) });
      return;
    }
    const terrs = await getCustomerTerritories();
    const names = terrs.map((t: any) => t.name);
    set({ territories: names });
    sessionStorage.setItem('territories', JSON.stringify(names));
  },

  getCartTotals: (): CartTotals => {
    const items = get().activeOrders;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    
    const subtotal = items.reduce((sum, item) => {
      const itemPrice = calculateItemPrice(item);
      return sum + (itemPrice * item.quantity);
    }, 0);

    const tax = items.reduce((sum, item) => {
      const itemPrice = calculateItemPrice(item);
      const taxRate = item.tax_rate || 0;
      return sum + (itemPrice * item.quantity * (taxRate / 100));
    }, 0);

    return {
      subtotal,
      tax,
      total: subtotal + tax,
      itemCount
    };
  },

  itemExistsInCart: (uniqueId: string): boolean => {
    return get().activeOrders.some(item => item.uniqueId === uniqueId);
  },

  validateQuantity: (quantity: number): boolean => {
    return !isNaN(quantity) && quantity >= MIN_QUANTITY && quantity <= MAX_QUANTITY;
  },

  getItemPrice: (item: OrderItem): number => {
    return calculateItemPrice(item);
  },

  getItemQuantityFromCart: (item: MenuItem): number => {
    const uniqueId = generateUniqueId(item as OrderItem);
    const cartItem = get().activeOrders.find(orderItem => orderItem.uniqueId === uniqueId);
    return cartItem?.quantity || 0;
  },

  loadTableOrder: async (table: string) => {
    try {
      set({ orderLoading: true, error: null });
      const response = await getTableOrder(table);
      const order = response.message;
      if (order && order.name && order.items && order.items.length > 0) {
        const orderItems: OrderItem[] = order.items.map(item => {
          const orderItem = {
            id: item.item_code,
            name: item.item_name,
            price: item.rate,
            quantity: item.qty,
            amount: item.amount,
            image: item.image || null,
            item: item.item_code,
            item_name: item.item_name,
            item_image: null,
            course: '',
            description: item.description || '',
            special_dish: 0 as 0 | 1,
            tax_rate: 0,
            comment: item.comment || '',
          };
          return {
            ...orderItem,
            uniqueId: generateUniqueId(orderItem as OrderItem)
          } as OrderItem;
        });

        set({ 
          tableOrder: response,
          activeOrders: orderItems,
          selectedCustomer: order.customer ? {
            id: order.customer,
            name: order.customer_name,
            phone: order.mobile_number,
          } : null,
          isUpdatingOrder: true,
          orderId: order.name,
          noOfPax: (order as { no_of_pax?: number }).no_of_pax || 1,
          invoicePrinted: (order as { invoice_printed?: number }).invoice_printed ?? 0,
          orderStartedAt:
            (order as { arrived_time?: string }).arrived_time ||
            (order as { creation?: string }).creation ||
            null,
        });
        void get().fetchFavouriteItems();
      } else {
        set({
          tableOrder: null,
          activeOrders: [],
          selectedCustomer: defaultCustomerForType(DINE_IN),
          isUpdatingOrder: false,
          orderId: null,
          invoicePrinted: 0,
          orderStartedAt: null,
        });
      }
    } catch (error) {
      set({
        error: 'Failed to load table order',
        tableOrder: null,
        activeOrders: [],
        selectedCustomer: defaultCustomerForType(DINE_IN),
        isUpdatingOrder: false,
        orderId: null,
      });
    } finally {
      set({ orderLoading: false });
    }
  },

  clearTableOrder: () => {
    const { selectedOrderType } = get();
    set({
      tableOrder: null,
      activeOrders: [],
      selectedCustomer: defaultCustomerForType(selectedOrderType),
      isUpdatingOrder: false,
      orderId: null,
    });
  },

  startDineInFromTable: async (table: string, room: string) => {
    set({
      selectedOrderType: DINE_IN,
      selectedTable: table,
      selectedRoom: room,
      selectedCustomer: defaultCustomerForType(DINE_IN),
      selectedAggregator: null,
      isUpdatingOrder: false,
      orderId: null,
      tableOrder: null,
      orderComment: '',
      orderAllergyNote: '',
    });
    await get().loadTableOrder(table);
    await get().fetchMenuItems();
  },

  setOrderForUpdate: (orderId: string | null) => {
    set({ 
      isUpdatingOrder: orderId !== null,
      orderId,
    });
  },

  resetOrderState: (options?: { keepTable?: boolean }) => {
    const { fetchMenuItems } = get();
    const state = get();
    const keepTable = options?.keepTable && state.selectedOrderType === DINE_IN && state.selectedTable;

    set({
      selectedCustomer: keepTable
        ? defaultCustomerForType(DINE_IN)
        : ORDER_TYPE_DEFAULT_CUSTOMER[DEFAULT_ORDER_TYPE]
          ? {
              id: ORDER_TYPE_DEFAULT_CUSTOMER[DEFAULT_ORDER_TYPE]!,
              name: ORDER_TYPE_DEFAULT_CUSTOMER[DEFAULT_ORDER_TYPE]!,
              phone: '',
            }
          : null,
      selectedTable: keepTable ? state.selectedTable : null,
      selectedRoom: keepTable ? state.selectedRoom : null,
      selectedAggregator: null,
      isUpdatingOrder: false,
      orderId: null,
      activeOrders: [],
      selectedItem: null,
      orderLoading: false,
      menuItems: [],
      error: null,
      selectedOrderType: keepTable ? DINE_IN : DEFAULT_ORDER_TYPE,
      orderComment: '',
      orderAllergyNote: '',
      invoicePrinted: 0,
      orderStartedAt: null,
      favouriteItems: [],
      tabName: keepTable ? state.tabName : null,
    });

    fetchMenuItems();
  },

  fetchFavouriteItems: async () => {
    const { selectedCustomer } = get();
    if (!selectedCustomer?.name || selectedCustomer.name === 'Dine in') {
      set({ favouriteItems: [] });
      return;
    }
    try {
      const { call } = await import('../lib/frappe-sdk');
      const res = await call.get(
        'ury.ury.doctype.ury_order.ury_order.customer_favourite_item',
        { customer_name: selectedCustomer.name },
      );
      set({ favouriteItems: Array.isArray(res.message) ? res.message : [] });
    } catch {
      set({ favouriteItems: [] });
    }
  },

  hasTransferAccess: (userRoles: string[]) => {
    const transferRoles = get().posProfile?.transfer_roles ?? [];
    if (transferRoles.length === 0) {
      return false;
    }
    return transferRoles.some((role) => userRoles.includes(role));
  },

  isMenuInteractionDisabled: () => {
    const state = get();
    return state.menuLoading || state.profileLoading;
  },

  isOrderInteractionDisabled: () => {
    const state = get();
    return state.orderLoading;
  },

  repriceActiveOrders: () => {
    const { activeOrders, menuItems } = get();
    if (!activeOrders.length || !menuItems.length) {
      return;
    }

    const repriced = activeOrders.map((orderItem) => {
      const menuItem = menuItems.find(
        (m) => m.id === orderItem.id || m.item === orderItem.item,
      );
      if (!menuItem) {
        return orderItem;
      }

      let next: OrderItem = { ...orderItem, price: menuItem.price };
      if (orderItem.selectedVariant && menuItem.variants?.length) {
        const variant = menuItem.variants.find(
          (v) =>
            v.id === orderItem.selectedVariant?.id ||
            v.name === orderItem.selectedVariant?.name,
        );
        if (variant) {
          next = { ...next, selectedVariant: variant };
        }
      }
      return next;
    });

    set({ activeOrders: repriced });
  },

  releaseTable: () => {
    const { selectedTable, selectedOrderType } = get();
    if (selectedOrderType === DINE_IN && selectedTable) {
      set({
        selectedTable: null,
        selectedRoom: null,
        tableOrder: null,
        isUpdatingOrder: false,
        orderId: null,
      });
    }
  },

  setOrderFromSync: (invoiceName: string) => {
    set({ orderId: invoiceName, isUpdatingOrder: true });
  },

  setNoOfPax: (pax: number) => {
    const safe = Math.max(1, Math.min(20, Math.floor(pax)));
    set({ noOfPax: safe });
  },

  startDirectOrder: () => {
    set({
      selectedOrderType: DEFAULT_ORDER_TYPE,
      selectedTable: null,
      selectedRoom: null,
      selectedCustomer: defaultCustomerForType(DEFAULT_ORDER_TYPE),
      selectedAggregator: null,
      activeOrders: [],
      isUpdatingOrder: false,
      orderId: null,
      tableOrder: null,
      orderComment: '',
      orderAllergyNote: '',
      tabName: null,
      noOfPax: 1,
    });
    void get().fetchMenuItems();
  },

  startTabOrder: (name: string) => {
    set({
      selectedOrderType: DEFAULT_ORDER_TYPE,
      selectedTable: null,
      selectedRoom: null,
      selectedCustomer: { id: name, name, phone: '' },
      selectedAggregator: null,
      activeOrders: [],
      isUpdatingOrder: false,
      orderId: null,
      tableOrder: null,
      orderComment: '',
      orderAllergyNote: '',
      tabName: name,
      noOfPax: 1,
    });
    void get().fetchMenuItems();
  },

  restoreDraftCart: () => {
    try {
      const raw = sessionStorage.getItem('ury_pos_draft_cart');
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as OrderItem[];
      if (Array.isArray(parsed) && parsed.length > 0 && get().activeOrders.length === 0) {
        set({ activeOrders: parsed });
      }
    } catch {
      sessionStorage.removeItem('ury_pos_draft_cart');
    }
  },
})); 