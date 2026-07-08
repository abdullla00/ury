const ORDER_TYPE_STRIPE = {
  "Dine In": "border-l-emerald-500",
  "Take Away": "border-l-sky-500",
  Delivery: "border-l-orange-500",
  "Phone In": "border-l-violet-500",
  Aggregators: "border-l-amber-500",
};

export function useKotCardStyle() {
  function getCardClasses(kot) {
    const classes = ["border-l-4"];
    const stripe = ORDER_TYPE_STRIPE[kot.order_type] || "border-l-gray-300";
    classes.push(stripe);

    if (kot.type === "Order Modified") {
      classes.push("bg-amber-50 border border-amber-200");
    } else if (kot.type === "Partially cancelled" || kot.type === "Cancelled") {
      classes.push("bg-red-50 border border-red-200");
    } else if (!kot.restaurant_table || kot.table_takeaway) {
      classes.push("bg-sky-50 border border-sky-200");
    } else {
      classes.push("bg-white border border-gray-200");
    }

    if (kot.order_status === "Served") {
      classes.push("opacity-75");
    }

    return classes.join(" ");
  }

  function getTimerClasses(kot, kotAlertTime) {
    const elapsed =
      kot.elapsed_minutes ?? kot._elapsed ?? 0;
    const alert = parseInt(kotAlertTime, 10) || 0;
    if (alert && elapsed >= alert) {
      return "text-red-600 animate-pulse";
    }
    return "text-gray-900";
  }

  function getTypeBadge(kot) {
    if (kot.type === "Duplicate") {
      return { label: "Duplicate — CHECK WITH CAPTAIN", class: "text-red-600 font-semibold text-sm" };
    }
    if (kot.type === "Order Modified") {
      return { label: "Modified", class: "bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full" };
    }
    if (kot.type === "Cancelled" || kot.type === "Partially cancelled") {
      return { label: kot.type, class: "bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full" };
    }
    return null;
  }

  return { getCardClasses, getTimerClasses, getTypeBadge };
}
