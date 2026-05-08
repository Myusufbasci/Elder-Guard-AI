/**
 * Vitals summary card showing latest metrics for an elder.
 * Server component — receives data as props.
 */
interface VitalMetric {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
}

interface VitalsCardProps {
  metrics: VitalMetric[];
}

export default function VitalsCard({ metrics }: VitalsCardProps) {
  return (
    <div className="rounded-2xl bg-surface-900 border border-surface-800 p-5">
      <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
        Latest Vitals
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center text-accent-400 shrink-0">
              {metric.icon}
            </div>
            <div>
              <p className="text-xs text-surface-500">{metric.label}</p>
              <p className="text-lg font-semibold text-surface-50">
                {metric.value}
                <span className="text-sm text-surface-500 ml-1">{metric.unit}</span>
              </p>
              {metric.trend && (
                <span className={`text-xs ${
                  metric.trend === 'up' ? 'text-danger-400' :
                  metric.trend === 'down' ? 'text-warning-400' :
                  'text-success-400'
                }`}>
                  {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'} {metric.trend}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
