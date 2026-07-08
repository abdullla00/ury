import { ref, onUnmounted } from "vue";
import io from "socket.io-client";
import { siteUrl } from "../utils/frappe-client.js";

let socketInstance = null;
let siteNamePromise = null;

async function getSiteName() {
  if (window.globalSiteName) return window.globalSiteName;
  if (!siteNamePromise) {
    siteNamePromise = fetch(
      "/api/method/ury.ury.api.ury_kot_display.get_site_name",
      { headers: { "Content-Type": "application/json" } },
    )
      .then((r) => r.json())
      .then((data) => {
        window.globalSiteName = data.message?.site_name || "";
        return window.globalSiteName;
      })
      .catch(() => "");
  }
  return siteNamePromise;
}

export function useKotSocket() {
  const connected = ref(false);
  const usingPoll = ref(false);
  let pollInterval = null;
  let debounceTimer = null;
  let channelHandler = null;

  async function connect(channel, { onUpdate, onAudio }) {
    const site = await getSiteName();
    if (!site) {
      usingPoll.value = true;
      startPoll(onUpdate);
      return;
    }

    const siteUrlFull = `${siteUrl}/${site}`;
    socketInstance = io(siteUrlFull, { withCredentials: true });

    socketInstance.on("connect", () => {
      connected.value = true;
      usingPoll.value = false;
      stopPoll();
    });

    socketInstance.on("disconnect", () => {
      connected.value = false;
      usingPoll.value = true;
      startPoll(onUpdate);
    });

    socketInstance.on("connect_error", () => {
      connected.value = false;
      usingPoll.value = true;
      startPoll(onUpdate);
    });

    channelHandler = (doc) => {
      if (doc?.audio_file && onAudio) {
        onAudio(doc.audio_file);
      }
      scheduleRefetch(onUpdate);
    };

    socketInstance.on(channel, channelHandler);
  }

  function scheduleRefetch(onUpdate) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onUpdate?.();
    }, 400);
  }

  function startPoll(onUpdate) {
    if (pollInterval) return;
    pollInterval = setInterval(() => {
      onUpdate?.();
    }, 30000);
  }

  function stopPoll() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function disconnect() {
    if (debounceTimer) clearTimeout(debounceTimer);
    stopPoll();
    if (socketInstance && channelHandler) {
      socketInstance.offAny?.();
      socketInstance.disconnect();
      socketInstance = null;
    }
  }

  onUnmounted(disconnect);

  return { connected, usingPoll, connect, disconnect };
}
