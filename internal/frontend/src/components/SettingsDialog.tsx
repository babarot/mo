import type { Settings } from "../lib/settings";
import { getEffectiveTheme } from "../lib/settings";
import { EDITOR_COLOR_SCHEMES } from "../lib/editorThemes";

interface SettingsDialogProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsDialog({ settings, onChange, onClose }: SettingsDialogProps) {
  const update = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-lg border border-gh-border bg-gh-bg p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gh-text">Settings</h2>
          <button
            className="text-gh-text-secondary hover:text-gh-text cursor-pointer"
            onClick={onClose}
          >
            <svg
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Appearance */}
        <Section title="Appearance">
          {/* Theme */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gh-text mb-2">Theme</label>
            <div className="flex gap-1">
              {(["auto", "dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-md border cursor-pointer transition-colors ${
                    settings.theme === t
                      ? "bg-gh-bg-active border-gh-text-secondary text-gh-text"
                      : "bg-gh-bg-secondary border-gh-border text-gh-text-secondary hover:bg-gh-bg-hover"
                  }`}
                  onClick={() => update({ theme: t })}
                >
                  {t === "auto" ? "Auto" : t === "dark" ? "Dark" : "Light"}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gh-text mb-2">Font size</label>
            <div className="flex gap-1">
              {(["small", "medium", "large", "xlarge"] as const).map((s) => (
                <button
                  key={s}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-md border cursor-pointer transition-colors ${
                    settings.fontSize === s
                      ? "bg-gh-bg-active border-gh-text-secondary text-gh-text"
                      : "bg-gh-bg-secondary border-gh-border text-gh-text-secondary hover:bg-gh-bg-hover"
                  }`}
                  onClick={() => update({ fontSize: s })}
                >
                  {s === "xlarge" ? "XL" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Wide layout */}
          <Toggle
            label="Wide layout"
            description="Remove max-width constraint on content"
            checked={settings.wide}
            onChange={(v) => update({ wide: v })}
          />
        </Section>

        {/* Editor */}
        <Section title="Editor">
          {/* Color Scheme */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gh-text mb-2">Color scheme</label>
            <div className="grid grid-cols-4 gap-2">
              {EDITOR_COLOR_SCHEMES.map((scheme) => {
                const mode = getEffectiveTheme(settings.theme);
                const colors = scheme[mode];
                const isActive = settings.editorColorScheme === scheme.name;
                return (
                  <button
                    key={scheme.name}
                    className={`rounded-md border p-2 cursor-pointer transition-all ${
                      isActive
                        ? "border-blue-500 ring-1 ring-blue-500"
                        : "border-gh-border hover:border-gh-text-secondary"
                    }`}
                    onClick={() => update({ editorColorScheme: scheme.name })}
                  >
                    <div
                      className="rounded h-7 mb-1 flex items-center gap-0.5 px-1.5 overflow-hidden"
                      style={{ background: colors.bg }}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: colors.cursor }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: colors.text }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: colors.gutterText }}
                      />
                      <div
                        className="flex-1 h-0.5 rounded ml-0.5"
                        style={{ background: colors.activeLineBg }}
                      />
                    </div>
                    <div className="text-[11px] text-center truncate text-gh-text-secondary">
                      {scheme.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Toggle
            label="Line wrapping"
            description="Wrap long lines at the editor edge"
            checked={settings.editorLineWrapping}
            onChange={(v) => update({ editorLineWrapping: v })}
          />
          <Toggle
            label="Block cursor"
            description="Use block cursor instead of line cursor"
            checked={settings.editorBlockCursor}
            onChange={(v) => update({ editorBlockCursor: v })}
          />
          <Toggle
            label="Auto save"
            description="Automatically save after 1 second of inactivity"
            checked={settings.editorAutoSave}
            onChange={(v) => update({ editorAutoSave: v })}
          />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gh-text-secondary mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm text-gh-text">{label}</div>
        <div className="text-xs text-gh-text-secondary">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-blue-500" : "bg-gh-bg-active"
        }`}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
