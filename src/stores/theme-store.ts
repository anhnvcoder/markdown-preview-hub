/**
 * Theme store using @preact/signals
 * Reactive theme management for components
 */
import { signal } from '@preact/signals';
import { getSettings } from '../lib/database';

// Current theme: 'dark' or 'light'
export const currentTheme = signal<'dark' | 'light'>('dark');

// Show TOC panel (default false, loaded from settings)
export const showToc = signal<boolean>(false);

/**
 * Initialize theme from DOM and set up observer
 */
export function initTheme(): void {
  // Read initial theme from document
  const isDark = document.documentElement.classList.contains('dark');
  currentTheme.value = isDark ? 'dark' : 'light';

  // Load showToc from settings
  getSettings().then((settings) => {
    showToc.value = settings.showToc ?? false;
  });

  // Observe class changes on documentElement
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        const isDark = document.documentElement.classList.contains('dark');
        currentTheme.value = isDark ? 'dark' : 'light';
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

/**
 * Toggle theme between dark and light
 */
export function toggleTheme(): void {
  const newTheme = currentTheme.value === 'dark' ? 'light' : 'dark';
  currentTheme.value = newTheme;
  document.documentElement.className = newTheme;
  localStorage.setItem('md-preview-theme', newTheme);
}

/**
 * Set specific theme
 */
export function setTheme(theme: 'dark' | 'light'): void {
  currentTheme.value = theme;
  document.documentElement.className = theme;
  localStorage.setItem('md-preview-theme', theme);
}
