/**
 * TabBar component
 * Horizontal tab bar for open files with close buttons and dirty indicators
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  activeFileId,
  closeTab,
  openTabFiles,
  selectFile,
} from '../stores/file-store';

export function TabBar() {
  const tabs = openTabFiles.value;
  const activeId = activeFileId.value;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Check scroll position to show/hide fade indicators
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 0);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [tabs.length]);

  if (tabs.length === 0) return null;

  return (
    <div class='h-9 border-b border-border/50 bg-card/30 flex items-center relative'>
      {/* Left fade indicator */}
      {showLeftFade && (
        <div class='absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card/80 to-transparent z-10 pointer-events-none' />
      )}

      {/* Tabs container */}
      <div
        ref={scrollRef}
        class='flex items-center overflow-x-auto scrollbar-hide h-full flex-1'
      >
        {tabs.map((file) => {
          const isActive = file.id === activeId;
          const isDirty = file.isDirty || file.status === 'modified';

          return (
            <div
              key={file.id}
              class={`group flex items-center gap-1.5 px-3 h-full border-r border-border/30 cursor-pointer transition-colors shrink-0 ${
                isActive
                  ? 'bg-background text-foreground border-b-2 border-b-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
              onClick={() => selectFile(file.id)}
            >
              {/* Dirty indicator */}
              {isDirty && (
                <span
                  class='w-2 h-2 rounded-full bg-warning shrink-0'
                  title='Unsaved changes'
                />
              )}

              {/* File name */}
              <span class='text-xs truncate max-w-32'>{file.virtualName}</span>

              {/* Close button - always visible on active, hover on others */}
              <button
                class={`p-0.5 rounded hover:bg-muted/50 transition-opacity shrink-0 ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(file.id);
                }}
                title='Close tab (⌘W)'
              >
                <div class='i-lucide-x w-3 h-3' />
              </button>
            </div>
          );
        })}
      </div>

      {/* Right fade indicator with count */}
      {showRightFade && (
        <div class='absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-card/90 to-transparent z-10 flex items-center justify-end pr-2 pointer-events-none'>
          <span class='text-[10px] text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded-full'>
            {tabs.length}
          </span>
        </div>
      )}
    </div>
  );
}
