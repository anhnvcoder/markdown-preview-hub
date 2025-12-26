/**
 * CommandPalette component
 * Quick search modal for files (⌘K) or content (⌘⇧K)
 */
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { signal } from '@preact/signals';
import { isSearchOpen, isContentSearchOpen, modKey } from '../lib/keyboard';
import { visibleFiles, selectFile, selectNode, expandedFolders, files } from '../stores/file-store';
import { getContent } from '../lib/virtual-fs';

// Persist folder filter across popup opens
const persistedScopeFolder = signal('');

export function CommandPalette() {
  const isFileSearchOpen = isSearchOpen.value;
  const isContentOpen = isContentSearchOpen.value;
  const isOpen = isFileSearchOpen || isContentOpen;

  // Local state for search mode (allows switching within popup)
  const [searchMode, setSearchMode] = useState<'files' | 'content'>('files');
  const isContentMode = searchMode === 'content';

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scopeFolder, setScopeFolder] = useState<string>(persistedScopeFolder.value);
  const [scopeInput, setScopeInput] = useState<string>(persistedScopeFolder.value);
  const [showScopeSuggestions, setShowScopeSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scopeInputRef = useRef<HTMLInputElement>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());

  // Sync scopeFolder to persisted signal
  useEffect(() => {
    persistedScopeFolder.value = scopeFolder;
  }, [scopeFolder]);

  // Get all folders for scope suggestions, sorted by path
  const allFolders = useMemo(() => {
    return visibleFiles.value
      .filter((f) => f.type === 'folder')
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [visibleFiles.value]);

  // Filter folder suggestions based on input
  const folderSuggestions = useMemo(() => {
    // If no input or input equals current scope, show all folders
    if (!scopeInput || scopeInput === scopeFolder) {
      return allFolders.slice(0, 10);
    }
    const input = scopeInput.toLowerCase();
    return allFolders
      .filter((f) => f.path.toLowerCase().startsWith(input) || f.path.toLowerCase().includes(input))
      .slice(0, 10);
  }, [scopeInput, scopeFolder, allFolders]);

  // Get all markdown files, filtered by scope
  const allFiles = useMemo(() => {
    let filesArr = visibleFiles.value.filter((f) => f.type === 'file');
    if (scopeFolder) {
      filesArr = filesArr.filter((f) => f.path.startsWith(scopeFolder + '/'));
    }
    return filesArr;
  }, [scopeFolder, visibleFiles.value]);

  // Content search results with matched line
  type ContentResult = {
    file: typeof allFiles[0];
    matchedLine: string;
    lineNumber: number;
  };

  // File search: filter by name/path
  const fileResults = useMemo(() => {
    if (isContentMode) return [];
    if (!query.trim()) return allFiles;
    const q = query.toLowerCase();
    return allFiles.filter((f) =>
      f.virtualName.toLowerCase().includes(q) ||
      f.path.toLowerCase().includes(q)
    );
  }, [query, isContentMode, allFiles]);

  // Content search: search inside markdown content
  const contentResults = useMemo<ContentResult[]>(() => {
    if (!isContentMode || !query.trim()) return [];
    const q = query.toLowerCase();
    const results: ContentResult[] = [];

    for (const file of allFiles) {
      const content = fileContents.get(file.id);
      if (!content) continue;
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          results.push({
            file,
            matchedLine: lines[i].trim(),
            lineNumber: i + 1,
          });
          break; // Only show first match per file
        }
      }
    }
    return results;
  }, [query, isContentMode, allFiles, fileContents]);

  // Combined results for display
  const displayResults = isContentMode
    ? contentResults.slice(0, 20)
    : fileResults.slice(0, 20);

  // Track if popup was previously open to detect fresh opens vs mode switches
  const wasOpen = useRef(false);

  // Reset state only when popup first opens, not on mode switches
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      // Fresh open - reset query but keep folder filter from persisted state
      setQuery('');
      setSelectedIndex(0);
      setScopeFolder(persistedScopeFolder.value);
      setScopeInput(persistedScopeFolder.value);
      setShowScopeSuggestions(false);
      setSearchMode(isContentOpen ? 'content' : 'files');
      setTimeout(() => inputRef.current?.focus(), 0);
    } else if (isOpen && wasOpen.current) {
      // Already open - just switch mode, keep folder filter
      setSearchMode(isContentOpen ? 'content' : 'files');
      setQuery(''); // Clear search query on mode switch
      setSelectedIndex(0);
    }
    wasOpen.current = isOpen;
  }, [isOpen, isContentOpen]);

  // Load file contents when content search mode opens
  useEffect(() => {
    if (!isContentMode) return;

    const loadContents = async () => {
      const contents = new Map<string, string>();
      await Promise.all(
        allFiles.map(async (file) => {
          try {
            const content = await getContent(file.id);
            contents.set(file.id, content);
          } catch {
            // Skip files that can't be read
          }
        })
      );
      setFileContents(contents);
    };

    loadContents();
  }, [isContentMode, allFiles.length]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, displayResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && displayResults[selectedIndex]) {
      e.preventDefault();
      const item = displayResults[selectedIndex];
      const fileId = isContentMode
        ? (item as ContentResult).file.id
        : (item as typeof fileResults[0]).id;
      handleSelect(fileId);
    }
  };

  const handleSelect = (fileId: string) => {
    // Find file to get its path
    const file = files.value.find((f) => f.id === fileId);
    if (file) {
      // Expand all parent folders
      const pathParts = file.path.split('/');
      const expanded = new Set(expandedFolders.value);
      let currentPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${pathParts[i]}` : pathParts[i];
        const folder = files.value.find((f) => f.path === currentPath && f.type === 'folder');
        if (folder) expanded.add(folder.id);
      }
      expandedFolders.value = expanded;

      // Select node in sidebar
      selectNode(fileId);
    }

    selectFile(fileId);
    isSearchOpen.value = false;
    isContentSearchOpen.value = false;
  };

  const handleBackdropClick = (e: Event) => {
    if (e.target === e.currentTarget) {
      isSearchOpen.value = false;
      isContentSearchOpen.value = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div class="w-full max-w-xl bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div class="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <div class={`w-4 h-4 text-muted-foreground shrink-0 ${isContentMode ? 'i-lucide-file-search' : 'i-lucide-search'}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            placeholder={isContentMode ? 'Search content...' : 'Search files...'}
            class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd class="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">esc</kbd>
        </div>

        {/* Mode tabs + Folder filter */}
        <div class="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/30">
          {/* Mode toggle tabs */}
          <div class="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
            <button
              class={`px-2.5 py-1 text-xs rounded transition-colors ${
                !isContentMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setSearchMode('files')}
            >
              Files
            </button>
            <button
              class={`px-2.5 py-1 text-xs rounded transition-colors ${
                isContentMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setSearchMode('content')}
            >
              Content
            </button>
          </div>

          {/* Folder scope autocomplete */}
          {allFolders.length > 0 && (
            <div class="ml-auto relative">
              <div class="flex items-center gap-1.5 bg-muted/30 rounded px-2 py-1 border border-transparent hover:border-border/50 focus-within:border-primary/50">
                <div class="i-lucide-folder w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={scopeInputRef}
                  type="text"
                  value={scopeInput}
                  placeholder={scopeFolder || 'All folders'}
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    setScopeInput(val);
                    setShowScopeSuggestions(true);
                    // Clear scope if input is cleared
                    if (!val) setScopeFolder('');
                  }}
                  onFocus={() => setShowScopeSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowScopeSuggestions(false), 150)}
                  class="w-56 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
                />
                {scopeFolder && (
                  <button
                    class="text-muted-foreground hover:text-foreground p-0.5 -mr-1"
                    onClick={() => {
                      setScopeFolder('');
                      setScopeInput('');
                    }}
                    title="Clear folder filter"
                  >
                    <div class="i-lucide-x w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              {showScopeSuggestions && folderSuggestions.length > 0 && (
                <div class="absolute top-full right-0 mt-1 w-72 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-lg z-10">
                  {folderSuggestions.map((folder) => {
                    const isSelected = folder.path === scopeFolder;
                    return (
                      <button
                        key={folder.id}
                        class={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center gap-2 ${
                          isSelected ? 'bg-muted/50 text-primary font-medium' : ''
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent blur before click
                          setScopeFolder(folder.path);
                          setScopeInput(folder.path);
                          setShowScopeSuggestions(false);
                          inputRef.current?.focus();
                        }}
                      >
                        <div class={`i-lucide-folder w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span class="truncate">{folder.path}</span>
                        {isSelected && <div class="i-lucide-check w-3 h-3 ml-auto text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div class="min-h-56 max-h-80 overflow-y-auto">
          {displayResults.length === 0 ? (
            <div class="px-4 py-8 text-center text-sm text-muted-foreground">
              {isContentMode
                ? (query ? 'No matches found' : 'Type to search content')
                : (query ? 'No files found' : 'No files available')}
            </div>
          ) : isContentMode ? (
            // Content search results
            contentResults.slice(0, 20).map((result, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={`${result.file.id}-${result.lineNumber}`}
                  class={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'
                  }`}
                  onClick={() => handleSelect(result.file.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div class="i-lucide-file-text w-4 h-4 text-muted-foreground shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm truncate">{result.file.virtualName}</div>
                    <div class="text-xs text-muted-foreground truncate">
                      <span class="text-primary/70">L{result.lineNumber}:</span> {result.matchedLine}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            // File search results
            fileResults.slice(0, 20).map((file, index) => {
              const isSelected = index === selectedIndex;
              const isDirty = file.isDirty || file.status === 'modified';

              return (
                <div
                  key={file.id}
                  class={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'
                  }`}
                  onClick={() => handleSelect(file.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div class="i-lucide-file-text w-4 h-4 text-muted-foreground shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm truncate">{file.virtualName}</div>
                    <div class="text-xs text-muted-foreground truncate">{file.path}</div>
                  </div>
                  {isDirty && (
                    <span class="w-2 h-2 rounded-full bg-warning shrink-0" title="Unsaved changes" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div class="px-4 py-2 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-4">
          <span class="flex items-center gap-1">
            <kbd class="bg-muted/50 px-1 rounded">↑↓</kbd> navigate
          </span>
          <span class="flex items-center gap-1">
            <kbd class="bg-muted/50 px-1 rounded">↵</kbd> open
          </span>
          <span class="flex items-center gap-1 ml-auto">
            <kbd class="bg-muted/50 px-1 rounded">{modKey}K</kbd> files
          </span>
          <span class="flex items-center gap-1">
            <kbd class="bg-muted/50 px-1 rounded">{modKey}⇧K</kbd> content
          </span>
        </div>
      </div>
    </div>
  );
}
