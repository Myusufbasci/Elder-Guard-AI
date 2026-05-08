import StatusBadge from './StatusBadge';

/**
 * AI daily summary card.
 * Displays the latest Gemini-generated summary from NotificationLog.
 */
interface AiSummaryCardProps {
  summary: {
    status_category: 'stable' | 'needs_attention' | 'critical';
    summary_text: string;
    anomalies_noted: boolean;
    action_recommendation: string | null;
  } | null;
  generatedAt?: string;
}

export default function AiSummaryCard({ summary, generatedAt }: AiSummaryCardProps) {
  if (!summary) {
    return (
      <div className="rounded-2xl bg-surface-900 border border-surface-800 p-5">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
          AI Daily Summary
        </h3>
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto rounded-xl bg-surface-800 flex items-center justify-center text-surface-500 mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <p className="text-sm text-surface-500">No AI summary available yet.</p>
          <p className="text-xs text-surface-600 mt-1">Generated daily at 06:00 UTC</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-900 border border-surface-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">
          AI Daily Summary
        </h3>
        <StatusBadge status={summary.status_category} />
      </div>

      <p className="text-surface-300 text-sm leading-relaxed mb-4">
        {summary.summary_text}
      </p>

      {summary.action_recommendation && (
        <div className="bg-accent-500/10 border border-accent-500/20 rounded-xl px-4 py-3 mb-3">
          <p className="text-xs font-medium text-accent-400 uppercase tracking-wider mb-1">
            Recommendation
          </p>
          <p className="text-sm text-surface-200">{summary.action_recommendation}</p>
        </div>
      )}

      {summary.anomalies_noted && (
        <div className="flex items-center gap-2 text-xs text-warning-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Anomalies detected in the last 24 hours
        </div>
      )}

      {generatedAt && (
        <p className="text-xs text-surface-600 mt-3">
          Generated: {new Date(generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
