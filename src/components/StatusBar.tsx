/**
 * StatusBar component
 * Shows file counts, sync status, and connection info
 */
import { statusCounts, currentProject } from '../stores/file-store';

export function StatusBar() {
  const project = currentProject.value;
  const counts = statusCounts.value;

  if (!project) return null;

  const allSynced = counts.modified === 0 && counts.conflict === 0;

  return (
    <footer class="app-statusbar">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1.5">
          <div class={`i-lucide-cloud w-3 h-3 ${allSynced ? 'text-success' : 'text-warning'}`} />
          <span>{allSynced ? 'All files synced' : `${counts.modified} modified`}</span>
        </div>
        <div class="h-3 w-px bg-border" />
        <span>{counts.total} files</span>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1.5">
          <div class="i-lucide-wifi w-3 h-3" />
          <span>Connected</span>
        </div>
        <span>UTF-8</span>
      </div>
    </footer>
  );
}
