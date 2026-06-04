import { useEffect, useState } from 'react';
import { Ambulance, Flame, Shield, ArrowLeft, Clock, Phone, MessageSquare, CheckCircle2, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import { fetchLiveGps } from '../services/liveGps';
import { civilianMarkerIcon, serviceMarkerIcons } from '../utils/mapMarkers';
import { cleanupExpiredReports } from '../services/reportStorage';
import { getServiceStatus, type ServiceType, type StoredEmergencyReport } from '../types/emergency';

interface LiveTrackingScreenProps {
  reportId: string;
  serviceTypes: ServiceType[];
  userLocation: { lat: number; lng: number };
  onOpenChat: () => void;
  onBack?: () => void;
}

const serviceConfig = {
  ambulance: { icon: Ambulance, name: 'Ambulance', unit: 'EMT-42', color: 'text-blue-400' },
  fire: { icon: Flame, name: 'Fire Truck', unit: 'FIRE-15', color: 'text-orange-400' },
  police: { icon: Shield, name: 'Police Unit', unit: 'PD-89', color: 'text-indigo-400' }
};

function ResponderRoute({ serviceType, userLocation }: { serviceType: ServiceType; userLocation: { lat: number; lng: number } }) {
  const index = ['ambulance', 'fire', 'police'].indexOf(serviceType) + 1;
  const [position, setPosition] = useState({
    lat: userLocation.lat - 0.0015 * index,
    lng: userLocation.lng - 0.0012 * index
  });

  useEffect(() => {
    const update = async () => {
      const gps = await fetchLiveGps(serviceType);
      if (gps && Date.now() - gps.updatedAt < 30000) {
        setPosition({ lat: gps.lat, lng: gps.lng });
      } else {
        setPosition(previous => ({
          lat: previous.lat + (userLocation.lat - previous.lat) * 0.04,
          lng: previous.lng + (userLocation.lng - previous.lng) * 0.04
        }));
      }
    };
    update();
    const interval = setInterval(update, 1000);
    window.addEventListener('storage', update);
    window.addEventListener('emergency-gps-updated', update);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', update);
      window.removeEventListener('emergency-gps-updated', update);
    };
  }, [serviceType, userLocation.lat, userLocation.lng]);

  return (
    <>
      <Marker position={[position.lat, position.lng]} icon={serviceMarkerIcons[serviceType]}>
        <Popup>{serviceConfig[serviceType].name} on the way</Popup>
      </Marker>
      <Polyline positions={[[position.lat, position.lng], [userLocation.lat, userLocation.lng]]} />
    </>
  );
}

export function LiveTrackingScreen({ reportId, serviceTypes, userLocation, onOpenChat, onBack }: LiveTrackingScreenProps) {
  const [report, setReport] = useState<StoredEmergencyReport | null>(null);
  const [eta, setEta] = useState(7);
  const services = [...new Set(serviceTypes)];
  const activeServices = report
    ? services.filter(service => ['responding', 'resolved'].includes(getServiceStatus(report, service)))
    : [];
  const trackingActive = activeServices.length > 0;
  const statusSteps = [
    { label: 'Request Received', active: true },
    { label: 'Accepted by Service', active: trackingActive },
    { label: 'Units Dispatched', active: trackingActive },
    { label: 'Live Tracking', active: trackingActive }
  ];

  useEffect(() => {
    const refresh = () => {
      setReport(cleanupExpiredReports().find(item => item.id === reportId) ?? null);
    };
    refresh();
    const interval = setInterval(refresh, 1500);
    window.addEventListener('storage', refresh);
    window.addEventListener('emergency-reports-updated', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('emergency-reports-updated', refresh);
    };
  }, [reportId]);

  useEffect(() => {
    if (!trackingActive) return;
    const etaInterval = setInterval(() => setEta(previous => Math.max(previous - 1, 0)), 60000);
    return () => clearInterval(etaInterval);
  }, [trackingActive]);

  return (
    <div className="flex h-full flex-col bg-gray-900 pb-32 text-white">
      <header className="flex items-center gap-3 border-b border-gray-800 bg-gray-950 px-4 py-3">
        {onBack && (
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="font-bold">Emergency Response</h1>
          <p className="text-xs text-gray-400">
            {trackingActive ? 'Live responder locations' : 'Waiting for emergency service acceptance'}
          </p>
        </div>
      </header>

      <div className="relative h-[440px] overflow-hidden">
        <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={15} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[userLocation.lat, userLocation.lng]} icon={civilianMarkerIcon}><Popup>Civilian location</Popup></Marker>
          {activeServices.map(service => <ResponderRoute key={service} serviceType={service} userLocation={userLocation} />)}
        </MapContainer>
        <div className={`absolute right-4 top-4 z-[500] rounded-xl border px-3 py-2 text-xs ${
          trackingActive
            ? 'border-green-500 bg-green-900/90 text-green-300'
            : 'border-yellow-500/60 bg-yellow-950/90 text-yellow-300'
        }`}>
          <Radio className={`mr-2 inline h-4 w-4 ${trackingActive ? 'animate-pulse' : ''}`} />
          {trackingActive
            ? `Live GPS for ${activeServices.length} unit${activeServices.length > 1 ? 's' : ''}`
            : 'Tracking starts after acceptance'}
        </div>
        {trackingActive && (
          <div className="absolute bottom-4 left-4 z-[500] rounded-2xl border border-gray-700 bg-gray-900/90 px-5 py-3">
            <Clock className="mr-2 inline h-5 w-5 text-orange-400" /><strong className="text-orange-400">{eta} min ETA</strong>
          </div>
        )}
      </div>

      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-black to-gray-900">
        <section className="border-b border-gray-800 p-5">
          <h2 className="mb-3 font-bold">Live Status</h2>
          <div className="grid grid-cols-4 gap-2">
            {statusSteps.map((step, index) => (
              <div key={step.label} className={`rounded-xl p-3 text-center text-xs ${step.active ? 'bg-green-500/20 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
                {step.active && index > 0 && <CheckCircle2 className="mx-auto mb-1 h-4 w-4" />}
                {step.label}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 p-5">
          <h2 className="font-bold">{trackingActive ? 'Dispatched Responders' : 'Awaiting Response'}</h2>
          {!trackingActive && (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
              Live tracking will begin automatically after an emergency service accepts and dispatches a unit.
            </div>
          )}
          {activeServices.map(service => {
            const config = serviceConfig[service];
            const Icon = config.icon;
            return (
              <div key={service} className="flex items-center gap-4 rounded-2xl border border-gray-700 bg-gray-800/70 p-4">
                <Icon className={`h-7 w-7 ${config.color}`} />
                <div>
                  <p className="font-bold">{config.name}</p>
                  <p className="text-xs text-gray-400">Unit {config.unit} is responding</p>
                </div>
              </div>
            );
          })}
        </section>
      </main>

      <footer className="grid grid-cols-2 gap-3 border-t border-gray-800 p-4">
        <button onClick={() => { toast.success('Calling emergency response'); window.location.href = 'tel:112'; }} className="flex items-center justify-center gap-2 rounded-xl bg-gray-800 py-4 hover:bg-gray-700">
          <Phone className="h-5 w-5" /> Call
        </button>
        <button onClick={onOpenChat} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 hover:bg-blue-700">
          <MessageSquare className="h-5 w-5" /> Chat
        </button>
      </footer>
    </div>
  );
}
