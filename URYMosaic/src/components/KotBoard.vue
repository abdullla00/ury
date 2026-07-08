<template>
  <div class="min-h-screen bg-gray-50 pb-8" :class="fontSizeClass">
    <KotLoginModal :show="showLogin" @login="redirectToLogin" />
    <KotAudioGate :show="showAudioGate" />
    <KotOnboarding :show="showOnboarding" @done="showOnboarding = false" />
    <KotToast :message="toastMessage" :type="toastType" />

    <div
      v-if="!isOnline"
      class="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white"
    >
      {{ t("offline") }}
    </div>

    <KotToolbar
      ref="toolbarRef"
      :production="production"
      :units="productionUnits"
      :connected="socketConnected"
      :using-poll="usingPoll"
      :audio-muted="audioMuted"
      :wall-mode="wallMode"
      :show-station-switcher="showStationSwitcher"
      :to-cook-count="stats.toCook"
      @refresh="refresh"
      @toggle-mute="toggleMute"
      @toggle-wall="toggleWall"
      @search="searchQuery = $event"
      @open-settings="showSettings = true"
    />

    <KotStatsBar
      v-if="!wallMode"
      :to-cook="stats.toCook"
      :delayed="stats.delayed"
      :avg-wait="stats.avgWait"
      :completed="stats.completed"
      :kot-alert-time="kotAlertTime"
    />

    <KotStatusTabs
      v-if="!wallMode"
      :tabs="tabList"
      :active-tab="activeTab"
      @change="setActiveTab"
    />

    <div v-if="loading" class="grid gap-5 p-4" :class="gridClasses">
      <div
        v-for="n in 4"
        :key="n"
        class="animate-pulse rounded-xl bg-gray-200"
        :class="wallMode ? 'h-64' : 'h-48'"
      />
    </div>

    <div
      v-else-if="displayKots.length === 0"
      class="flex flex-col items-center justify-center px-4 py-24 text-center text-gray-500"
    >
      <p class="text-lg font-medium">{{ emptyMessage }}</p>
      <p v-if="searchQuery" class="mt-2">
        <button type="button" class="text-primary-600 hover:underline" @click="searchQuery = ''">
          {{ t("clear_search") }}
        </button>
      </p>
    </div>

    <div v-else class="grid p-4" :class="gridClasses">
      <KotCard
        v-for="(kot, index) in displayKots"
        :key="kot.name"
        :kot="kot"
        :daily-order-number="!!dailyOrderNumber"
        :kot-alert-time="kotAlertTime"
        :wall-mode="wallMode"
        :is-new="newKotNames.has(kot.name)"
        :is-selected="selectedIndex === index"
        :ticket-count="ticketCounts[kot.name] || 1"
        :enable-reprint="!!enableKotReprint"
        :pinned="pinnedKots.includes(kot.name)"
        :show-station-badge="isExpoMode"
        @open="openServeSheet"
        @quick-serve="quickServe"
        @recall="openRecallSheet"
        @swipe-up="openServeSheet"
        @reprint="handleReprint"
        @copy-order="showToastMsg(t('toast_copied'))"
        @jump-completed="activeTab = 'completed'"
        @pin="handlePin"
        @mark-ready="handleMarkReady"
        @toggle-strike="handleToggleStrike"
      />
    </div>

    <KotServeSheet
      :kot="serveKot"
      :daily-order-number="!!dailyOrderNumber"
      :loading="actionLoading"
      :action-error="actionError"
      @close="serveKot = null"
      @confirm="handleServeConfirm"
    />

    <KotRecallSheet
      :kot="recallKotTarget"
      :daily-order-number="!!dailyOrderNumber"
      :loading="actionLoading"
      :action-error="actionError"
      @close="recallKotTarget = null"
      @confirm="handleRecallConfirm"
    />

    <KotSettingsPanel
      :show="showSettings"
      @close="showSettings = false"
      @save="applySettings"
      @sound-test="playSoundTest"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import { frappe, frappeCall } from "../utils/frappe-client.js";
import {
  getProductionFromUrl,
  filterKotsBySearch,
  computeElapsedFromTime,
  formatElapsedMinutes,
  sortKotsForBoard,
  getTicketCounts,
} from "../utils/kot-format.js";
import {
  getBoolSetting,
  getPinnedKots,
  togglePinnedKot,
  isStationSwitcherEnabled,
  getFontSizeClass,
} from "../utils/mosaic-settings.js";
import { t } from "../utils/mosaic-i18n.js";
import { useKotData } from "../composables/useKotData.js";
import { useKotSocket } from "../composables/useKotSocket.js";
import { useKotTimer } from "../composables/useKotTimer.js";
import { useKotActions } from "../composables/useKotActions.js";

