import { Globe, Phone, ShoppingBag, Truck, Utensils } from "lucide-react";

export type OrderType = "Dine In" | "Take Away" | "Delivery" | "Phone In" | "Aggregators";

export type OrderTypes= {
    label: string;
    value: OrderType;
    icon: React.ElementType;
}

export const ORDER_TYPES: OrderTypes[] = [
    {
        label: "Dine In",
        value: "Dine In",
        icon: Utensils
    },
    {
        label: "Take Away",
        value: "Take Away",
        icon: ShoppingBag
    },
    {
        label: "Delivery",
        value: "Delivery",
        icon: Truck
    },
    {
        label: "Phone In",
        value: "Phone In",
        icon: Phone
    },
    {
        label: "Aggregators",
        value: "Aggregators",
        icon: Globe
    }
]

export const DINE_IN="Dine In"
export const DEFAULT_ORDER_TYPE="Take Away"
export const DEFAULT_PAYMENT_MODE="Cash"

/** Default walk-in customers per order type (ERPNext Customer name). */
export const ORDER_TYPE_DEFAULT_CUSTOMER: Partial<Record<OrderType, string>> = {
  "Dine In": "Dine in",
  "Take Away": "Take Away",
  "Delivery": "Delivery",
};

export function isDefaultCustomerForType(
  customerName: string | undefined,
  orderType: OrderType,
): boolean {
  const def = ORDER_TYPE_DEFAULT_CUSTOMER[orderType];
  if (!def || !customerName) {
    return !customerName && Boolean(def);
  }
  return customerName.trim().toLowerCase() === def.trim().toLowerCase();
}

export type OrderStatusType = "Draft" | "Unbilled" | "Recently Paid" | "Paid" | "Consolidated" | "Return";

// Base status types that are always available
export const BASE_ORDER_STATUS_TYPES = [
    {
        label: "Draft",
        value: "Draft"
    },
    {
        label: "Unbilled",
        value: "Unbilled"
    }
];

// Recently Paid status that appears when paid_limit > 0
export const RECENTLY_PAID_STATUS_TYPE = [
    {
        label: "Recently Paid",
        value: "Recently Paid"
    }
];

// Extended status types that are only available when view_all_status is enabled
export const EXTENDED_ORDER_STATUS_TYPES = [
    {
        label: "Paid",
        value: "Paid"
    },
    {
        label: "Consolidated",
        value: "Consolidated"
    },
    {
        label: "Return",
        value: "Return"
    }
];

// Function to get order status types based on POS profile settings
export const getOrderStatusTypes = (viewAllStatus?: number, paidLimit?: number) => {
    let statusTypes = [...BASE_ORDER_STATUS_TYPES];
    
    // Recently Paid only when paid_limit > 0 and view_all_status is off
    if (paidLimit && paidLimit > 0 && viewAllStatus !== 1) {
        statusTypes.push(...RECENTLY_PAID_STATUS_TYPE);
    }
    
    // Add extended statuses if view_all_status is enabled
    if (viewAllStatus === 1) {
        statusTypes.push(...EXTENDED_ORDER_STATUS_TYPES);
    }
    
    return statusTypes;
};

// Legacy export for backward compatibility
export const ORDER_STATUS_TYPES = BASE_ORDER_STATUS_TYPES;