import { useEffect, useMemo, useState } from 'react';
import { FireMapView } from './FireMapView';
import { Ambulance, Flame, Shield, ArrowLeft, MapPinned, Video, ExternalLink, X, AlertTriangle } from 'lucide-react';
import { cleanupExpiredReports } from '../services/reportStorage';
import { getReportServices, type StoredEmergencyReport } from '../types/emergency';
import { indonesiaPublicCctv, type PublicCctvCamera } from '../config/cctv';
import { t, type Language } from '../i18n';

interface FireMapScreenProps {
  userLocation: { lat: number; lng: number };
  countryCode: string;
  onBack: () => void;
  language: Language;
}

export function FireMapScreen({ userLocation, countryCode, onBack, language }: FireMapScreenProps) {
  const [reports, setReports] = useState<StoredEmergencyReport[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<PublicCctvCamera | null>(null);
  const trafficEnabled = Boolean(import.meta.env.VITE_TOMTOM_API_KEY);
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);
  const cameras = useMemo(
    () => countryCode === 'ID' ? indonesiaPublicCctv : [],
    [countryCode]
  );

  useEffect(() => {
    const refresh = () => {
      const nextReports = cleanupExpiredReports().filter(
        report => report.status !== 'resolved' && (!report.countryCode || report.countryCode === countryCode)
      );
      setReports(currentReports =>
        JSON.stringify(currentReports) === JSON.stringify(nextReports)
          ? currentReports
          : nextReports
      );
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    window.addEventListener('emergency-reports-updated', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('emergency-reports-updated', refresh);
    };
  }, [countryCode]);

  const countByService = (service: 'ambulance' | 'fire' | 'police') =>
    reports.filter(report => getReportServices(report).includes(service)).length;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-blue-500/30 bg-gradient-to-br from-blue-900/30 to-indigo-900/20 p-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2 text-sm font-semibold hover:bg-gray-900/80" aria-label="Back to response center">
            <ArrowLeft className="h-4 w-4" /> {tr('common.back')}
          </button>
          <div className="bg-blue-500/20 p-2 rounded-lg">
            <MapPinned className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{tr('map.title')}</h1>
            <p className="text-xs text-gray-400">{tr('map.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-72">
        <FireMapView
          userLocation={userLocation}
          reports={reports}
          cameras={cameras}
          onCameraSelect={setSelectedCamera}
        />
        <div className="absolute left-3 top-3 z-10 rounded-xl border border-gray-700 bg-gray-950/90 p-3 text-xs shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center gap-2 font-semibold text-white">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            {tr('map.dangerZones')}
          </div>
          <div className="space-y-1.5 text-gray-300">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-600/70" /> {tr('map.critical')}</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-orange-500/70" /> {tr('map.high')}</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-yellow-500/70" /> {tr('map.yellow')}</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-500/70" /> {tr('map.watch')}</div>
          </div>
        </div>
        <div className="absolute right-3 top-3 z-10 rounded-xl border border-gray-700 bg-gray-950/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <span className={trafficEnabled ? 'text-emerald-300' : 'text-yellow-300'}>
            {tr('map.traffic')}: {trafficEnabled ? tr('map.live') : tr('map.apiKeyNeeded')}
          </span>
        </div>
      </div>

      <div className="bg-gray-900/50 border-t border-gray-800 p-4">
        <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Ambulance className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-gray-400">Medical</p>
                </div>
                <p className="text-xl font-bold text-blue-400">{countByService('ambulance')}</p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <p className="text-xs text-gray-400">Fire</p>
                </div>
                <p className="text-xl font-bold text-orange-400">{countByService('fire')}</p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <p className="text-xs text-gray-400">Police</p>
                </div>
                <p className="text-xl font-bold text-indigo-400">{countByService('police')}</p>
              </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
          <span>{reports.length} {tr('map.activeLocations')}</span>
          <span className="flex items-center gap-1.5 text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" /> {reports.filter(report => report.injuryScale >= 8).length} {tr('map.criticalZones')}
          </span>
          <span className="flex items-center gap-1.5 text-emerald-300">
            <Video className="h-3.5 w-3.5" /> {cameras.length} {tr('map.publicCctv')}
          </span>
        </div>
      </div>

      {selectedCamera && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-gray-700 bg-gray-900 p-4 sm:rounded-2xl sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-emerald-400" />
                  <h2 className="font-bold">{selectedCamera.name}</h2>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {selectedCamera.location} · OpenCCTV {selectedCamera.feedType}
                </p>
              </div>
              <button
                onClick={() => setSelectedCamera(null)}
                className="rounded-lg bg-gray-800 p-2 text-gray-300 hover:bg-gray-700"
                aria-label="Close CCTV"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe
              src={selectedCamera.embedUrl}
              title={selectedCamera.name}
              className="h-[55vh] min-h-80 w-full rounded-xl border border-gray-700 bg-black"
              allowFullScreen
            />
            <a
              href={selectedCamera.embedUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold hover:bg-emerald-500"
            >
              <ExternalLink className="h-4 w-4" /> Open on OpenCCTV
            </a>
            <p className="mt-3 text-center text-xs text-gray-500">
              Public feed provided by OpenCCTV. Availability depends on the original camera source.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
