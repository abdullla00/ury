import { ref, onUnmounted } from "vue";
import { frappeCall } from "../utils/frappe-client.js";
import {
  computeElapsedFromTime,
  formatElapsedMinutes,
} from "../utils/kot-format.js";

export function useKotTimer({ kotAlertTime, onDelayNotify }) {
  const now = ref(new Date());
  const notifiedKots = new Set();
  let intervalId = null;

  function tickKots(kots) {
    const alert = parseInt(kotAlertTime.value, 10) || 0;
    kots.forEach((kot) => {
      const elapsed =
        kot.elapsed_minutes ?? computeElapsedFromTime(kot.time);
      kot._elapsed = elapsed;
      kot._elapsedLabel = formatElapsedMinutes(elapsed);
      kot._isDelayed = alert > 0 && elapsed >= alert;

      if (
        alert &&
        elapsed >= alert &&
        !notifiedKots.has(kot.name) &&
        kot.type !== "Cancelled" &&
        kot.type !== "Partially cancelled"
      ) {
        notifiedKots.add(kot.name);
        notifyDelay(kot);
      }
    });
  }

  async function notifyDelay(kot) {
    try {
      await frappeCall.post(
        "ury.ury.api.ury_kot_notification.order_delay_notification",
        { id: kot.name },
      );
    } catch {
      /* non-blocking */
    }
    onDelayNotify?.(kot);
  }

  function startTimer(getKots) {
    intervalId = setInterval(() => {
      now.value = new Date();
      tickKots(getKots());
    }, 30000);
    tickKots(getKots());
  }

  function stopTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  onUnmounted(stopTimer);

  return { now, tickKots, startTimer, stopTimer, formatElapsedMinutes };
}
