import { defineConfig, presetUno, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      cdn: 'https://esm.sh/',
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  safelist: [
    // Lucide icons used in app
    'i-lucide-search', 'i-lucide-folder-open', 'i-lucide-folder',
    'i-lucide-file-text', 'i-lucide-plus', 'i-lucide-settings',
    'i-lucide-sun', 'i-lucide-moon', 'i-lucide-loader-2',
    'i-lucide-chevron-right', 'i-lucide-chevron-down',
    'i-lucide-cloud', 'i-lucide-cloud-off', 'i-lucide-pencil',
    'i-lucide-alert-triangle', 'i-lucide-check', 'i-lucide-x',
    'i-lucide-eye', 'i-lucide-hard-drive', 'i-lucide-refresh-cw',
    'i-lucide-clock', 'i-lucide-wifi', 'i-lucide-command',
    'i-lucide-copy', 'i-lucide-file-plus', 'i-lucide-folder-plus',
    'i-lucide-more-vertical', 'i-lucide-trash-2',
    'i-lucide-panel-left-close', 'i-lucide-panel-left-open',
    'i-lucide-x',
  ],
  theme: {
    colors: {
      // CSS variable based colors for theme switching
      background: 'var(--background)',
      foreground: 'var(--foreground)',
      card: 'var(--card)',
      border: 'var(--border)',
      primary: 'var(--primary)',
      accent: 'var(--accent)',
      muted: 'var(--muted)',
      'muted-foreground': 'var(--muted-foreground)',
      success: 'var(--success)',
      warning: 'var(--warning)',
      destructive: 'var(--destructive)',
      info: 'var(--info)',
      secondary: 'var(--secondary)',
      popover: 'var(--popover)',
    },
  },
  shortcuts: {
    // Layout
    'app-layout': 'h-screen flex flex-col bg-background text-foreground overflow-hidden',
    'app-header': 'h-14 border-b border-border/50 bg-card/50 backdrop-blur-xl flex items-center justify-between px-4 flex-shrink-0',
    'app-sidebar': 'h-full border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col flex-shrink-0',
    'app-main': 'flex-1 flex flex-col overflow-hidden',
    'app-statusbar': 'h-6 border-t border-border/50 bg-card/50 backdrop-blur-xl flex items-center justify-between px-4 text-xs text-muted-foreground flex-shrink-0',

    // Buttons
    'btn': 'inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer disabled:opacity-50',
    'btn-ghost': 'btn text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    'btn-primary': 'btn bg-primary text-white hover:bg-primary/90',
    'btn-secondary': 'btn bg-secondary text-foreground hover:bg-secondary/80',
    'btn-icon': 'p-2 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer',

    // File tree
    'file-item': 'group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    'file-item-active': 'bg-primary/10 text-foreground',

    // Status icons
    'status-synced': 'text-success',
    'status-modified': 'text-warning',
    'status-conflict': 'text-destructive',
    'status-web-only': 'text-info',

    // Modal
    'modal-overlay': 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50',
    'modal-content': 'w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden',
    'modal-header': 'flex items-center justify-between px-4 py-3 border-b border-border',
    'modal-body': 'p-4',
  },
})
