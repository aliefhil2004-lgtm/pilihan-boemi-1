import { useEffect, useMemo, useState } from 'react';
import { FireMapView } from './FireMapView';
import { Ambulance, Flame, Shield, ArrowLeft, MapPinned, Video, ExternalLink, X, AlertTriangle } from 'lucide-react';
import { cleanupExpiredReports } from '../services/reportStorage';
import { getReportServices, getServiceStatus, type StoredEmergencyReport } from '../types/emergency';
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
        report => !['resolved', 'done', 'declined'].includes(report.status) && (!report.countryCode || report.countryCode === countryCode)
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
    reports.filter(report =>
      getReportServices(report).includes(service) &&
      !['resolved', 'done', 'declined'].includes(getServiceStatus(report, service))
    ).length;
  const hasDangerZoneReports = reports.some(report => {
    const services = getReportServices(report);
    return services.some(service =>
      (service === 'fire' || service === 'police') &&
      !['resolved', 'done', 'declined'].includes(getServiceStatus(report, service))
    );
  });

  return (
    <div className="flex h-full flex-col bg-white text-[#0b3850]">
      <div className="flex h-[104px] items-end gap-3 bg-white px-7 pb-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#0b3850] hover:bg-slate-100" aria-label="Back to response center">
            <ArrowLeft className="h-[19px] w-[19px]" />
          </button>
          <div className="hidden rounded-lg bg-blue-500/15 p-2">
            <MapPinned className="h-5 w-5 text-[#2f80ff]" />
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold">{tr('map.title')}</h1>
            <p className="hidden text-xs text-slate-400">{tr('map.subtitle')}</p>
          </div>
      </div>

      <div className="relative flex-1 min-h-72">
        <FireMapView
          userLocation={userLocation}
          reports={reports}
          cameras={cameras}
          onCameraSelect={setSelectedCamera}
          liveGpsByService={{}}
        />
        {hasDangerZoneReports && (
        <div className="absolute right-5 top-6 z-10 rounded-2xl bg-[#30354f]/95 p-3 text-[12px] text-white shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-white">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            {tr('map.dangerZones')}
          </div>
          <div className="space-y-1.5 text-gray-200">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-600/90" /> {tr('map.high')}</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-yellow-500/90" /> {tr('map.yellow')}</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-600/90" /> {tr('map.watch')}</div>
          </div>
        </div>
        )}
        <div className="absolute left-5 top-6 z-10 rounded-2xl bg-slate-950/85 px-3 py-2 text-[12px] text-white shadow-lg backdrop-blur">
          <span className={trafficEnabled ? 'text-emerald-300' : 'text-yellow-300'}>
            {tr('map.traffic')}: {trafficEnabled ? tr('map.live') : tr('map.apiKeyNeeded')}
          </span>
        </div>
      </div>

      <div className="absolute bottom-9 left-0 right-0 px-6">
        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-[#30354f]/95 px-4 py-4 text-white shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Ambulance className="w-4 h-4 text-blue-400" />
                  <p className="text-[12px] font-semibold text-sky-300">Medical</p>
                </div>
                <p className="text-[22px] font-bold leading-6 text-white">{countByService('ambulance')}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <p className="text-[12px] font-semibold text-orange-300">Fire</p>
                </div>
                <p className="text-[22px] font-bold leading-6 text-white">{countByService('fire')}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <p className="text-[12px] font-semibold text-blue-500">Police</p>
                </div>
                <p className="text-[22px] font-bold leading-6 text-white">{countByService('police')}</p>
              </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-full bg-white/95 px-3 py-2 text-[10px] font-bold text-[#0b3850] shadow-[0_10px_28px_rgba(15,23,42,0.22)] backdrop-blur">
          <span className="flex items-center justify-center whitespace-nowrap">{reports.length} active reports</span>
          <span className="flex items-center justify-center gap-1 text-[#ef4444]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {reports.filter(report => report.injuryScale >= 8).length} high zones
          </span>
          <span className="flex items-center justify-center gap-1 text-[#10b981]">
            <Video className="h-3.5 w-3.5 shrink-0" /> {cameras.length} public CCTV
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
