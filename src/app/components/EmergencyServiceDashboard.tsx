import { useState, useEffect } from 'react';
import { Ambulance, Flame, Shield, Clock, MapPin, AlertTriangle, Phone, Navigation, Filter, Radio, Edit, MessageSquare, ImageOff, ArrowLeft } from 'lucide-react';
import { EmergencyMap } from './EmergencyMap.tsx';
import { toast } from 'sonner';
import { publishLiveGps } from '../services/liveGps';
import { LocationPicker } from './LocationPicker';
import { createServiceStatuses, getOverallStatus, getReportServices, getServiceStatus, type ServiceType, type StoredEmergencyReport } from '../types/emergency';
import { cleanupExpiredReports } from '../services/reportStorage';
import type { AseanCountry } from '../config/asean';

type EmergencyReport = Omit<StoredEmergencyReport, 'timestamp'> & {
  timestamp: Date;
};

interface EmergencyServiceDashboardProps {
  serviceType: ServiceType;
  onOpenChat: (reportId: string) => void;
  onBack: () => void;
  country: AseanCountry;
}

export function EmergencyServiceDashboard({ serviceType, onOpenChat, onBack, country }: EmergencyServiceDashboardProps) {
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<EmergencyReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'responding'>('pending');
  const [isSharingGps, setIsSharingGps] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [serviceLocation, setServiceLocation] = useState({
    address: country.center.address,
    coords: { lat: country.center.lat, lng: country.center.lng }
  });

  useEffect(() => {
    setServiceLocation({
      address: country.center.address,
      coords: { lat: country.center.lat, lng: country.center.lng }
    });
  }, [country]);

  useEffect(() => {
  const loadReports = () => {
    const savedReports = cleanupExpiredReports();

    // convert timestamp string jadi Date lagi
    const formattedReports = savedReports.map((report: any) => ({
      ...report,
      timestamp: new Date(report.timestamp)
    }));

    setReports(formattedReports);
  };

  // load pertama kali
  loadReports();

  // auto refresh tiap 2 detik
  const interval = setInterval(loadReports, 2000);

  return () => clearInterval(interval);
}, []);

  const serviceIcons = {
    ambulance: Ambulance,
    fire: Flame,
    police: Shield
  };

  const serviceColors = {
    ambulance: { bg: 'bg-blue-600', gradient: 'from-blue-500 to-blue-700', text: 'text-blue-400', border: 'border-blue-500' },
    fire: { bg: 'bg-orange-600', gradient: 'from-orange-500 to-orange-700', text: 'text-orange-400', border: 'border-orange-500' },
    police: { bg: 'bg-indigo-600', gradient: 'from-indigo-500 to-indigo-700', text: 'text-indigo-400', border: 'border-indigo-500' }
  };

  const ServiceIcon = serviceIcons[serviceType];
  const colors = serviceColors[serviceType];
  const unitIds = { ambulance: 'EMT-42', fire: 'FIRE-15', police: 'PD-89' };
  const serviceReports = reports.filter(r =>
    getReportServices(r).includes(serviceType) &&
    (!r.countryCode || r.countryCode === country.code)
  );

  const filteredReports = serviceReports.filter(r =>
    (filter === 'all' ? true : getServiceStatus(r, serviceType) === filter)
  ).sort((a, b) => b.injuryScale - a.injuryScale);

  const getInjuryScaleColor = (scale: number) => {
    if (scale >= 8) return 'text-red-400';
    if (scale >= 5) return 'text-orange-400';
    if (scale >= 3) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getInjuryScaleLabel = (scale: number) => {
    if (scale >= 8) return 'CRITICAL';
    if (scale >= 5) return 'SEVERE';
    if (scale >= 3) return 'MODERATE';
    return 'MINOR';
  };

  const handleRespond = (reportId: string) => {
  const updatedReports = reports.map(r =>
    r.id === reportId
      ? updateUnitStatus(r, 'responding')
      : r
  );

  setReports(updatedReports);

  localStorage.setItem(
    'emergencyReports',
    JSON.stringify(updatedReports)
  );
  window.dispatchEvent(new Event('emergency-reports-updated'));
};

  const handleResolve = (reportId: string) => {
    const updatedReports = reports.map(r =>
      r.id === reportId ? updateUnitStatus(r, 'resolved') : r
    );
    setReports(updatedReports);
    localStorage.setItem('emergencyReports', JSON.stringify(updatedReports));
    window.dispatchEvent(new Event('emergency-reports-updated'));
    setSelectedReport(null);
  };

  const updateUnitStatus = (report: EmergencyReport, status: 'responding' | 'resolved') => {
    const serviceStatuses = {
      ...createServiceStatuses(getReportServices(report), report.status),
      ...report.serviceStatuses,
      [serviceType]: status
    };
    return { ...report, serviceStatuses, status: getOverallStatus(serviceStatuses, report.status) };
  };

  const toggleGpsSharing = () => {
    if (isSharingGps) {
      setIsSharingGps(false);
      toast.info('Live GPS sharing stopped');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('GPS is not supported on this device');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        publishLiveGps({
          service: serviceType,
          unit: unitIds[serviceType],
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          updatedAt: Date.now()
        });
        setIsSharingGps(true);
        toast.success('Live GPS sharing enabled');
      },
      () => toast.error('Location permission is required to share live GPS'),
      { enableHighAccuracy: true }
    );
  };

  const handleServiceLocationChange = (
    address: string,
    coords: { lat: number; lng: number }
  ) => {
    setServiceLocation({ address, coords });
    publishLiveGps({
      service: serviceType,
      unit: unitIds[serviceType],
      ...coords,
      updatedAt: Date.now()
    });
    toast.success('Service location published to live tracking');
  };

  useEffect(() => {
    if (!isSharingGps || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      position => publishLiveGps({
        service: serviceType,
        unit: unitIds[serviceType],
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        updatedAt: Date.now()
      }),
      () => toast.error('Unable to refresh live GPS'),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isSharingGps, serviceType]);

  return (
    <>
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} px-5 py-5 pr-28 shadow-lg sm:px-6 sm:py-6 sm:pr-56`}>
        <div className="mx-auto max-w-6xl">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 rounded-lg border border-white/25 bg-black/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-black/25"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Response Center
        </button>
        <div className="flex items-center gap-4 mb-3">
          <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
            <ServiceIcon className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold capitalize">{serviceType} Command</h1>
            <p className="text-sm opacity-90">Emergency Response Dashboard</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-xs opacity-80">Active</p>
            <p className="text-2xl font-bold">{filteredReports.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-xs opacity-80">Pending</p>
            <p className="text-2xl font-bold">{serviceReports.filter(r => getServiceStatus(r, serviceType) === 'pending').length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-xs opacity-80">En Route</p>
            <p className="text-2xl font-bold">{serviceReports.filter(r => getServiceStatus(r, serviceType) === 'responding').length}</p>
          </div>
        </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-800 bg-gray-900/50 p-4">
        <div className="mx-auto max-w-6xl">
        <div className="mb-3 bg-gray-800/70 border border-gray-700 rounded-xl p-3 flex items-center gap-3">
          <MapPin className="w-5 h-5 text-green-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Service GPS Location</p>
            <p className="text-sm truncate">{serviceLocation.address}</p>
          </div>
          <button
            onClick={() => setShowLocationPicker(true)}
            className="bg-blue-500/20 hover:bg-blue-500/30 p-2 rounded-lg transition"
            aria-label="Change service location"
          >
            <Edit className="w-4 h-4 text-blue-400" />
          </button>
        </div>
        <button
          onClick={toggleGpsSharing}
          className={`mb-3 w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition ${
            isSharingGps ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          <Radio className={`w-4 h-4 ${isSharingGps ? 'animate-pulse' : ''}`} />
          {isSharingGps ? 'Live GPS Sharing ON' : 'Share Live GPS'}
        </button>
        <div className="flex items-start gap-3">
          <Filter className="w-5 h-5 text-gray-400" />
          <div className="grid flex-1 grid-cols-3 gap-2">
            {(['all', 'pending', 'responding'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-2 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                  filter === f
                    ? `bg-gradient-to-r ${colors.gradient} text-white shadow-lg`
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="app-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
        {filteredReports.length === 0 ? (
          <div className="py-20 text-center lg:col-span-2">
            <AlertTriangle className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500">No active reports</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="bg-gradient-to-br from-gray-800/80 to-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl overflow-hidden cursor-pointer hover:border-gray-600 hover:shadow-lg transition group"
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start gap-4 mb-3">
                  {report.photo ? (
                    <img
                      src={report.photo}
                      alt="Emergency"
                      className="h-20 w-20 rounded-lg border border-gray-700 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-900/70">
                      <ImageOff className="h-6 w-6 text-gray-600" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className={`font-bold text-lg ${getInjuryScaleColor(report.injuryScale)}`}>
                        {getInjuryScaleLabel(report.injuryScale)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        {Math.floor((Date.now() - report.timestamp.getTime()) / 60000)}m ago
                      </div>
                    </div>

                    <p className="text-sm text-gray-300 mb-3 line-clamp-2">
                      {report.description}
                    </p>

                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="font-mono">{report.location}</span>
                    </div>

                    {/* Injury Scale Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Priority Scale</span>
                        <span className={`font-bold ${getInjuryScaleColor(report.injuryScale)}`}>
                          {report.injuryScale.toFixed(1)}/10
                        </span>
                      </div>
                      <div className="h-2 bg-gray-900/50 rounded-full overflow-hidden border border-gray-700/50">
                        <div
                          className={`h-full transition-all ${
                            report.injuryScale >= 8 ? 'bg-gradient-to-r from-red-500 to-red-700' :
                            report.injuryScale >= 5 ? 'bg-gradient-to-r from-orange-500 to-orange-700' :
                            report.injuryScale >= 3 ? 'bg-gradient-to-r from-yellow-500 to-yellow-700' :
                            'bg-gradient-to-r from-green-500 to-green-700'
                          }`}
                          style={{ width: `${report.injuryScale * 10}%` }}
                        />
                      </div>
                    </div>
                    {report.disasterScale && (
                      <div className="mt-3 flex items-center justify-between rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs">
                        <span className="font-semibold text-red-200">Natural Disaster: {report.disasterLevel}</span>
                        <span className="font-bold text-red-300">Level {report.disasterScale}/5</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-2">
                  {getServiceStatus(report, serviceType) === 'pending' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRespond(report.id);
                      }}
                      className={`col-span-2 bg-gradient-to-r ${colors.gradient} text-white py-3 rounded-xl font-medium hover:opacity-90 transition shadow-lg`}
                    >
                      Dispatch Unit
                    </button>
                  )}
                  {getServiceStatus(report, serviceType) === 'responding' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolve(report.id);
                      }}
                      className="col-span-2 bg-gradient-to-r from-green-500 to-green-700 text-white py-3 rounded-xl font-medium hover:opacity-90 transition shadow-lg"
                    >
                      Mark Resolved
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChat(report.id);
                    }}
                    className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition flex items-center justify-center"
                    aria-label="Open emergency chat"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                  {report.reporterPhone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `tel:${report.reporterPhone}`;
                      }}
                      className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition flex items-center justify-center"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://maps.google.com/?q=${report.location}`, '_blank');
                    }}
                    className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition flex items-center justify-center"
                    aria-label="Open report location in maps"
                  >
                    <Navigation className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-50"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-t-xl border border-gray-700 bg-gradient-to-b from-gray-900 to-gray-800 md:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`bg-gradient-to-r ${colors.gradient} p-6`}>
              <h2 className="text-xl font-bold">Emergency Report Details</h2>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
              {selectedReport.photo ? (
                <img
                  src={selectedReport.photo}
                  alt="Emergency"
                  className="h-64 w-full rounded-lg border border-gray-700 object-cover"
                />
              ) : (
                <div className="flex h-48 w-full flex-col items-center justify-center rounded-lg border border-gray-700 bg-gray-900/70 text-gray-500">
                  <ImageOff className="mb-2 h-8 w-8" />
                  <p className="text-sm">No incident photo</p>
                </div>
              )}
              <div>
               <div>
            <h3 className="font-semibold text-gray-400 mb-2 text-sm">
               Location
               </h3>

                <p className="text-white font-mono">
                {selectedReport.location}
                </p>

  <div className="mt-4">
    <EmergencyMap
      lat={-6.2088}
      lng={106.8456}
      serviceType={serviceType}
    />
  </div>
</div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-400 mb-2 text-sm">Priority Assessment</h3>
                <div className={`text-3xl font-bold ${getInjuryScaleColor(selectedReport.injuryScale)}`}>
                  {getInjuryScaleLabel(selectedReport.injuryScale)} - {selectedReport.injuryScale.toFixed(1)}/10
                </div>
              </div>
              {selectedReport.disasterScale && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-red-300">Natural Disaster Impact Scale</h3>
                      <p className="mt-1 text-xl font-bold text-white">{selectedReport.disasterLevel}</p>
                    </div>
                    <span className="rounded-lg bg-red-500/20 px-3 py-2 font-bold text-red-200">
                      Level {selectedReport.disasterScale}/5
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map(level => (
                      <div
                        key={level}
                        className={`h-2 rounded-full ${level <= selectedReport.disasterScale! ? 'bg-red-500' : 'bg-gray-700'}`}
                      />
                    ))}
                  </div>
                </div>
              )}
              {selectedReport.detectedIndicators && selectedReport.detectedIndicators.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-400 mb-2 text-sm">Assessment Indicators</h3>
                  {selectedReport.detectedIndicators.map(indicator => (
                    <p key={indicator} className="text-sm text-gray-300">- {indicator}</p>
                  ))}
                </div>
              )}
              <button
                onClick={() => setSelectedReport(null)}
                className="w-full rounded-lg bg-gray-700 py-3 font-medium text-white transition hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    {showLocationPicker && (
      <LocationPicker
        currentLocation={serviceLocation.address}
        onLocationChange={handleServiceLocationChange}
        onClose={() => setShowLocationPicker(false)}
        country={country}
      />
    )}
    </>
  );
}
