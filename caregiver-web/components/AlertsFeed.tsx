'use client';

import { useState, useCallback } from 'react';
import AlertCard from '@/components/AlertCard';
import type { AnomalyEvent } from '@/components/AlertCard';

interface AlertsFeedProps {
  initialItems: AnomalyEvent[];
  initialCursor: string | null;
}

const SEVERITY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const METRIC_OPTIONS = ['ALL', 'heart_rate', 'resting_heart_rate', 'steps', 'sleep_duration'] as const;
const ACK_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Unacknowledged', value: 'false' },
  { label: 'Acknowledged', value: 'true' },
] as const;

const metricDisplayLabels: Record<string, string> = {
  heart_rate: 'Heart Rate',
  resting_heart_rate: 'Resting HR',
  steps: 'Steps',
  sleep_duration: 'Sleep',
};

export default function AlertsFeed({ initialItems, initialCursor }: AlertsFeedProps) {
  const [items, setItems] = useState<AnomalyEvent[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [severity, setSeverity] = useState('ALL');
  const [metric, setMetric] = useState('ALL');
  const [ackFilter, setAckFilter] = useState('all');
  const [filtering, setFiltering] = useState(false);

  const fetchAlerts = useCallback(
    async (cursorVal: string | null, append: boolean) => {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (cursorVal) params.set('cursor', cursorVal);
      if (severity !== 'ALL') params.set('severity', severity);
      if (metric !== 'ALL') params.set('metric', metric);
      if (ackFilter !== 'all') params.set('acknowledged', ackFilter);

      const res = await fetch('/api/auth/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/v1/caregiver/alerts?${params.toString()}`, method: 'GET' }),
      });

      if (!res.ok) return;

      const envelope = await res.json() as { data: { items: AnomalyEvent[]; cursor: string | null } };
      const data = envelope.data;

      if (append) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
      setCursor(data.cursor);
    },
    [severity, metric, ackFilter],
  );

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchAlerts(cursor, true);
    setLoadingMore(false);
  };

  const handleFilterChange = async (
    newSeverity: string,
    newMetric: string,
    newAck: string,
  ) => {
    setSeverity(newSeverity);
    setMetric(newMetric);
    setAckFilter(newAck);
    setFiltering(true);

    // Build params with new values (can't rely on state yet)
    const params = new URLSearchParams();
    params.set('limit', '20');
    if (newSeverity !== 'ALL') params.set('severity', newSeverity);
    if (newMetric !== 'ALL') params.set('metric', newMetric);
    if (newAck !== 'all') params.set('acknowledged', newAck);

    const res = await fetch('/api/auth/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `/v1/caregiver/alerts?${params.toString()}`, method: 'GET' }),
    });

    if (res.ok) {
      const envelope = await res.json() as { data: { items: AnomalyEvent[]; cursor: string | null } };
      setItems(envelope.data.items);
      setCursor(envelope.data.cursor);
    }

    setFiltering(false);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Severity filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-severity" className="text-xs text-surface-500 font-medium">Severity</label>
          <select
            id="filter-severity"
            value={severity}
            onChange={(e) => handleFilterChange(e.target.value, metric, ackFilter)}
            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Severities' : s}</option>
            ))}
          </select>
        </div>

        {/* Metric filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-metric" className="text-xs text-surface-500 font-medium">Metric</label>
          <select
            id="filter-metric"
            value={metric}
            onChange={(e) => handleFilterChange(severity, e.target.value, ackFilter)}
            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m} value={m}>{m === 'ALL' ? 'All Metrics' : metricDisplayLabels[m] ?? m}</option>
            ))}
          </select>
        </div>

        {/* Acknowledged filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-ack" className="text-xs text-surface-500 font-medium">Status</label>
          <select
            id="filter-ack"
            value={ackFilter}
            onChange={(e) => handleFilterChange(severity, metric, e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          >
            {ACK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading overlay for filter changes */}
      {filtering && (
        <div className="flex items-center justify-center py-12">
          <svg className="w-6 h-6 animate-spin text-accent-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Empty state */}
      {!filtering && items.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-surface-800 flex items-center justify-center text-success-400 mb-5">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-surface-200 mb-2">All clear</h2>
          <p className="text-surface-400">No anomaly alerts match your filters.</p>
        </div>
      )}

      {/* Alert cards */}
      {!filtering && items.length > 0 && (
        <div className="space-y-3">
          {items.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* Load more */}
      {!filtering && cursor && (
        <div className="flex justify-center mt-6">
          <button
            id="load-more-alerts"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-800 text-surface-300 hover:text-surface-100 hover:bg-surface-700 transition-all text-sm font-medium disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading…
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
