export function getProductionFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("URYMosaic");
  if (idx >= 0 && parts[idx + 1]) {
    return decodeURIComponent(parts[idx + 1]);
  }
  const last = parts[parts.length - 1];
  return last ? decodeURIComponent(last) : "";
}

export function formatElapsedMinutes(minutes) {
  const m = Math.max(0, Math.floor(minutes || 0));
  if (m < 60) return `${m}′`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}′` : `${h}h`;
}

export function computeElapsedFromTime(targetTime) {
  if (!targetTime) return 0;
  const currentTime = new Date();
  const parts = String(targetTime).split(":");
  if (parts.length < 2) return 0;
  const targetDate = new Date(
    currentTime.getFullYear(),
    currentTime.getMonth(),
    currentTime.getDate(),
    parseInt(parts[0], 10),
    parseInt(parts[1], 10),
    parts[2] ? parseInt(parts[2], 10) : 0,
  );
  if (targetDate > currentTime) {
    targetDate.setDate(targetDate.getDate() - 1);
  }
  return Math.max(0, Math.floor((currentTime - targetDate) / 60000));
}

export function getTableLabel(kot) {
  if (kot.table_label) return kot.table_label;
  if (kot.tableortakeaway) return kot.tableortakeaway;
  if (!kot.restaurant_table || kot.table_takeaway) return "Takeaway";
  return kot.restaurant_table;
}

export function getOrderDisplayNo(kot, dailyOrderNumber) {
  if (dailyOrderNumber && kot.order_no) return kot.order_no;
  return kot.invoice ? String(kot.invoice).slice(-4) : "";
}

export function sortKotItems(items) {
  return [...(items || [])].sort(
    (a, b) => (a.serve_priority || 0) - (b.serve_priority || 0),
  );
}

export function effectiveItemQty(kotitem, kotType) {
  const qty = parseFloat(kotitem.quantity) || 0;
  const cancelled = parseFloat(kotitem.cancelled_qty) || 0;
  if (kotType === "Partially cancelled" || kotType === "Cancelled") {
    return Math.max(0, qty - cancelled);
  }
  return kotitem.qty ?? qty;
}

export function filterKotsBySearch(kots, query) {
  if (!query) return kots;
  const q = query.toLowerCase().trim();
  return kots.filter((kot) => {
    const table = getTableLabel(kot).toLowerCase();
    const orderNo = String(kot.order_no || kot.invoice || "").toLowerCase();
    const user = String(kot.user || "").toLowerCase();
    return table.includes(q) || orderNo.includes(q) || user.includes(q);
  });
}

export function dedupeKotsByName(kots) {
  const seen = new Set();
  return kots.filter((kot) => {
    if (seen.has(kot.name)) return false;
    seen.add(kot.name);
    return true;
  });
}

export function parseItemDisplayName(itemName) {
  const raw = itemName || "";
  const match = raw.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (!match) {
    return { baseName: raw, modifiers: [] };
  }
  const baseName = match[1].trim();
  const modifiers = match[2]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return { baseName, modifiers };
}

export function getItemDisplayParts(kotitem) {
  if (kotitem.modifier_text) {
    const mods = String(kotitem.modifier_text)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      baseName: kotitem.item_name?.split(" (")[0] || kotitem.item_name || "",
      modifiers: mods,
    };
  }
  return parseItemDisplayName(kotitem.item_name);
}

export function getTableGroupKey(kot) {
  return `${kot.restaurant_table || "tw"}_${kot.invoice || kot.name}`;
}

const PRIORITY_TYPES = new Set(["Order Modified", "Cancelled", "Partially cancelled"]);

export function sortKotsForBoard(kots, pinnedNames = []) {
  const pinned = new Set(pinnedNames);
  const groups = new Map();

  kots.forEach((kot) => {
    const key = getTableGroupKey(kot);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(kot);
  });

  const groupEntries = [...groups.entries()].map(([key, items]) => {
    const sortedItems = [...items].sort((a, b) => {
      const aPriority = PRIORITY_TYPES.has(a.type) ? 1 : 0;
      const bPriority = PRIORITY_TYPES.has(b.type) ? 1 : 0;
      if (bPriority !== aPriority) return bPriority - aPriority;
      return (a.time || "").localeCompare(b.time || "");
    });
    const head = sortedItems[0];
    const aDelay = head._isDelayed ? 1 : 0;
    return { key, items: sortedItems, head, aDelay };
  });

  groupEntries.sort((a, b) => {
    const aPinned = pinned.has(a.head.name) ? 1 : 0;
    const bPinned = pinned.has(b.head.name) ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;
    if (b.aDelay !== a.aDelay) return b.aDelay - a.aDelay;
    return (a.head.time || "").localeCompare(b.head.time || "");
  });

  return groupEntries.flatMap((g) => g.items);
}

export function getTicketCounts(kots) {
  const tableGroups = {};
  kots.forEach((kot) => {
    const key = getTableGroupKey(kot);
    tableGroups[key] = (tableGroups[key] || 0) + 1;
  });
  const result = {};
  kots.forEach((kot) => {
    result[kot.name] = tableGroups[getTableGroupKey(kot)] || 1;
  });
  return result;
}
