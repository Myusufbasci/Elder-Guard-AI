'use client';

/**
 * Leaflet Map component — client-only.
 * AGENTS.md Rule 6 + REVERSE_ENGINEERING_DOC Pattern 11:
 *   - "use client" at top
 *   - import "leaflet/dist/leaflet.css" HERE (not in globals.css)
 *   - This file is loaded via dynamic(ssr:false) from MapClient.tsx
 */
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon issue in bundled environments
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

interface LocationPoint {
  lat: number;
  lng: number;
  time?: string;
}

interface MapProps {
  /** Current location of the elder */
  currentLocation: LocationPoint | null;
  /** 24h location trail */
  trail: LocationPoint[];
  /** Elder name for popup */
  elderName?: string;
}

export default function Map({ currentLocation, trail, elderName }: MapProps) {
  const center: [number, number] = currentLocation
    ? [currentLocation.lat, currentLocation.lng]
    : [39.925, 32.866]; // Default: Ankara, Turkey

  const trailPositions: [number, number][] = trail.map((p) => [p.lat, p.lng]);

  return (
    <div className="w-full h-[400px] rounded-2xl overflow-hidden border border-surface-800">
      <MapContainer
        center={center}
        zoom={currentLocation ? 15 : 6}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 24h trail polyline */}
        {trailPositions.length > 1 && (
          <Polyline
            positions={trailPositions}
            pathOptions={{
              color: '#14b8a6',
              weight: 3,
              opacity: 0.7,
              dashArray: '10, 6',
            }}
          />
        )}

        {/* Current location marker */}
        {currentLocation && (
          <Marker position={[currentLocation.lat, currentLocation.lng]}>
            <Popup>
              <div className="text-sm">
                <strong>{elderName || 'Elder'}</strong>
                <br />
                {currentLocation.time && (
                  <span className="text-xs text-gray-500">
                    Last seen: {new Date(currentLocation.time).toLocaleString()}
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