import KotToolbar from "./KotToolbar.vue";
import KotStatsBar from "./KotStatsBar.vue";
import KotStatusTabs from "./KotStatusTabs.vue";
import KotCard from "./KotCard.vue";
import KotServeSheet from "./KotServeSheet.vue";
import KotRecallSheet from "./KotRecallSheet.vue";
import KotLoginModal from "./KotLoginModal.vue";
import KotAudioGate from "./KotAudioGate.vue";
import KotOnboarding from "./KotOnboarding.vue";
import KotSettingsPanel from "./KotSettingsPanel.vue";
import KotToast from "./KotToast.vue";

const route = useRoute();
const production = ref(
  route.params.production
    ? decodeURIComponent(String(route.params.production))
    : getProductionFromUrl(),
);

const loggedUser = ref("");
const showLogin = ref(false);
const activeTab = ref("cook");
const searchQuery = ref("");
const wallMode = ref(
  getBoolSetting("wallMode", false) || getBoolSetting("wallDefault", false),
);
const audioMuted = ref(getBoolSetting("audioMuted", false));
const isOnline = ref(navigator.onLine);
const productionUnits = ref([]);
const serveKot = ref(null);
const recallKotTarget = ref(null);
const newKotNames = ref(new Set());
const knownKotNames = ref(new Set());
const toolbarRef = ref(null);
const selectedIndex = ref(0);
const showSettings = ref(false);
const showStationSwitcher = ref(isStationSwitcherEnabled());
const showOnboarding = ref(!getBoolSetting("onboardingDone", false));
const pinnedKots = ref(getPinnedKots());
const fontSizeClass = ref(getFontSizeClass());
const toastMessage = ref("");
const toastType = ref("info");
const wakeLock = ref(null);
const initialLoadDone = ref(false);
let toastTimer = null;

const {
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
  fetchAll,
  filterByProduction,
} = useKotData();

const { connected: socketConnected, usingPoll, connect, disconnect } = useKotSocket();
const { tickKots, startTimer, stopTimer } = useKotTimer({ kotAlertTime });

const { actionLoading, actionError, serveKot: doServe, confirmCancelKot, recallKot, markKotReady, markKotItemReady } =
  useKotActions({
    loggedUser,
    onSuccess: () => refresh(),
  });

const showAudioGate = computed(
  () => audioAlert.value === 1 && !audioMuted.value && !getBoolSetting("audioEnabled", false),
);

const isExpoMode = computed(
  () => String(production.value || "").toLowerCase() === "expo",
);

const productionActive = computed(() =>
  filterByProduction(activeKots.value, production.value),
);
const productionReady = computed(() =>
  filterByProduction(readyKots.value, production.value),
);
const productionServed = computed(() =>
  filterByProduction(servedKots.value, production.value),
);

const tabKots = computed(() => {
  if (activeTab.value === "cook") return productionActive.value;
  if (activeTab.value === "ready") return productionReady.value;
  if (activeTab.value === "completed") return productionServed.value;
  return [...productionActive.value, ...productionReady.value, ...productionServed.value];
});

const displayKots = computed(() => {
  const kots = sortKotsForBoard(tabKots.value, pinnedKots.value);
  return filterKotsBySearch(kots, searchQuery.value);
});

const ticketCounts = computed(() => getTicketCounts(displayKots.value));

const tabList = computed(() => [
  { id: "all", label: t("all"), count: productionActive.value.length + productionReady.value.length + productionServed.value.length },
  { id: "cook", label: t("to_cook"), count: productionActive.value.length },
  { id: "ready", label: t("ready"), count: productionReady.value.length },
  { id: "completed", label: t("completed"), count: productionServed.value.length },
]);

const stats = computed(() => {
  const cook = productionActive.value;
  const delayed = cook.filter((k) => k._isDelayed).length;
  const elapsed = cook.map((k) => k._elapsed || 0);
  const avgWait = elapsed.length
    ? Math.round(elapsed.reduce((a, b) => a + b, 0) / elapsed.length)
    : 0;
  return {
    toCook: cook.length,
    delayed,
    avgWait,
    completed: productionServed.value.length,
  };
});

