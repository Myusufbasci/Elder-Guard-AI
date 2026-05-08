import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import VitalsCard from '@/components/VitalsCard';
import AiSummaryCard from '@/components/AiSummaryCard';
import MapClient from './MapClient';

/**
 * Elder detail page — Server component.
 * Fetches elder summary, vitals, and location from NestJS API.
 */

interface ElderVitals {
  metrics: Array<{
    bucket: string;
    metric: string;
    avg_value: number;
    min_value: number;
    max_value: number;
  }>;
}

interface ElderLocation {
  current: { lat: number; lng: number; time: string } | null;
  trail: Array<{ lat: number; lng: number; time: string }>;
}

interface AiSummary {
  content: {
    status_category: 'stable' | 'needs_attention' | 'critical';
    summary_text: string;
    anomalies_noted: boolean;
    action_recommendation: string | null;
  };
  sentAt: string;
}

export async function generateMetadata({ params }: { params: Promise<{ elderId: string }> }) {
  const { elderId } = await params;
  return {
    title: `Elder ${elderId.slice(0, 8)} — ElderCare Dashboard`,
  };
}

export default async function ElderDetailPage({ params }: { params: Promise<{ elderId: string }> }) {
  const { elderId } = await params;

  // Fetch all data in parallel
  const [vitalsResult, locationResult, summaryResult] = await Promise.allSettled([
    apiFetch<ElderVitals>(`/v1/caregiver/elders/${elderId}/vitals?from=${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`),
    apiFetch<ElderLocation>(`/v1/caregiver/elders/${elderId}/location`),
    apiFetch<AiSummary>(`/v1/caregiver/elders/${elderId}/summary`),
  ]);

  const vitals = vitalsResult.status === 'fulfilled' ? vitalsResult.value : null;
  const location = locationResult.status === 'fulfilled' ? locationResult.value : null;
  const summaryData = summaryResult.status === 'fulfilled' ? summaryResult.value : null;

  // Extract latest values per metric from vitals
  const latestMetrics = extractLatestMetrics(vitals);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/elders"
          className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Elder Details</h1>
          <p className="text-surface-400 text-sm mt-0.5">ID: {elderId.slice(0, 8)}…</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href={`/elders/${elderId}/vitals`}
            id="view-vitals-button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-500/15 text-accent-400 hover:bg-accent-500/25 transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Vitals Charts
          </Link>
          <Link
            href={`/alerts?elderId=${elderId}`}
            id="view-alerts-button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 text-surface-300 hover:text-surface-100 hover:bg-surface-700 transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            View Alerts
          </Link>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vitals */}
        <VitalsCard metrics={latestMetrics} />

        {/* AI Summary */}
        <AiSummaryCard
          summary={summaryData?.content ?? null}
          generatedAt={summaryData?.sentAt}
        />

        {/* Map — spans full width */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-surface-900 border border-surface-800 p-5">
            <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
              Location
            </h3>
            <MapClient
              currentLocation={location?.current ?? null}
              trail={location?.trail ?? []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Extract latest metric values into VitalsCard-compatible format */
function extractLatestMetrics(vitals: ElderVitals | null) {
  if (!vitals || vitals.metrics.length === 0) {
    return [
      { label: 'Heart Rate', value: '—', unit: 'bpm', icon: heartIcon() },
      { label: 'Resting HR', value: '—', unit: 'bpm', icon: restingHrIcon() },
      { label: 'Steps', value: '—', unit: 'today', icon: stepsIcon() },
      { label: 'Sleep', value: '—', unit: 'hrs', icon: sleepIcon() },
    ];
  }

  const latestValue: Record<string, number> = {};
  const latestBucket: Record<string, string> = {};
  for (const m of vitals.metrics) {
    const prevBucket = latestBucket[m.metric];
    if (!prevBucket || new Date(m.bucket) > new Date(prevBucket)) {
      latestValue[m.metric] = m.avg_value;
      latestBucket[m.metric] = m.bucket;
    }
  }

  return [
    { label: 'Heart Rate', value: latestValue['heart_rate']?.toFixed(0) ?? '—', unit: 'bpm', icon: heartIcon() },
    { label: 'Resting HR', value: latestValue['resting_heart_rate']?.toFixed(0) ?? '—', unit: 'bpm', icon: restingHrIcon() },
    { label: 'Steps', value: latestValue['steps']?.toFixed(0) ?? '—', unit: 'today', icon: stepsIcon() },
    { label: 'Sleep', value: latestValue['sleep_duration'] ? (latestValue['sleep_duration'] / 3600).toFixed(1) : '—', unit: 'hrs', icon: sleepIcon() },
  ];
}

function heartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function restingHrIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
    </svg>
  );
}

function stepsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function sleepIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}
