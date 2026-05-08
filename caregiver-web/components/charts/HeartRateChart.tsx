'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface VitalsBucket {
  bucket: string;
  avg_value: number;
  min_value: number;
  max_value: number;
}

interface HeartRateChartProps {
  data: VitalsBucket[];
}

interface ChartDataPoint {
  date: string;
  fullDate: string;
  bpm: number;
  min: number;
  max: number;
  isAnomaly: boolean;
}

interface DotRenderProps {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
}

interface TooltipPayloadItem {
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

/** Compute median of a numeric array */
function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid] as number;
  }
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Compute MAD (Median Absolute Deviation) */
function computeMAD(values: number[], median: number): number {
  const deviations = values.map((v) => Math.abs(v - median));
  return computeMedian(deviations);
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = (payload[0] as TooltipPayloadItem).payload;
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 shadow-xl">
      <p className="text-xs text-surface-400 mb-1">{point.fullDate}</p>
      <p className="text-sm font-semibold text-surface-50">
        {point.bpm} <span className="text-xs font-normal text-surface-400">bpm</span>
      </p>
      <div className="flex gap-3 mt-1">
        <span className="text-xs text-surface-500">Min: {point.min}</span>
        <span className="text-xs text-surface-500">Max: {point.max}</span>
      </div>
      {point.isAnomaly && (
        <p className="text-xs text-danger-400 mt-1 font-medium">⚠ Anomaly detected</p>
      )}
    </div>
  );
}

export default function HeartRateChart({ data }: HeartRateChartProps) {
  const { chartData, medianValue, thresholdUpper, thresholdLower } = useMemo(() => {
    const values = data.map((d) => d.avg_value);
    const med = computeMedian(values);
    const madVal = computeMAD(values, med);
    const upper = med + 3.5 * madVal;
    const lower = Math.max(0, med - 3.5 * madVal);

    const points: ChartDataPoint[] = data.map((d) => ({
      date: new Date(d.bucket).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: new Date(d.bucket).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      bpm: Math.round(d.avg_value * 10) / 10,
      min: Math.round(d.min_value),
      max: Math.round(d.max_value),
      isAnomaly: d.avg_value > upper || d.avg_value < lower,
    }));

    return { chartData: points, medianValue: med, thresholdUpper: upper, thresholdLower: lower };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[320px] text-surface-500 text-sm">
        No heart rate data available for this period
      </div>
    );
  }

  const renderDot = (props: DotRenderProps) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) return null;
    if (payload.isAnomaly) {
      return (
        <circle
          key={`anomaly-${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={5}
          fill="#f43f5e"
          stroke="#1e293b"
          strokeWidth={2}
          className="drop-shadow-md"
        />
      );
    }
    return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={2} fill="#14b8a6" />;
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.5} />
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
          domain={['dataMin - 10', 'dataMax + 10']}
          unit=" bpm"
          width={65}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#475569', strokeDasharray: '3 3' }} />

        {/* 7-day median — green reference line */}
        <ReferenceLine
          y={Math.round(medianValue * 10) / 10}
          stroke="#4ade80"
          strokeWidth={2}
          strokeDasharray="8 4"
          label={{
            value: `Median: ${Math.round(medianValue)}`,
            fill: '#4ade80',
            fontSize: 11,
            position: 'insideTopRight',
          }}
        />

        {/* Anomaly threshold upper — red dashed line */}
        <ReferenceLine
          y={Math.round(thresholdUpper * 10) / 10}
          stroke="#f43f5e"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          label={{
            value: `Threshold: ${Math.round(thresholdUpper)}`,
            fill: '#f43f5e',
            fontSize: 10,
            position: 'insideTopRight',
          }}
        />

        {/* Anomaly threshold lower (only if above zero) */}
        {thresholdLower > 20 && (
          <ReferenceLine
            y={Math.round(thresholdLower * 10) / 10}
            stroke="#f43f5e"
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
        )}

        <Line
          type="monotone"
          dataKey="bpm"
          stroke="#14b8a6"
          strokeWidth={2}
          dot={renderDot}
          activeDot={{ r: 6, stroke: '#14b8a6', fill: '#0f172a', strokeWidth: 2 }}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
