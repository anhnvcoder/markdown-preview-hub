/**
 * HelpModal component
 * User guide with tabbed sections: Getting Started, Features, Shortcuts, Settings
 */
import { useState } from 'preact/hooks';
import { closeHelp, isHelpOpen } from '../lib/keyboard';

type TabId = 'start' | 'features' | 'settings';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'start', label: 'Getting Started', icon: 'i-lucide-rocket' },
  { id: 'features', label: 'Features', icon: 'i-lucide-sparkles' },
  { id: 'settings', label: 'Settings', icon: 'i-lucide-sliders' },
];

export function HelpModal() {
  const isOpen = isHelpOpen.value;
  const [activeTab, setActiveTab] = useState<TabId>('start');

  if (!isOpen) return null;

  return (
    <div
      class='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'
      onClick={closeHelp}
    >
      <div
        class='bg-card border border-border rounded-lg shadow-xl max-w-[720px] w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class='flex items-center justify-between p-4 border-b border-border'>
          <div class='flex items-center gap-2'>
            <div class='i-lucide-help-circle w-5 h-5 text-primary' />
            <h2 class='font-semibold'>Help & Guide</h2>
          </div>
          <button class='btn-icon' onClick={closeHelp} aria-label='Close'>
            <div class='i-lucide-x w-4 h-4' />
          </button>
        </div>

        {/* Tabs */}
        <div class='flex border-b border-border bg-muted/30'>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              class={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div class={`${tab.icon} w-4 h-4`} />
              <span class='hidden sm:inline'>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div class='flex-1 overflow-y-auto p-5'>
          {activeTab === 'start' && <GettingStartedTab />}
          {activeTab === 'features' && <FeaturesTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>

        {/* Footer */}
        <div class='flex items-center justify-between p-4 border-t border-border text-xs text-muted-foreground'>
          <span>Preview Hub - Markdown Preview Made Simple</span>
          <button class='btn-primary text-xs' onClick={closeHelp}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function GettingStartedTab() {
  return (
    <div class='space-y-5'>
      <div>
        <h3 class='text-lg font-semibold mb-2'>Welcome to Preview Hub</h3>
        <p class='text-sm text-muted-foreground'>
          A fast, beautiful markdown preview app that works with your local
          files. Perfect for viewing documentation, notes, and markdown files
          in real-time.
        </p>
      </div>

      <div class='space-y-3'>
        <h4 class='font-medium flex items-center gap-2'>
          <span class='text-sm text-muted-foreground font-normal'>1.</span>
          Open a Folder
        </h4>
        <p class='text-sm text-muted-foreground ml-5'>
          Click the <strong>"Open Folder"</strong> button in the sidebar to
          select a folder containing your markdown files.
        </p>
      </div>

      <div class='space-y-3'>
        <h4 class='font-medium flex items-center gap-2'>
          <span class='text-sm text-muted-foreground font-normal'>2.</span>
          Browse & Preview
        </h4>
        <p class='text-sm text-muted-foreground ml-5'>
          Navigate files in the sidebar. Click any markdown file to see a
          beautifully rendered preview with syntax highlighting, tables, and
          diagrams.
        </p>
      </div>

      <div class='space-y-3'>
        <h4 class='font-medium flex items-center gap-2'>
          <span class='text-sm text-muted-foreground font-normal'>3.</span>
          Edit & Save
        </h4>
        <p class='text-sm text-muted-foreground ml-5'>
          Click the edit icon to toggle edit mode and make changes. Changes sync
          automatically when you edit externally.
        </p>
      </div>

      <p class='text-sm text-muted-foreground italic'>
        Tip: File content auto-syncs when edited externally. For new/deleted
        files, use the Sync button in the sidebar to refresh the file tree.
      </p>
    </div>
  );
}

function FeaturesTab() {
  return (
    <div class='space-y-4'>
      <FeatureItem
        icon='i-lucide-eye'
        title='Live Preview'
        description='See your markdown rendered beautifully with GitHub-flavored styling, syntax highlighting for code blocks, and support for tables.'
      />

      <FeatureItem
        icon='i-lucide-edit-3'
        title='Edit Mode'
        description='Toggle between preview and edit modes. Make changes directly and save to disk. Unsaved changes are indicated with a dot.'
      />

      <FeatureItem
        icon='i-lucide-git-branch'
        title='Mermaid Diagrams'
        description='Render flowcharts, sequence diagrams, and more using Mermaid syntax in fenced code blocks.'
      />

      <FeatureItem
        icon='i-lucide-share-2'
        title='Share Links'
        description="Create public share links for your documents. Links expire based on your settings (1-30 days). Note: Local images won't be visible to others."
      />

      <FeatureItem
        icon='i-lucide-download'
        title='Copy & Download'
        description='Copy markdown content to clipboard, download as .md file, or export as PDF for printing or sharing offline.'
      />

      <FeatureItem
        icon='i-lucide-search'
        title='Quick Search'
        description='Search files by name or search inside file content. Use folder filters to narrow results.'
      />

      <FeatureItem
        icon='i-lucide-refresh-cw'
        title='Auto Sync'
        description='Files sync automatically when changed externally. Configurable polling interval from 30 seconds to 5 minutes.'
      />

      <FeatureItem
        icon='i-lucide-layout-list'
        title='Table of Contents'
        description='View document structure with an auto-generated table of contents. Click headings to navigate.'
      />

      <FeatureItem
        icon='i-lucide-sun-moon'
        title='Themes'
        description='Switch between Light, Dark, or System themes. Your preference is remembered across sessions.'
      />
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div class='flex gap-3'>
      <div
        class={`${icon} w-5 h-5 text-primary shrink-0 mt-0.5`}
        aria-hidden='true'
      />
      <div>
        <h4 class='font-medium text-sm'>{title}</h4>
        <p class='text-sm text-muted-foreground mt-0.5'>{description}</p>
      </div>
    </div>
  );
}

function SettingItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div class='border-l-2 border-primary/30 pl-3'>
      <h4 class='font-medium text-sm'>{title}</h4>
      <p class='text-sm text-muted-foreground mt-0.5'>{description}</p>
    </div>
  );
}

function SettingsTab() {
  return (
    <div class='space-y-5'>
      <p class='text-sm text-muted-foreground'>
        Access settings via the{' '}
        <span class='i-lucide-settings w-3.5 h-3.5 inline-block align-middle' />{' '}
        icon in the header.
      </p>

      <SettingItem
        title='Theme'
        description='Choose Light, Dark, or System (follows your OS preference). Theme is saved and applied on next visit.'
      />

      <SettingItem
        title='Sync Interval'
        description='How often to check for file changes (30s to 5 minutes). Lower values mean faster updates but slightly more resource usage.'
      />

      <SettingItem
        title='Share Link Expiry'
        description='How long shared links remain accessible (1 to 30 days). After expiry, the link becomes invalid.'
      />

      <SettingItem
        title='Ignored Folders'
        description='Folders to skip when scanning (e.g., node_modules, .git, dist). Add folder names separated by commas.'
      />

      <p class='text-sm text-muted-foreground italic'>
        Click "Reset to Defaults" at the bottom of Settings to restore all
        options to their original values.
      </p>
    </div>
  );
}
