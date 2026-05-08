import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import AlertsFeed from '@/components/AlertsFeed';
import type { AnomalyEvent } from '@/components/AlertCard';

/**
 * Alerts page — Server component with client-side interactivity.
 * Fetches initial paginated anomaly events, renders AlertsFeed client component
 * for filters, ack, and cursor-based pagination.
 */

interface AlertsResponse {
  items: AnomalyEvent[];
  cursor: string | null;
}

export const metadata: Metadata = {
  title: 'Alerts — ElderCare Dashboard',
};

export default async function AlertsPage() {
  let alerts: AlertsResponse = { items: [], cursor: null };
  let error = '';

  try {
    alerts = await apiFetch<AlertsResponse>('/v1/caregiver/alerts?limit=20');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load alerts';
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-50">Alerts</h1>
        <p className="text-surface-400 mt-1">Anomaly events detected across all linked elders</p>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 rounded-xl px-5 py-4 text-danger-400 mb-6">
          {error}
        </div>
      )}

      {!error && (
        <AlertsFeed
          initialItems={alerts.items}
          initialCursor={alerts.cursor}
        />
      )}
    </div>
  );
}
