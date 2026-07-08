import { ref } from "vue";
import { frappeCall } from "../utils/frappe-client.js";
import { dedupeKotsByName } from "../utils/kot-format.js";

export function useKotData() {
  const activeKots = ref([]);
  const readyKots = ref([]);
  const servedKots = ref([]);
  const branch = ref("");
  const kotAlertTime = ref(0);
  const audioAlert = ref(0);
  const dailyOrderNumber = ref(0);
  const enableKotReprint = ref(0);
  const kotAlertSound = ref("");
  const loading = ref(true);
  const error = ref(null);

  function applyListMeta(result) {
    branch.value = result.Branch || "";
    kotAlertTime.value = result.kot_alert_time || 0;
    audioAlert.value = result.audio_alert || 0;
    dailyOrderNumber.value = result.daily_order_number || 0;
    enableKotReprint.value = result.enable_kot_reprint || 0;
    kotAlertSound.value = result.kot_alert_sound || "";
  }

  async function fetchActive() {
    const result = await frappeCall.get("ury.ury.api.ury_kot_display.kot_list", {});
    const data = result.message;
    applyListMeta(data);
    activeKots.value = dedupeKotsByName(data.KOT || []);
    return data;
  }

  async function fetchReady() {
    const result = await frappeCall.get("ury.ury.api.ury_kot_display.ready_kot_list", {});
    const data = result.message;
    readyKots.value = dedupeKotsByName(data.KOT || []);
    return data;
  }

  async function fetchServed() {
    const result = await frappeCall.get("ury.ury.api.ury_kot_display.served_kot_list", {});
    const data = result.message;
    servedKots.value = dedupeKotsByName(data.KOT || []);
    return data;
  }

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      await Promise.all([fetchActive(), fetchReady(), fetchServed()]);
    } catch (err) {
      error.value = err?.message || "Failed to load tickets";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function filterByProduction(kots, production) {
    if (!production || String(production).toLowerCase() === "expo") {
      return kots;
    }
    return kots.filter((k) => k.production === production);
  }

  return {
    activeKots,
    readyKots,
    servedKots,
    branch,
    kotAlertTime,
    audioAlert,
    dailyOrderNumber,
    enableKotReprint,
    kotAlertSound,
    loading,
    error,
    fetchActive,
    fetchReady,
    fetchServed,
    fetchAll,
    filterByProduction,
  };
}
