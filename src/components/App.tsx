/**
 * App component
 * Main Preact island that wires all components together
 */
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { getSettings } from '../lib/database';
import { initKeyboardShortcuts } from '../lib/keyboard';
import {
  setActiveFile,
  setProjectRef,
  startPolling,
  stopPolling,
} from '../lib/polling';
import { saveToDisk } from '../lib/virtual-fs';
import {
  activeFile,
  activeFileId,
  closeActiveTab,
  currentProject,
  loadPersistedProject,
  openFolder,
  refreshFiles,
  selectFile,
} from '../stores/file-store';
import { initTheme } from '../stores/theme-store';
import { CommandPalette } from './CommandPalette';
import { ConflictModal } from './ConflictModal';
import { Header } from './Header';
import { Preview } from './Preview';
import { SettingsModal } from './SettingsModal';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TabBar } from './TabBar';
import { UploadWarningModal } from './UploadWarningModal';

// View mode signal for keyboard shortcut
export const viewMode = signal<'preview' | 'edit'>('preview');

// Sidebar collapsed state - exported signal for cross-component use
export const sidebarCollapsed = signal<boolean>(false);

// Sidebar width - persisted in localStorage
const DEFAULT_SIDEBAR_WIDTH = 256; // 16rem
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 500;
export const sidebarWidth = signal<number>(
  typeof localStorage !== 'undefined'
    ? parseInt(
        localStorage.getItem('md-preview-sidebar-width') ||
          String(DEFAULT_SIDEBAR_WIDTH),
        10
      )
    : DEFAULT_SIDEBAR_WIDTH
);

// Helper to toggle sidebar
export const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

// Apply saved theme on load and init theme store
async function applySavedTheme() {
  // First check localStorage for immediate apply
  const savedTheme = localStorage.getItem('md-preview-theme');
  if (savedTheme) {
    document.documentElement.className = savedTheme;
  } else {
    // Fallback to DB settings
    const settings = await getSettings();
    document.documentElement.className = settings.theme || 'dark';
  }
  // Initialize theme store to sync with DOM and set up observer
  initTheme();
}

export function App() {
  // Read signals to ensure component re-renders when they change
  const isCollapsed = sidebarCollapsed.value;
  const currentWidth = sidebarWidth.value;
  const isResizingRef = useRef(false);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Apply theme and load persisted project on mount
  useEffect(() => {
    applySavedTheme();
    loadPersistedProject();
  }, []);

  // Sidebar resize handlers
  const handleResizeStart = (e: Event) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeHandleRef.current?.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Add global mouse listeners for resize
  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, e.clientX)
      );
      sidebarWidth.value = newWidth;
    };

    const handleResizeEnd = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      resizeHandleRef.current?.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist to localStorage
      localStorage.setItem(
        'md-preview-sidebar-width',
        String(sidebarWidth.value)
      );
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  // Start polling when project is opened
  useEffect(() => {
    const project = currentProject.value;
    if (!project) return;

    // Set project ref for polling (avoids circular import)
    setProjectRef(project);

    startPolling({
      onFileChanged: async (fileId) => {
        await refreshFiles();
        if (activeFileId.value === fileId) {
          await selectFile(fileId);
        }
      },
      onConflictDetected: (file) => {
        console.log('[App] Conflict detected:', file.virtualName);
      },
      onFolderUpdated: async () => {
        console.log('[App] Folder structure updated');
        await refreshFiles();
      },
      onRefreshFiles: async () => {
        await refreshFiles();
      },
    });

    return () => {
      stopPolling();
      setProjectRef(null);
    };
  }, [currentProject.value?.id]);

  // Update active file for polling priority
  useEffect(() => {
    setActiveFile(activeFileId.value);
  }, [activeFileId.value]);

  // Initialize keyboard shortcuts
  useEffect(() => {
    return initKeyboardShortcuts({
      onToggleEdit: () => {
        viewMode.value = viewMode.value === 'preview' ? 'edit' : 'preview';
      },
      onSave: async () => {
        const file = activeFile.value;
        if (file && file.isDirty) {
          await saveToDisk(file.id);
          await refreshFiles();
          console.log('[App] Saved to disk:', file.virtualName);
        }
      },
      onOpenFolder: () => {
        openFolder();
      },
      onCloseTab: () => {
        closeActiveTab();
      },
    });
  }, []);

  return (
    <>
      <Header />
      <div class='flex-1 flex overflow-hidden'>
        <div
          class={
            isCollapsed
              ? 'sidebar-container sidebar-collapsed'
              : 'sidebar-container'
          }
          style={{ width: isCollapsed ? 0 : `${currentWidth}px` }}
        >
          <Sidebar />
          {/* Resize handle */}
          {!isCollapsed && (
            <div
              ref={resizeHandleRef}
              class='sidebar-resize-handle'
              onMouseDown={handleResizeStart}
            />
          )}
        </div>
        {/* Main content with tab bar */}
        <div class='flex-1 flex flex-col min-w-0'>
          <TabBar />
          <Preview />
        </div>
      </div>
      <StatusBar />
      <ConflictModal />
      <SettingsModal />
      <UploadWarningModal />
      <CommandPalette />
    </>
  );
}
