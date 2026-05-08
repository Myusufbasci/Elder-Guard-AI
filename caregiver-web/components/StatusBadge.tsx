/**
 * Status badge for elder health status.
 * Maps to AI summary status_category: stable | needs_attention | critical
 */
interface StatusBadgeProps {
  status: 'stable' | 'needs_attention' | 'critical' | 'unknown';
}

const statusConfig: Record<string, { label: string; classes: string; dotClass: string }> = {
  stable: {
    label: 'Stable',
    classes: 'bg-success-500/15 text-success-400 border-success-500/20',
    dotClass: 'bg-success-400',
  },
  needs_attention: {
    label: 'Needs Attention',
    classes: 'bg-warning-400/15 text-warning-400 border-warning-400/20',
    dotClass: 'bg-warning-400',
  },
  critical: {
    label: 'Critical',
    classes: 'bg-danger-500/15 text-danger-400 border-danger-500/20',
    dotClass: 'bg-danger-400 pulse-dot',
  },
  unknown: {
    label: 'No Data',
    classes: 'bg-surface-700/50 text-surface-400 border-surface-600/20',
    dotClass: 'bg-surface-500',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const fallback = { label: 'No Data', classes: 'bg-surface-700/50 text-surface-400 border-surface-600/20', dotClass: 'bg-surface-500' };
  const config = statusConfig[status] ?? fallback;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}
