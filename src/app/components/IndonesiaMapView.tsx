import { useEffect, useState } from 'react';
import { MapPin, Navigation, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

interface LocationMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'emergency' | 'responder' | 'hospital';
  image?: string;
}

interface IndonesiaMapViewProps {
  vehiclePosition: { x: number; y: number };
  serviceType: 'ambulance' | 'fire' | 'police';
  onMapClick?: (coords: { lat: number; lng: number; x: number; y: number }) => void;
  allowCoordinateChange?: boolean;
}

export function IndonesiaMapView({ vehiclePosition, serviceType, onMapClick, allowCoordinateChange = false }: IndonesiaMapViewProps) {
  const [markers] = useState<LocationMarker[]>([
    { id: '1', name: 'Jakarta Emergency', lat: -6.2088, lng: 106.8456, type: 'emergency' },
    { id: '2', name: 'Surabaya Hospital', lat: -7.2575, lng: 112.7521, type: 'hospital' },
    { id: '3', name: 'Bandung Station', lat: -6.9175, lng: 107.6191, type: 'responder' },
  ]);

  const [zoom, setZoom] = useState(1);
  const [clickedPoint, setClickedPoint] = useState<{ x: number; y: number } | null>(null);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!allowCoordinateChange || !onMapClick) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Convert pixel position to approximate lat/lng for Indonesia
    // Indonesia spans roughly: 95°E to 141°E longitude, 6°N to 11°S latitude
    const lng = 95 + (x / 100) * 46;
    const lat = 6 - (y / 100) * 17;

    setClickedPoint({ x, y });
    onMapClick({ lat, lng, x, y });
  };

  // Indonesia major cities for map illustration
  const cities = [
    { name: 'Jakarta', x: 35, y: 45 },
    { name: 'Surabaya', x: 55, y: 50 },
    { name: 'Bandung', x: 38, y: 48 },
    { name: 'Medan', x: 20, y: 20 },
    { name: 'Bali', x: 65, y: 55 },
  ];

  return (
    <div
      className={`relative w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-gray-950 overflow-hidden ${
        allowCoordinateChange ? 'cursor-crosshair' : ''
      }`}
      onClick={handleMapClick}
    >
      {/* Map Grid Background */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="indonesiaGrid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#4ade80" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#indonesiaGrid)" />
        </svg>
      </div>

      {/* Indonesia Map Outline (Simplified) */}
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100">
        <path
          d="M 15,25 Q 20,22 25,25 L 30,23 L 35,27 L 40,25 L 50,28 L 60,30 L 70,32 L 75,35 L 78,40 L 80,50 L 75,55 L 70,57 L 60,55 L 50,53 L 40,52 L 30,50 L 20,45 L 15,35 Z"
          fill="none"
          stroke="#10b981"
          strokeWidth="1"
          className="drop-shadow-lg"
        />
        <path
          d="M 12,35 L 8,40 L 10,45 L 15,42 Z"
          fill="none"
          stroke="#10b981"
          strokeWidth="1"
        />
      </svg>

      {/* City Markers */}
      {cities.map((city) => (
        <div
          key={city.name}
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${city.x}%`, top: `${city.y}%` }}
        >
          <div className="group relative">
            <div className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-500/50"></div>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900/90 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-gray-700">
              {city.name}
            </div>
          </div>
        </div>
      ))}

      {/* Route Line */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="rgb(147, 51, 234)" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <path
          d={`M ${vehiclePosition.x} ${vehiclePosition.y} Q 50 50, 35 45`}
          stroke="url(#routeGradient)"
          strokeWidth="3"
          fill="none"
          strokeDasharray="10,5"
          className="animate-pulse"
        />
      </svg>

      {/* Emergency Location Markers */}
      {markers.map((marker) => {
        const markerX = (marker.lng - 95) * 3 + 10;
        const markerY = (marker.lat + 11) * -5 + 55;

        return (
          <div
            key={marker.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${markerX}%`, top: `${markerY}%` }}
          >
            <div className="relative">
              <div
                className={`p-2 rounded-full shadow-lg ${
                  marker.type === 'emergency'
                    ? 'bg-red-500 shadow-red-500/50'
                    : marker.type === 'hospital'
                    ? 'bg-blue-500 shadow-blue-500/50'
                    : 'bg-green-500 shadow-green-500/50'
                }`}
              >
                <MapPin className="w-4 h-4 fill-current" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-current opacity-40 animate-ping"></div>

              {/* Marker Info Card */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                <p className="text-xs font-medium">{marker.name}</p>
                <p className="text-xs text-gray-400">{marker.type}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Moving Vehicle */}
      <div
        className="absolute transition-all duration-200 ease-linear transform -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${vehiclePosition.x}%`, top: `${vehiclePosition.y}%` }}
      >
        <div className="relative bg-gradient-to-br from-blue-500 to-blue-700 p-3 rounded-full shadow-lg shadow-blue-500/50 animate-pulse">
          <MapPin className="w-6 h-6" />
          <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping"></div>
        </div>
      </div>

      {/* User Location - Jakarta */}
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: '35%', top: '45%' }}
      >
        <div className="relative">
          <div className="bg-orange-500 p-3 rounded-full shadow-lg shadow-orange-500/50">
            <MapPin className="w-6 h-6 fill-current" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-orange-400/40 animate-ping"></div>
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm px-3 py-2 rounded-lg text-xs whitespace-nowrap border border-gray-700">
            <p className="font-medium">Your Location</p>
            <p className="text-gray-400">Jakarta, Indonesia</p>
          </div>
        </div>
      </div>

      {/* Clicked Point Marker */}
      {clickedPoint && allowCoordinateChange && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${clickedPoint.x}%`, top: `${clickedPoint.y}%` }}
        >
          <div className="relative">
            <div className="bg-yellow-500 p-2 rounded-full shadow-lg shadow-yellow-500/50 animate-bounce">
              <MapPin className="w-4 h-4 fill-current" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-yellow-400/40 animate-ping"></div>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm px-2 py-1 rounded text-xs whitespace-nowrap border border-gray-700">
              New Location
            </div>
          </div>
        </div>
      )}

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={() => {
            setZoom(1);
            setClickedPoint(null);
            toast.success('Map view reset');
          }}
          className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 p-3 rounded-xl hover:bg-gray-800 transition-all hover:scale-105"
          aria-label="Reset map view"
        >
          <Navigation className="w-5 h-5 text-green-400" />
        </button>
        <button
          onClick={() => setZoom(Math.min(zoom + 0.2, 2))}
          className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 p-3 rounded-xl hover:bg-gray-800 transition-all hover:scale-105"
          aria-label="Zoom in"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          onClick={() => setZoom(Math.max(zoom - 0.2, 0.5))}
          className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 p-3 rounded-xl hover:bg-gray-800 transition-all hover:scale-105"
          aria-label="Zoom out"
        >
          <Minus className="w-5 h-5" />
        </button>
      </div>

      {/* Location Info Badge */}
      <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl px-4 py-2 pointer-events-none">
        <p className="text-xs text-gray-400">Region</p>
        <p className="font-medium text-green-400">Indonesia</p>
      </div>

      {/* Click Instruction */}
      {allowCoordinateChange && (
        <div className="absolute top-4 left-4 bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/50 rounded-xl px-4 py-2 pointer-events-none">
          <p className="text-xs text-yellow-300 font-medium">Click on map to set location</p>
        </div>
      )}
    </div>
  );
}
