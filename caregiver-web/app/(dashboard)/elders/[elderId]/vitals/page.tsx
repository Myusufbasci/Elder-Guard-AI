import Link from 'next/link';
import { Suspense } from 'react';
import { apiFetch } from '@/lib/api';
import VitalsCharts from './VitalsCharts';

/**
 * Vitals page — Server component.
 * Fetches vitals data from NestJS API based on time range, renders chart components.
 */

interface VitalsBucket {
  bucket: string;
  device_id: string;
  metric: string;
  avg_value: number;
  min_value: number;
  max_value: number;
}

type VitalsResponse = Record<string, VitalsBucket[]>;

const RANGE_MS: Record<string, number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

const RANGE_LABELS: Record<string, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
};

export async function generateMetadata({ params }: { params: Promise<{ elderId: string }> }) {
  const { elderId } = await params;
  return {
    title: `Vitals ${elderId.slice(0, 8)} — ElderCare Dashboard`,
  };
}

export default async function VitalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ elderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { elderId } = await params;
  const sp = await searchParams;
  const range = typeof sp.range === 'string' && sp.range in RANGE_MS ? sp.range : '7d';

  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const rangeMs = RANGE_MS[range] ?? SEVEN_DAYS;
  const fromDate = new Date(Date.now() - rangeMs);
  const toDate = new Date();

  let vitals: VitalsResponse = {};
  let error = '';

  try {
    vitals = await apiFetch<VitalsResponse>(
      `/v1/caregiver/elders/${elderId}/vitals?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`,
    );
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load vitals data';
  }

  const dateRangeLabel = RANGE_LABELS[range] ?? 'Last 7 Days';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href={`/elders/${elderId}`}
            className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-surface-50">Vitals Overview</h1>
            <p className="text-surface-400 text-sm mt-0.5">
              Elder {elderId.slice(0, 8)}… · {dateRangeLabel}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 rounded-xl px-5 py-4 text-danger-400 mb-6">
          {error}
        </div>
      )}

      {!error && (
        <Suspense
          fallback={
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-surface-900 border border-surface-800 p-6 h-[420px] skeleton" />
              ))}
            </div>
          }
        >
          <VitalsCharts
            vitals={vitals}
            elderId={elderId}
            range={range}
            dateRangeLabel={dateRangeLabel}
          />
        </Suspense>
      )}
    </div>
  );
}