const gridClasses = computed(() =>
  wallMode.value
    ? "grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    : "grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
);

const emptyMessage = computed(() => {
  if (searchQuery.value) return `${t("empty_search")} "${searchQuery.value}"`;
  if (activeTab.value === "completed") return t("empty_completed");
  if (activeTab.value === "ready") return t("empty_ready");
  if (activeTab.value === "cook") return t("empty_cook");
  return t("empty_all");
});

watch(
  () => route.params.production,
  (val) => {
    if (!val) return;
    production.value = decodeURIComponent(String(val));
    reconnectSocket();
    refresh();
  },
);

function showToastMsg(message, type = "info") {
  toastMessage.value = message;
  toastType.value = type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = "";
  }, 3000);
}

function markNewKots(kots) {
  if (!initialLoadDone.value) {
    knownKotNames.value = new Set(kots.map((k) => k.name));
    initialLoadDone.value = true;
    return;
  }
  const next = new Set();
  kots.forEach((kot) => {
    if (!knownKotNames.value.has(kot.name) && kot.order_status !== "Served") {
      next.add(kot.name);
    }
  });
  if (next.size) {
    newKotNames.value = next;
    setTimeout(() => {
      newKotNames.value = new Set();
    }, 3000);
  }
  knownKotNames.value = new Set(kots.map((k) => k.name));
}

function hydrateStrikeState(kots) {
  kots.forEach((kot) => {
    (kot.kot_items || []).forEach((item) => {
      const markedReady = item.marked_ready === 1 || item.marked_ready === true;
      if (markedReady) {
        item.striked = true;
        localStorage.setItem(`${kot.name}_${item.name}_strike`, JSON.stringify(true));
        return;
      }
      const saved = localStorage.getItem(`${kot.name}_${item.name}_strike`);
      if (saved) {
        item.striked = JSON.parse(saved);
      }
    });
  });
}

function enrichAndTick() {
  const all = [...activeKots.value, ...readyKots.value, ...servedKots.value];
  all.forEach((kot) => {
    kot._elapsed = kot.elapsed_minutes ?? computeElapsedFromTime(kot.time);
    kot._elapsedLabel = formatElapsedMinutes(kot._elapsed);
    const alert = parseInt(kotAlertTime.value, 10) || 0;
    kot._isDelayed = kot.is_delayed ?? (alert > 0 && kot._elapsed >= alert);
  });
  tickKots(all);
  hydrateStrikeState(all);
  markNewKots(all);
}

async function refresh() {
  await fetchAll();
  enrichAndTick();
}

async function loadProductionUnits() {
  try {
    const result = await frappeCall.get(
      "ury.ury.api.ury_kot_display.get_production_units",
      {},
    );
    productionUnits.value = [
      ...(result.message?.units || []),
      { name: "Expo", production: "Expo" },
    ];
  } catch {
    productionUnits.value = [];
  }
}

function playAlertSound(path) {
  if (audioMuted.value || !path) return;
  const audio = new Audio(window.location.origin + path);
  audio.play().catch(() => {});
}

function playSoundTest() {
  if (kotAlertSound.value) {
    playAlertSound(kotAlertSound.value);
  }
}

function enableAudio() {
  localStorage.setItem("mosaicAudioEnabled", "1");
}

function toggleMute() {
  audioMuted.value = !audioMuted.value;
  localStorage.setItem("mosaicAudioMuted", audioMuted.value ? "1" : "0");
}

async function enterWallMode() {
  activeTab.value = "cook";
  try {
    if ("wakeLock" in navigator) {
      wakeLock.value = await navigator.wakeLock.request("screen");
    }
  } catch {
    /* optional */
  }
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    /* optional */
  }
}

async function exitWallMode() {
  try {
    if (wakeLock.value) {
      await wakeLock.value.release();
      wakeLock.value = null;
    }
  } catch {
    /* optional */
  }
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    /* optional */
  }
}

async function toggleWall() {
  wallMode.value = !wallMode.value;
  localStorage.setItem("mosaicWallMode", wallMode.value ? "1" : "0");
  if (wallMode.value) {
    await enterWallMode();
  } else {
    await exitWallMode();
  }
}

function applySettings() {
  showStationSwitcher.value = isStationSwitcherEnabled();
  fontSizeClass.value = getFontSizeClass();
  if (getBoolSetting("wallDefault", false) && !wallMode.value) {
    toggleWall();
  }
}

