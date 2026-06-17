const UI_SCALE_KEY = "palawansu_ui_scale";
const DEFAULT_UI_SCALE = 1;
const MIN_UI_SCALE = 0.8;
const MAX_UI_SCALE = 1.2;

export function clampUiScale(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_UI_SCALE;
  return Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, value));
}

export function getStoredUiScale(): number {
  const raw = localStorage.getItem(UI_SCALE_KEY);
  if (!raw) return DEFAULT_UI_SCALE;
  const parsed = Number(raw);
  return clampUiScale(parsed);
}

export function applyUiScale(value: number, persist = true): number {
  const scale = clampUiScale(value);
  document.documentElement.style.setProperty("--ui-scale", String(scale));
  if (persist) {
    localStorage.setItem(UI_SCALE_KEY, String(scale));
  }
  return scale;
}

export function resetUiScale() {
  applyUiScale(DEFAULT_UI_SCALE);
}

export const uiScaleConfig = {
  key: UI_SCALE_KEY,
  default: DEFAULT_UI_SCALE,
  min: MIN_UI_SCALE,
  max: MAX_UI_SCALE,
};
