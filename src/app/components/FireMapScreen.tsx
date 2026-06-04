import { useState } from 'react';
import { FireMapView } from './FireMapView';
import { FireStreamPanel } from './FireStreamPanel';
import { Flame, AlertTriangle, TrendingUp, ArrowLeft, Map, Video } from 'lucide-react';

interface FireMapScreenProps {
  userLocation: { lat: number; lng: number };
  onBack: () => void;
}

export function FireMapScreen({ userLocation, onBack }: FireMapScreenProps) {
  const [view, setView] = useState<'map' | 'stream'>('map');

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-red-900/30 to-orange-900/20 border-b border-red-500/30 p-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="rounded-full bg-gray-900/50 p-2 hover:bg-gray-900/80" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="bg-red-500/20 p-2 rounded-lg">
            <Flame className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Fire Detection Map</h1>
            <p className="text-xs text-gray-400">Real-time fire hotspot monitoring</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 border-b border-gray-800 bg-gray-950 p-2">
        <button
          onClick={() => setView('map')}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${view === 'map' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
        >
          <Map className="h-4 w-4" /> Hotspot Map
        </button>
        <button
          onClick={() => setView('stream')}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${view === 'stream' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
        >
          <Video className="h-4 w-4" /> Live Incident Stream
        </button>
      </div>

      {view === 'map' ? (
        <>
          <div className="relative flex-1 min-h-72">
            <FireMapView userLocation={userLocation} />
          </div>

          <div className="bg-gray-900/50 border-t border-gray-800 p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-xs text-gray-400">High Risk</p>
                </div>
                <p className="text-xl font-bold text-red-400">2</p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <p className="text-xs text-gray-400">Active</p>
                </div>
                <p className="text-xl font-bold text-orange-400">5</p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-yellow-400" />
                  <p className="text-xs text-gray-400">24h Trend</p>
                </div>
                <p className="text-xl font-bold text-yellow-400">+3</p>
              </div>
            </div>

            <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300">
                <span className="font-bold">Data Source:</span> NASA FIRMS provides near real-time active fire hotspot data from MODIS and VIIRS satellites.
              </p>
            </div>
          </div>
        </>
      ) : (
        <FireStreamPanel />
      )}
    </div>
  );
}
