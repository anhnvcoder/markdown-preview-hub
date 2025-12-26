/**
 * Header component
 * Logo, search, open folder, theme toggle
 */
import { openFolder, isLoading } from '../stores/file-store';
import { openSettings, isSearchOpen, modKey } from '../lib/keyboard';
import { saveSettings } from '../lib/database';
import { sidebarCollapsed, toggleSidebar } from './App';

export function Header() {
  const loading = isLoading.value;

  const handleOpenFolder = async () => {
    await openFolder();
  };

  const handleThemeToggle = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';

    // Update DOM
    document.documentElement.className = newTheme;

    // Save to localStorage for immediate access on reload
    localStorage.setItem('md-preview-theme', newTheme);

    // Also save to DB
    await saveSettings({ theme: newTheme });
  };

  const handleSearchClick = () => {
    isSearchOpen.value = true;
  };

  return (
    <header class="app-header">
      <div class="flex items-center gap-3">
        {/* Show expand sidebar button when collapsed */}
        {sidebarCollapsed.value && (
          <button
            class="btn-icon p-1"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <div class="i-lucide-panel-left w-4 h-4" />
          </button>
        )}
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary via-accent to-info flex items-center justify-center">
          <span class="text-white font-bold text-sm">MD</span>
        </div>
        <h1 class="text-lg font-semibold">Preview Hub</h1>
      </div>

      <div class="flex items-center gap-2">
        <button class="btn-ghost gap-2" aria-label="Search" onClick={handleSearchClick} title={`${modKey}K files, ${modKey}⇧K content`}>
          <div class="i-lucide-search w-4 h-4" />
          <span class="text-xs hidden sm:inline">Search</span>
          <span class="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <kbd class="px-1 py-0.5 bg-muted rounded border border-border">{modKey}K</kbd>
            <kbd class="px-1 py-0.5 bg-muted rounded border border-border">{modKey}⇧K</kbd>
          </span>
        </button>

        <button class="btn-icon" onClick={handleThemeToggle} aria-label="Toggle theme">
          <div class="i-lucide-sun w-4 h-4 dark:hidden" />
          <div class="i-lucide-moon w-4 h-4 hidden dark:block" />
        </button>

        <button class="btn-icon" aria-label="Settings" onClick={openSettings}>
          <div class="i-lucide-settings w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
