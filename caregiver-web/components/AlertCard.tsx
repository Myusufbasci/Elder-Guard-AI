'use client';

import { useState, useTransition } from 'react';
import { acknowledgeAlert } from '@/app/(dashboard)/alerts/actions';

export interface AnomalyEvent {
  id: string;
  elderId: string;
  metric: string;
  kind: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectedAt: string;
  modifiedZScore: number;
  observedValue: number;
  medianValue: number;
  madValue: number;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  elder: { user: { firstName: string; lastName: string } };
}

interface AlertCardProps {
  alert: AnomalyEvent;
}

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-danger-500/15 text-danger-400 border-danger-500/20',
  HIGH: 'bg-warning-400/15 text-warning-400 border-warning-400/20',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  LOW: 'bg-surface-700/50 text-surface-400 border-surface-600/20',
};

const metricLabels: Record<string, string> = {
  heart_rate: 'Heart Rate',
  resting_heart_rate: 'Resting HR',
  steps: 'Steps',
  sleep_duration: 'Sleep',
  location_lat: 'Location',
  location_lng: 'Location',
};

export default function AlertCard({ alert: initialAlert }: AlertCardProps) {
  const [alert, setAlert] = useState(initialAlert);
  const [isPending, startTransition] = useTransition();

  const handleAck = () => {
    // Optimistic update
    setAlert((prev) => ({ ...prev, acknowledged: true, acknowledgedAt: new Date().toISOString() }));

    startTransition(async () => {
      const result = await acknowledgeAlert(alert.id);
      if (!result.success) {
        // Revert on failure
        setAlert((prev) => ({ ...prev, acknowledged: false, acknowledgedAt: null }));
      }
    });
  };

  const elderName = alert.elder?.user
    ? `${alert.elder.user.firstName} ${alert.elder.user.lastName}`
    : alert.elderId.slice(0, 8);

  return (
    <div
      id={`alert-${alert.id}`}
      className={`rounded-xl bg-surface-900 border border-surface-800 p-4 transition-all ${
        alert.acknowledged ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Severity badge */}
        <span
          className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
            severityColors[alert.severity] ?? 'bg-surface-700/50 text-surface-400 border-surface-600/20'
          }`}
        >
          {alert.severity}
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-100">
            {metricLabels[alert.metric] ?? alert.metric} anomaly — {elderName}
          </p>
          <p className="text-xs text-surface-500 mt-0.5">
            Observed: {alert.observedValue.toFixed(1)} · Median: {alert.medianValue.toFixed(1)} ·
            Z-Score: {alert.modifiedZScore.toFixed(2)} · {alert.kind.replace('_', ' ')}
          </p>
        </div>

        {/* Right side: time + ack button */}
        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <p className="text-xs text-surface-400">
            {new Date(alert.detectedAt).toLocaleString()}
          </p>
          {alert.acknowledged ? (
            <span className="text-xs text-success-400 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Acknowledged
            </span>
          ) : (
            <button
              id={`ack-${alert.id}`}
              onClick={handleAck}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent-500/15 text-accent-400 hover:bg-accent-500/25 text-xs font-medium transition-all disabled:opacity-50"
            >
              {isPending ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
