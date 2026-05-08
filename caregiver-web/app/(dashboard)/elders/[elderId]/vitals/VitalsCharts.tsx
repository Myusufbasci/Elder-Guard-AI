'use client';

import HeartRateChart from '@/components/charts/HeartRateChart';
import SleepChart from '@/components/charts/SleepChart';
import StepsChart from '@/components/charts/StepsChart';
import TimeRangeSelector from '@/components/charts/TimeRangeSelector';
import PdfExportButton from '@/components/PdfExportButton';

interface VitalsBucket {
  bucket: string;
  device_id: string;
  metric: string;
  avg_value: number;
  min_value: number;
  max_value: number;
}

interface VitalsChartsProps {
  vitals: Record<string, VitalsBucket[]>;
  elderId: string;
  range: string;
  dateRangeLabel: string;
}

export default function VitalsCharts({ vitals, elderId, range, dateRangeLabel }: VitalsChartsProps) {
  const heartRateData = vitals['heart_rate'] ?? [];
  const sleepData = vitals['sleep_duration'] ?? [];
  const stepsData = vitals['steps'] ?? [];

  const elderShortId = elderId.slice(0, 8);

  return (
    <div>
      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <TimeRangeSelector currentRange={range} />
        <PdfExportButton
          chartContainerId="vitals-charts-container"
          elderName={`Elder-${elderShortId}`}
          dateRange={dateRangeLabel}
        />
      </div>

      {/* Charts container — captured by PDF export */}
      <div id="vitals-charts-container" className="space-y-6">
        {/* Heart Rate */}
        <div className="rounded-2xl bg-surface-900 border border-surface-800 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-danger-500/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-surface-200">Heart Rate</h3>
              <p className="text-xs text-surface-500">Hourly averages with anomaly threshold</p>
            </div>
          </div>
          <HeartRateChart data={heartRateData} />
        </div>

        {/* Sleep Duration */}
        <div className="rounded-2xl bg-surface-900 border border-surface-800 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-surface-200">Sleep Duration</h3>
              <p className="text-xs text-surface-500">Daily sleep with median reference band</p>
            </div>
          </div>
          <SleepChart data={sleepData} />
        </div>

        {/* Steps */}
        <div className="rounded-2xl bg-surface-900 border border-surface-800 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent-500/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-surface-200">Steps</h3>
              <p className="text-xs text-surface-500">Daily step count with average reference</p>
            </div>
          </div>
          <StepsChart data={stepsData} />
        </div>
      </div>
    </div>
  );
}
