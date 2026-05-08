'use client';

import dynamic from 'next/dynamic';
import MapSkeleton from '@/components/MapSkeleton';

const DynamicMap = dynamic(() => import('@/components/Map'), {
  loading: () => <MapSkeleton />,
  ssr: false,
});

interface LocationPoint {
  lat: number;
  lng: number;
  time?: string;
}

interface MapClientProps {
  currentLocation: LocationPoint | null;
  trail: LocationPoint[];
  elderName?: string;
}

export default function MapClient({ currentLocation, trail, elderName }: MapClientProps) {
  return (
    <DynamicMap
      currentLocation={currentLocation}
      trail={trail}
      elderName={elderName}
    />
  );
}
