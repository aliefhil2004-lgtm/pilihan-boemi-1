import { useEffect, useState } from 'react';
import { FireMapView } from './FireMapView';
import { Ambulance, Flame, Shield, ArrowLeft, MapPinned } from 'lucide-react';
import { cleanupExpiredReports } from '../services/reportStorage';
import { getReportServices, type StoredEmergencyReport } from '../types/emergency';

interface FireMapScreenProps {
  userLocation: { lat: number; lng: number };
  countryCode: string;
  onBack: () => void;
}

export function FireMapScreen({ userLocation, countryCode, onBack }: FireMapScreenProps) {
  const [reports, setReports] = useState<StoredEmergencyReport[]>([]);

  useEffect(() => {
    const refresh = () => {
      setReports(
        cleanupExpiredReports().filter(
          report => report.status !== 'resolved' && (!report.countryCode || report.countryCode === countryCode)
        )
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
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="bg-blue-500/20 p-2 rounded-lg">
            <MapPinned className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Emergency Response Map</h1>
            <p className="text-xs text-gray-400">All active reported emergency locations</p>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-72">
        <FireMapView userLocation={userLocation} reports={reports} />
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
        <p className="mt-3 text-center text-xs text-gray-500">{reports.length} active reported locations displayed</p>
      </div>
    </div>
  );
}
