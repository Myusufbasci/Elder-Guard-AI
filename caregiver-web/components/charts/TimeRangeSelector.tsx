'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const RANGES = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
] as const;

interface TimeRangeSelectorProps {
  currentRange: string;
}

export default function TimeRangeSelector({ currentRange }: TimeRangeSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleRangeChange = useCallback(
    (range: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('range', range);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-surface-800/60 p-1" id="time-range-selector">
      {RANGES.map(({ label, value }) => (
        <button
          key={value}
          id={`range-${value}`}
          onClick={() => handleRangeChange(value)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            currentRange === value
              ? 'bg-accent-500 text-surface-950 shadow-md'
              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/60'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
