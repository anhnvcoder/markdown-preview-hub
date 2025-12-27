/**
 * Editor component
 * Simple textarea with auto-save to IndexedDB
 */
import { useCallback, useEffect, useState } from 'preact/hooks';
import {
  getContent,
  saveToDisk,
  syncFromDisk,
  updateContent,
} from '../lib/virtual-fs';
import {
  activeFile,
  activeFileContent,
  refreshFiles,
  updateFileInState,
} from '../stores/file-store';

interface EditorProps {
  fileId: string;
  initialContent: string;
  onContentChange?: (content: string) => void;
}

// Debounce delay for auto-save (ms)
const AUTO_SAVE_DELAY = 500;

export function Editor({
  fileId,
  initialContent,
  onContentChange,
}: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [savingToDisk, setSavingToDisk] = useState(false);
  const file = activeFile.value;

  // Update content when file changes
  useEffect(() => {
    setContent(initialContent);
  }, [fileId, initialContent]);

  // Auto-save with debounce
  useEffect(() => {
    if (content === initialContent) return;

    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await updateContent(fileId, content);
        updateFileInState(fileId, {
          contentOverride: content,
          isDirty: true,
          status: 'modified',
        });
      } catch (err) {
        console.error('Auto-save error:', err);
      } finally {
        setSaving(false);
      }
    }, AUTO_SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [content, fileId, initialContent]);

  const handleChange = useCallback(
    (e: Event) => {
      const value = (e.target as HTMLTextAreaElement).value;
      setContent(value);
      onContentChange?.(value);

      // Update global content for live preview
      activeFileContent.value = value;
    },
    [onContentChange]
  );

  // Manual save to DB
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateContent(fileId, content);
      updateFileInState(fileId, {
        contentOverride: content,
        isDirty: true,
        status: 'modified',
      });
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [fileId, content]);

  // Save to disk
  const handleSaveToDisk = useCallback(async () => {
    setSavingToDisk(true);
    try {
      // First ensure content is saved to DB
      await updateContent(fileId, content);
      updateFileInState(fileId, {
        contentOverride: content,
        isDirty: true,
        status: 'modified',
      });
      // Then save to disk
      await saveToDisk(fileId);
      await refreshFiles();
    } catch (err) {
      console.error('Save to disk error:', err);
    } finally {
      setSavingToDisk(false);
    }
  }, [fileId, content]);

  // Sync from disk
  const handleSyncFromDisk = useCallback(async () => {
    try {
      await syncFromDisk(fileId);
      await refreshFiles();
      // Reload content
      const diskContent = await getContent(fileId);
      setContent(diskContent);
      activeFileContent.value = diskContent;
    } catch (err) {
      console.error('Sync from disk error:', err);
    }
  }, [fileId]);

  const isDirty = file?.isDirty || file?.status === 'modified';
  const isWebOnly = file?.isWebOnly;

  return (
    <div class='flex-1 flex flex-col overflow-hidden'>
      {/* Editor toolbar */}
      <div class='h-9 px-4 flex items-center justify-between border-b border-border/50 bg-muted/30'>
        <div class='flex items-center gap-2'>
          <span class='text-xs text-muted-foreground'>
            {saving ? (
              <span class='flex items-center gap-1'>
                <span class='i-lucide-loader-2 w-3 h-3 animate-spin' />
                Saving...
              </span>
            ) : (
              'Edit mode'
            )}
          </span>
          {isDirty && (
            <span
              class='w-2 h-2 rounded-full bg-warning'
              title='Unsaved changes'
            />
          )}
        </div>

        <div class='flex items-center gap-2'>
          <span class='text-xs text-muted-foreground mr-2'>
            {content.length} chars
          </span>

          {/* Save to DB */}
          <button
            class='px-2 py-1 text-xs rounded hover:bg-muted/50 transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground'
            onClick={handleSave}
            disabled={saving}
            title='Save to database (⌘S)'
          >
            <div class='i-lucide-check w-3 h-3' />
            Save
          </button>

          {/* Save to Disk */}
          <button
            class='px-2 py-1 text-xs rounded hover:bg-muted/50 transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground'
            onClick={handleSaveToDisk}
            disabled={savingToDisk}
            title='Save to disk file'
          >
            {savingToDisk ? (
              <div class='i-lucide-loader-2 w-3 h-3 animate-spin' />
            ) : (
              <div class='i-lucide-hard-drive w-3 h-3' />
            )}
            Disk
          </button>

          {/* Sync from Disk - only for disk files */}
          {!isWebOnly && (
            <button
              class='px-2 py-1 text-xs rounded hover:bg-muted/50 transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground'
              onClick={handleSyncFromDisk}
              title='Reload from disk (discard changes)'
            >
              <div class='i-lucide-refresh-cw w-3 h-3' />
              Reload
            </button>
          )}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        class='flex-1 w-full p-4 bg-background resize-none outline-none font-mono text-sm leading-relaxed'
        value={content}
        onInput={handleChange}
        spellcheck={false}
        placeholder='Start writing markdown...'
      />
    </div>
  );
}
