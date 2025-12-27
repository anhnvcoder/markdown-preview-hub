/**
 * SettingsModal component
 * Theme selection, ignored folders, polling intervals
 */
import { useState, useEffect } from 'preact/hooks';
import { isSettingsOpen, closeSettings } from '../lib/keyboard';
import { getSettings, saveSettings } from '../lib/database';
import { updatePollingInterval } from '../lib/polling';
import { showToc as showTocSignal } from '../stores/theme-store';
import type { AppSettings } from '../types';

const DEFAULT_IGNORED = [
  // JavaScript/Node
  'node_modules', '.npm', '.yarn', '.pnpm-store',
  // Build outputs
  'dist', 'build', 'out', 'target', 'bin', 'obj',
  // Framework specific
  '.next', '.nuxt', '.astro', '.svelte-kit', '.vercel', '.netlify',
  // Python
  '__pycache__', '.venv', 'venv', 'env', '.eggs', '*.egg-info',
  // Ruby
  'vendor', '.bundle',
  // Rust/Go
  'target', 'vendor',
  // Java/Kotlin
  '.gradle', '.mvn',
  // IDE/Editor
  '.idea', '.vscode', '.vs', '*.swp',
  // Version control
  '.git', '.svn', '.hg',
  // Cache/Temp
  '.cache', '.temp', '.tmp', 'tmp', 'temp',
  // Misc
  'coverage', '.nyc_output', '.turbo', '.parcel-cache',
];

// Polling interval options
const INTERVAL_OPTIONS = [
  { label: '30 seconds', value: 30000 },
  { label: '1 minute', value: 60000 },
  { label: '2 minutes', value: 120000 },
  { label: '5 minutes', value: 300000 },
];

export function SettingsModal() {
  const isOpen = isSettingsOpen.value;
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ignoredText, setIgnoredText] = useState('');

  // Load settings on open
  useEffect(() => {
    if (isOpen) {
      getSettings().then(s => {
        setSettings(s);
        setIgnoredText(s.ignoredFolders.join(', '));
      });
    }
  }, [isOpen]);

  if (!isOpen || !settings) return null;

  const handleThemeChange = async (theme: 'dark' | 'light' | 'system') => {
    await saveSettings({ theme });
    setSettings({ ...settings, theme });

    // Apply theme - set className directly (not toggle)
    let appliedTheme = theme;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      appliedTheme = prefersDark ? 'dark' : 'light';
    }

    document.documentElement.className = appliedTheme;
    localStorage.setItem('md-preview-theme', appliedTheme);
  };

  const handlePollingIntervalChange = async (intervalMs: number) => {
    await saveSettings({ pollingActiveInterval: intervalMs });
    setSettings({ ...settings, pollingActiveInterval: intervalMs });
    await updatePollingInterval(intervalMs);
  };

  const handleIgnoredChange = (e: Event) => {
    setIgnoredText((e.target as HTMLTextAreaElement).value);
  };

  // Auto-save ignored folders on blur
  const handleIgnoredBlur = async () => {
    const folders = ignoredText.split(',').map(s => s.trim()).filter(Boolean);
    if (folders.length > 0) {
      await saveSettings({ ignoredFolders: folders });
      setSettings({ ...settings, ignoredFolders: folders });
    }
  };

  const handleReset = async () => {
    await saveSettings({
      theme: 'dark',
      pollingActiveInterval: 30000,
      directoryScanInterval: 60000,
      ignoredFolders: DEFAULT_IGNORED,
      showToc: false,
    });
    setSettings({
      theme: 'dark',
      pollingActiveInterval: 30000,
      directoryScanInterval: 60000,
      ignoredFolders: DEFAULT_IGNORED,
      showToc: false,
    });
    setIgnoredText(DEFAULT_IGNORED.join(', '));
    document.documentElement.className = 'dark';
    localStorage.setItem('md-preview-theme', 'dark');
    await updatePollingInterval(30000);
    showTocSignal.value = false;
  };

  const handleTocToggle = async () => {
    const newValue = !settings.showToc;
    await saveSettings({ showToc: newValue });
    setSettings({ ...settings, showToc: newValue });
    showTocSignal.value = newValue;  // Update signal for reactive components
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-card border border-border rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-border">
          <div class="flex items-center gap-2">
            <div class="i-lucide-settings w-5 h-5" />
            <h2 class="font-semibold">Settings</h2>
          </div>
          <button class="btn-icon" onClick={closeSettings} aria-label="Close">
            <div class="i-lucide-x w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Theme */}
          <div>
            <label class="block text-sm font-medium mb-2">Theme</label>
            <div class="flex gap-2">
              {(['dark', 'light', 'system'] as const).map(t => (
                <button
                  key={t}
                  class={`px-4 py-2 rounded text-sm ${
                    settings.theme === t ? 'bg-primary text-white' : 'bg-muted'
                  }`}
                  onClick={() => handleThemeChange(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Table of Contents */}
          <div>
            <label class="block text-sm font-medium mb-2">Table of Contents</label>
            <div class="flex items-center gap-3">
              <button
                class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.showToc ? 'bg-primary' : 'bg-muted'
                }`}
                onClick={handleTocToggle}
                role="switch"
                aria-checked={settings.showToc}
              >
                <span
                  class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.showToc ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span class="text-sm text-muted-foreground">
                {settings.showToc ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              Show floating table of contents for markdown documents
            </p>
          </div>

          {/* Polling Interval */}
          <div>
            <label class="block text-sm font-medium mb-2">Sync Interval (Active File)</label>
            <p class="text-xs text-muted-foreground mb-3">
              How often to check for changes in the currently open file
            </p>
            <div class="flex flex-wrap gap-2">
              {INTERVAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  class={`px-3 py-1.5 rounded text-sm ${
                    settings.pollingActiveInterval === opt.value
                      ? 'bg-primary text-white'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                  onClick={() => handlePollingIntervalChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              Directory scan: every 60s | Tab focus: instant sync
            </p>
          </div>

          {/* Ignored folders */}
          <div>
            <label class="block text-sm font-medium mb-2">Ignored Folders</label>
            <textarea
              class="w-full h-24 p-2 bg-muted rounded text-sm resize-none"
              value={ignoredText}
              onInput={handleIgnoredChange}
              onBlur={handleIgnoredBlur}
              placeholder="node_modules, .git, dist..."
            />
            <p class="text-xs text-muted-foreground mt-2">
              Comma-separated list. Changes save automatically.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div class="flex items-center justify-between p-4 border-t border-border">
          <button class="btn-ghost text-xs text-destructive" onClick={handleReset}>
            Reset to Defaults
          </button>
          <button class="btn-primary" onClick={closeSettings}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
