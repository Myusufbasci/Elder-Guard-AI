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
  Cell,
} from 'recharts';

interface VitalsBucket {
  bucket: string;
  avg_value: number;
  min_value: number;
  max_value: number;
}

interface StepsChartProps {
  data: VitalsBucket[];
}

interface ChartDataPoint {
  date: string;
  fullDate: string;
  steps: number;
  isBelowAvg: boolean;
}

interface TooltipPayloadItem {
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = (payload[0] as TooltipPayloadItem).payload;
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 shadow-xl">
      <p className="text-xs text-surface-400 mb-1">{point.fullDate}</p>
      <p className="text-sm font-semibold text-surface-50">
        {point.steps.toLocaleString()} <span className="text-xs font-normal text-surface-400">steps</span>
      </p>
    </div>
  );
}

export default function StepsChart({ data }: StepsChartProps) {
  const { chartData, avgSteps } = useMemo(() => {
    const values = data.map((d) => d.avg_value);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    const points: ChartDataPoint[] = data.map((d) => ({
      date: new Date(d.bucket).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: new Date(d.bucket).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      steps: Math.round(d.avg_value),
      isBelowAvg: d.avg_value < avg * 0.5,
    }));

    return { chartData: points, avgSteps: Math.round(avg) };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[320px] text-surface-500 text-sm">
        No step data available for this period
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
          domain={[0, 'dataMax + 500']}
          width={60}
          tickFormatter={(val: number) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val))}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />

        {/* Average line */}
        <ReferenceLine
          y={avgSteps}
          stroke="#2dd4bf"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          label={{
            value: `Avg: ${avgSteps.toLocaleString()}`,
            fill: '#2dd4bf',
            fontSize: 11,
            position: 'insideTopRight',
          }}
        />

        <Bar dataKey="steps" radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out">
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isBelowAvg ? '#fbbf24' : '#2dd4bf'}
              fillOpacity={entry.isBelowAvg ? 0.8 : 0.65}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
