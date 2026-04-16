export interface Settings {
  theme: "auto" | "dark" | "light";
  fontSize: "small" | "medium" | "large" | "xlarge";
  wide: boolean;
  editorLineWrapping: boolean;
  editorAutoSave: boolean;
  editorColorScheme: string;
  editorBlockCursor: boolean;
}

const STORAGE_KEY = "mo-settings";

const defaults: Settings = {
  theme: "auto",
  fontSize: "medium",
  wide: false,
  editorLineWrapping: true,
  editorAutoSave: false,
  editorColorScheme: "default",
  editorBlockCursor: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    }
  } catch {
    // corrupted JSON
  }

  // Migrate from legacy per-key storage
  const migrated = { ...defaults };
  const legacyTheme = localStorage.getItem("mo-theme");
  if (legacyTheme === "dark" || legacyTheme === "light") {
    migrated.theme = legacyTheme;
  }
  const legacyFontSize = localStorage.getItem("mo-font-size");
  if (
    legacyFontSize === "small" ||
    legacyFontSize === "medium" ||
    legacyFontSize === "large" ||
    legacyFontSize === "xlarge"
  ) {
    migrated.fontSize = legacyFontSize;
  }
  const legacyWidth = localStorage.getItem("mo-layout-width");
  if (legacyWidth === "wide") {
    migrated.wide = true;
  }
  return migrated;
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage full or unavailable
  }
}

export function getEffectiveTheme(theme: Settings["theme"]): "dark" | "light" {
  if (theme === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function applyTheme(theme: Settings["theme"]): void {
  document.documentElement.setAttribute("data-theme", getEffectiveTheme(theme));
}
