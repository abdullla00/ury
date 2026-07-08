import { ref } from "vue";
import { frappeCall } from "../utils/frappe-client.js";

export function useKotActions({ onSuccess, loggedUser }) {
  const actionLoading = ref(false);
  const actionError = ref(null);

  async function serveKot(kot) {
    actionLoading.value = true;
    actionError.value = null;
    const now = new Date();
    const time = now.toLocaleTimeString();
    try {
      await frappeCall.post("ury.ury.api.ury_kot_display.serve_kot", {
        name: kot.name,
        time,
      });
      clearStrikeStorage(kot.name);
      if (navigator.vibrate) navigator.vibrate(10);
      onSuccess?.("serve", kot);
    } catch (err) {
      actionError.value = err?.message || "Failed to serve ticket";
      throw err;
    } finally {
      actionLoading.value = false;
    }
  }

  async function confirmCancelKot(kot) {
    actionLoading.value = true;
    actionError.value = null;
    try {
      await frappeCall.post("ury.ury.api.ury_kot_display.confirm_cancel_kot", {
        name: kot.name,
        user: loggedUser.value,
      });
      clearStrikeStorage(kot.name);
      onSuccess?.("confirm", kot);
    } catch (err) {
      actionError.value = err?.message || "Failed to confirm cancellation";
      throw err;
    } finally {
      actionLoading.value = false;
    }
  }

  async function recallKot(kot) {
    actionLoading.value = true;
    actionError.value = null;
    try {
      await frappeCall.post("ury.ury.api.ury_kot_display.recall_kot", {
        name: kot.name,
      });
      onSuccess?.("recall", kot);
    } catch (err) {
      actionError.value = err?.message || "Failed to recall ticket";
      throw err;
    } finally {
      actionLoading.value = false;
    }
  }

  async function markKotReady(kot) {
    actionLoading.value = true;
    actionError.value = null;
    try {
      await frappeCall.post("ury.ury.api.ury_kot_display.mark_kot_ready", {
        name: kot.name,
      });
      onSuccess?.("ready", kot);
    } catch (err) {
      actionError.value = err?.message || "Failed to mark ticket ready";
      throw err;
    } finally {
      actionLoading.value = false;
    }
  }

  async function markKotItemReady(kot, kotitem, ready) {
    try {
      await frappeCall.post("ury.ury.api.ury_kot_display.mark_kot_item_ready", {
        name: kot.name,
        item_name: kotitem.name,
        ready: ready ? 1 : 0,
      });
    } catch {
      /* keep local strike state */
    }
  }

  return { actionLoading, actionError, serveKot, confirmCancelKot, recallKot, markKotReady, markKotItemReady };
}

function clearStrikeStorage(kotName) {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(`${kotName}_`)) {
      localStorage.removeItem(key);
    }
  });
}
