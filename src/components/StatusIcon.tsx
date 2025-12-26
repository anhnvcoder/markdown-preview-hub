/**
 * StatusIcon component
 * Visual indicator for file sync status - matches v0 design
 */
import type { FileStatus } from '../types';

interface StatusIconProps {
  status: FileStatus;
  size?: 'sm' | 'md';
  animate?: boolean;
}

const statusConfig: Record<FileStatus, { icon: string; color: string; title: string }> = {
  synced: { icon: 'i-lucide-cloud', color: 'text-success', title: 'Synced' },
  modified: { icon: 'i-lucide-pencil', color: 'text-warning', title: 'Modified' },
  conflict: { icon: 'i-lucide-alert-triangle', color: 'text-destructive', title: 'Conflict' },
  'web-only': { icon: 'i-lucide-cloud-off', color: 'text-info', title: 'Web only' },
  'disk-changed': { icon: 'i-lucide-refresh-cw', color: 'text-accent', title: 'Disk changed' },
};

export function StatusIcon({ status, size = 'sm', animate = false }: StatusIconProps) {
  const config = statusConfig[status];
  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const animateClass = animate ? 'animate-pulse' : '';

  return (
    <div
      class={`${config.icon} ${sizeClass} ${config.color} ${animateClass} flex-shrink-0 transition-opacity`}
      title={config.title}
    />
  );
}