function setActiveTab(id) {
  activeTab.value = id;
}

function openServeSheet(kot) {
  if (kot.order_status === "Served") return;
  serveKot.value = kot;
}

function openRecallSheet(kot) {
  recallKotTarget.value = kot;
}

async function handleServeConfirm(kot) {
  actionError.value = null;
  try {
    if (kot.type === "Cancelled" || kot.type === "Partially cancelled") {
      await confirmCancelKot(kot);
    } else {
      await doServe(kot);
    }
    serveKot.value = null;
    await refresh();
  } catch {
    /* inline error */
  }
}

async function quickServe(kot) {
  try {
    await doServe(kot);
    await refresh();
  } catch {
    openServeSheet(kot);
  }
}

async function handleRecallConfirm(kot) {
  actionError.value = null;
  try {
    await recallKot(kot);
    recallKotTarget.value = null;
    activeTab.value = "cook";
    await refresh();
  } catch {
    showToastMsg(t("toast_recall_failed"), "error");
  }
}

async function handleReprint(kot) {
  if (!kot.invoice) return;
  try {
    await frappeCall.get("ury.ury.api.ury_kot_reprint.reprint_kot", {
      invoice_number: kot.invoice,
    });
    showToastMsg(t("toast_reprint_ok"));
  } catch {
    showToastMsg(t("toast_reprint_failed"), "error");
  }
}

function handlePin(kot) {
  pinnedKots.value = togglePinnedKot(kot.name);
}

async function handleMarkReady(kot) {
  try {
    await markKotReady(kot);
    activeTab.value = "ready";
    await refresh();
    showToastMsg(t("toast_ready_ok"));
  } catch {
    showToastMsg(t("toast_ready_failed"), "error");
  }
}

function handleToggleStrike({ kot, kotitem }) {
  markKotItemReady(kot, kotitem, kotitem.striked);
}

function reconnectSocket() {
  disconnect();
  const channel = `kot_update_${branch.value}_${production.value}`;
  connect(channel, {
    onUpdate: refresh,
    onAudio: playAlertSound,
  });
}

function redirectToLogin() {
  window.location.href = `/login?redirect-to=URYMosaic/${encodeURIComponent(production.value)}`;
}

function onKeyDown(e) {
  if (e.target.tagName === "INPUT") return;
  if (e.key === "1") setActiveTab("all");
  if (e.key === "2") setActiveTab("cook");
  if (e.key === "3") setActiveTab("ready");
  if (e.key === "4") setActiveTab("completed");
  if (e.key === "w" || e.key === "W") toggleWall();
  if (e.key === "/") {
    e.preventDefault();
    toolbarRef.value?.focusSearch?.();
  }
  if (e.key === "Escape") {
    if (serveKot.value || recallKotTarget.value) {
      serveKot.value = null;
      recallKotTarget.value = null;
      return;
    }
    if (wallMode.value) {
      toggleWall();
    }
  }
  if (e.key === "Enter" && displayKots.value[selectedIndex.value]) {
    openServeSheet(displayKots.value[selectedIndex.value]);
  }
  if ((e.key === "r" || e.key === "R") && activeTab.value === "completed") {
    const kot = displayKots.value[selectedIndex.value];
    if (kot) openRecallSheet(kot);
  }
  if (e.key === "ArrowDown") {
    selectedIndex.value = Math.min(selectedIndex.value + 1, displayKots.value.length - 1);
  }
  if (e.key === "ArrowUp") {
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
  }
}

function handleOnline() {
  isOnline.value = true;
  refresh();
}

function handleOffline() {
  isOnline.value = false;
}

onMounted(async () => {
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("click", enableAudio, { once: true });

  if (getBoolSetting("wallDefault", false)) {
    wallMode.value = true;
    await enterWallMode();
  }

  try {
    const user = await frappe.auth().getLoggedInUser();
    loggedUser.value = user;
  } catch {
    showLogin.value = true;
    return;
  }

  await loadProductionUnits();
  await refresh();

  reconnectSocket();
  startTimer(() => [...activeKots.value, ...readyKots.value, ...servedKots.value]);
});

onUnmounted(() => {
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  window.removeEventListener("keydown", onKeyDown);
  if (toastTimer) clearTimeout(toastTimer);
  stopTimer();
  disconnect();
  exitWallMode();
});
</script>
