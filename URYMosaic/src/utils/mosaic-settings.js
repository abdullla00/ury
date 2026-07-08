const KEYS = {
  wallMode: "mosaicWallMode",
  audioMuted: "mosaicAudioMuted",
  audioEnabled: "mosaicAudioEnabled",
  wallDefault: "mosaicWallDefault",
  stationSwitcher: "mosaicStationMode",
  fontSize: "mosaicFontSize",
  pinnedKots: "mosaicPinnedKots",
  onboardingDone: "mosaicOnboardingDone",
};

export function getSetting(key, fallback = null) {
  const val = localStorage.getItem(KEYS[key] ?? key);
  if (val === null) return fallback;
  return val;
}

export function setSetting(key, value) {
  localStorage.setItem(KEYS[key] ?? key, value);
}

export function getBoolSetting(key, fallback = false) {
  const val = getSetting(key);
  if (val === null) return fallback;
  return val === "1" || val === "true";
}

export function setBoolSetting(key, value) {
  setSetting(key, value ? "1" : "0");
}

export function getPinnedKots() {
  try {
    return JSON.parse(getSetting("pinnedKots", "[]")) || [];
  } catch {
    return [];
  }
}

export function setPinnedKots(names) {
  setSetting("pinnedKots", JSON.stringify(names));
}

export function togglePinnedKot(name) {
  const pinned = getPinnedKots();
  const idx = pinned.indexOf(name);
  if (idx >= 0) {
    pinned.splice(idx, 1);
  } else {
    pinned.unshift(name);
  }
  setPinnedKots(pinned);
  return pinned;
}

export function isStationSwitcherEnabled() {
  return getBoolSetting("stationSwitcher", true);
}

export function getFontSizeClass() {
  return getSetting("fontSize", "normal") === "large" ? "mosaic-font-large" : "";
}
