'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from 'recharts';

interface VitalsBucket {
  bucket: string;
  avg_value: number;
  min_value: number;
  max_value: number;
}

interface SleepChartProps {
  data: VitalsBucket[];
}

interface ChartDataPoint {
  date: string;
  fullDate: string;
  hours: number;
  isBelowThreshold: boolean;
}

interface TooltipPayloadItem {
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid] as number;
  }
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = (payload[0] as TooltipPayloadItem).payload;
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 shadow-xl">
      <p className="text-xs text-surface-400 mb-1">{point.fullDate}</p>
      <p className="text-sm font-semibold text-surface-50">
        {point.hours.toFixed(1)} <span className="text-xs font-normal text-surface-400">hours</span>
      </p>
      {point.isBelowThreshold && (
        <p className="text-xs text-danger-400 mt-1 font-medium">⚠ Below 70% of median</p>
      )}
    </div>
  );
}

export default function SleepChart({ data }: SleepChartProps) {
  const { chartData, medianHours, thresholdHours } = useMemo(() => {
    // Convert seconds to hours
    const hoursValues = data.map((d) => d.avg_value / 3600);
    const med = computeMedian(hoursValues);
    const threshold = med * 0.7;

    const points: ChartDataPoint[] = data.map((d) => {
      const hours = d.avg_value / 3600;
      return {
        date: new Date(d.bucket).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: new Date(d.bucket).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        hours: Math.round(hours * 10) / 10,
        isBelowThreshold: hours < threshold,
      };
    });

    return {
      chartData: points,
      medianHours: Math.round(med * 10) / 10,
      thresholdHours: Math.round(threshold * 10) / 10,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[320px] text-surface-500 text-sm">
        No sleep data available for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.5} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[0, 'dataMax + 2']}
          unit="h"
          width={50}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />

        {/* Median range band — gray area */}
        <ReferenceArea
          y1={thresholdHours}
          y2={medianHours + (medianHours - thresholdHours)}
          fill="#94a3b8"
          fillOpacity={0.08}
          strokeOpacity={0}
        />

        {/* Median reference line */}
        <ReferenceLine
          y={medianHours}
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          label={{
            value: `Median: ${medianHours}h`,
            fill: '#94a3b8',
            fontSize: 11,
            position: 'insideTopRight',
          }}
        />

        {/* 70% threshold line */}
        <ReferenceLine
          y={thresholdHours}
          stroke="#f43f5e"
          strokeWidth={1}
          strokeDasharray="4 4"
          label={{
            value: `70%: ${thresholdHours}h`,
            fill: '#f43f5e',
            fontSize: 10,
            position: 'insideBottomRight',
          }}
        />

        <Bar dataKey="hours" radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out">
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isBelowThreshold ? '#f43f5e' : '#8b5cf6'}
              fillOpacity={entry.isBelowThreshold ? 0.85 : 0.7}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
