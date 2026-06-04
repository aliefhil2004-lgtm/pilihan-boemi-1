import { Ambulance, Flame, History, MapPin, Shield } from 'lucide-react';
import type { ServiceType } from '../types/emergency';

interface EmergencyResultScreenProps {
  emergencyType: string;
  priority: 'Critical' | 'Medium' | 'Low';
  recommendedService: ServiceType;
  recommendedServices: ServiceType[];
  injuryScale: number;
  location: string;
  detectedIndicators?: string[];
  annotatedImage?: string;
  onViewDetails: () => void;
}

const serviceConfig = {
  ambulance: {
    icon: Ambulance,
    name: 'Medical',
    gradient: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/40',
    text: 'text-blue-300'
  },
  fire: {
    icon: Flame,
    name: 'Fire',
    gradient: 'from-orange-500 to-orange-700',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/40',
    text: 'text-orange-300'
  },
  police: {
    icon: Shield,
    name: 'Police',
    gradient: 'from-indigo-500 to-indigo-700',
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/40',
    text: 'text-indigo-300'
  }
};

const priorityStyles = {
  Critical: 'border-red-500/40 bg-red-500/15 text-red-300',
  Medium: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300',
  Low: 'border-green-500/40 bg-green-500/15 text-green-300'
};

export function EmergencyResultScreen({
  emergencyType,
  priority,
  recommendedService,
  recommendedServices,
  location,
  onViewDetails
}: EmergencyResultScreenProps) {
  const primaryConfig = serviceConfig[recommendedService];

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-gray-900 via-gray-900 to-black pb-16 text-white">
      <div className="border-b border-green-500/30 bg-green-950/50 px-5 py-5 sm:px-6">
        <h1 className="text-2xl font-bold">Alert Sent</h1>
        <p className="mt-1 text-sm text-green-300/80">Emergency services have received your report</p>
      </div>

      <div className="app-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mx-auto max-w-xl space-y-4">
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-center">
            <p className="text-lg font-bold text-green-300">Help is being coordinated</p>
            <p className="mt-2 text-sm text-gray-300">
              Stay in a safe place and keep your phone available for updates.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-700 bg-gray-800/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Emergency</p>
                <h2 className="mt-1 text-lg font-bold">{emergencyType}</h2>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${priorityStyles[priority]}`}>
                {priority}
              </span>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Services notified</p>
              <div className="flex flex-wrap gap-2">
                {recommendedServices.map(service => {
                  const config = serviceConfig[service];
                  const ServiceIcon = config.icon;
                  return (
                    <span
                      key={service}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${config.border} ${config.bg} ${config.text}`}
                    >
                      <ServiceIcon className="h-4 w-4" />
                      {config.name}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex items-start gap-2 border-t border-gray-700 pt-4 text-sm text-gray-400">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
              <span>{location}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800 bg-gray-900/50 p-4 backdrop-blur-sm">
        <button
          onClick={onViewDetails}
          className={`flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r ${primaryConfig.gradient} py-4 text-lg font-bold text-white shadow-lg transition hover:opacity-90`}
        >
          <History className="h-6 w-6" />
          View Report Details
        </button>
      </div>
    </div>
  );
}
