import { Ambulance, Flame, Shield, MapPin, Clock, AlertTriangle, CheckCircle2, Navigation, History } from 'lucide-react';
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

export function EmergencyResultScreen({
  emergencyType,
  recommendedService,
  recommendedServices,
  injuryScale,
  location,
  detectedIndicators = [],
  annotatedImage,
  onViewDetails
}: EmergencyResultScreenProps) {
  const openLocationMap = () => {
    window.open(
      `https://maps.google.com/?q=${encodeURIComponent(location)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const serviceConfig = {
    ambulance: {
      icon: Ambulance,
      name: 'Medical Emergency',
      unit: 'EMT-42',
      color: 'blue',
      gradient: 'from-blue-500 to-blue-700',
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/50',
      text: 'text-blue-400'
    },
    fire: {
      icon: Flame,
      name: 'Fire Emergency',
      unit: 'FIRE-15',
      color: 'orange',
      gradient: 'from-orange-500 to-orange-700',
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/50',
      text: 'text-orange-400'
    },
    police: {
      icon: Shield,
      name: 'Police Emergency',
      unit: 'PD-89',
      color: 'indigo',
      gradient: 'from-indigo-500 to-indigo-700',
      bg: 'bg-indigo-500/20',
      border: 'border-indigo-500/50',
      text: 'text-indigo-400'
    }
  };

  const config = serviceConfig[recommendedService];
  const ServiceIcon = config.icon;

  const scaleValue = Math.max(1, Math.min(10, Math.round(injuryScale)));
  const scaleMarkerPosition = Math.min(96, Math.max(4, scaleValue * 10));
  const severityLevel =
    scaleValue >= 8 ? 'Critical' :
    scaleValue >= 6 ? 'High' :
    scaleValue >= 4 ? 'Medium' :
    'Low';

  const priorityConfig = {
    Critical: {
      color: 'text-red-400',
      bg: 'bg-red-500/20',
      border: 'border-red-500/50',
      icon: AlertTriangle,
      bar: 'bg-red-500',
      description: 'Life-threatening emergency requiring immediate response'
    },
    High: {
      color: 'text-orange-400',
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/50',
      icon: AlertTriangle,
      bar: 'bg-orange-500',
      description: 'Serious emergency requiring rapid response'
    },
    Medium: {
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/50',
      icon: AlertTriangle,
      bar: 'bg-yellow-500',
      description: 'Moderate emergency requiring prompt response'
    },
    Low: {
      color: 'text-green-400',
      bg: 'bg-green-500/20',
      border: 'border-green-500/50',
      icon: CheckCircle2,
      bar: 'bg-green-500',
      description: 'Low severity incident requiring standard response'
    }
  };

  const priorityStyle = priorityConfig[severityLevel];
  const PriorityIcon = priorityStyle.icon;
  const orderedServices = [
    recommendedService,
    ...recommendedServices.filter(service => service !== recommendedService)
  ];
  const dispatchPriority = [
    { label: 'Priority 1', description: 'Dispatch immediately', width: '100%', color: 'bg-red-500' },
    { label: 'Priority 2', description: 'Supporting response', width: '72%', color: 'bg-orange-500' },
    { label: 'Priority 3', description: 'Additional support', width: '45%', color: 'bg-blue-500' }
  ];

  // Mock data
  const nearestUnit = `Unit ${config.unit}`;
  const estimatedArrival = '5-7 minutes';

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white pb-16">
      {/* Success Header */}
      <div className="border-b border-green-500/30 bg-green-950/50 py-5 pl-20 pr-5 sm:pr-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">Alert Sent Successfully</h1>
        </div>
        <p className="text-sm text-green-300/80">Emergency services have been notified</p>
      </div>

      {/* Content */}
      <div className="app-scrollbar flex-1 overflow-y-auto p-5 space-y-4 sm:p-6">
        {/* Emergency Type Card */}
        <div className={`bg-gradient-to-br from-gray-800/80 to-gray-800/40 backdrop-blur-sm border ${config.border} rounded-2xl p-5`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`${config.bg} p-4 rounded-xl`}>
              <ServiceIcon className={`w-8 h-8 ${config.text}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-1">Emergency Type</p>
              <h2 className="text-xl font-bold">{config.name}</h2>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
            <p className="text-sm text-gray-300">{emergencyType}</p>
          </div>

          <div className="mt-4 space-y-2">
            {orderedServices.map((service, index) => {
              const responseConfig = serviceConfig[service];
              const ResponseIcon = responseConfig.icon;
              const dispatch = dispatchPriority[index] ?? dispatchPriority[2];
              return (
                <div
                  key={service}
                  className={`rounded-xl border ${responseConfig.border} ${responseConfig.bg} p-3`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${responseConfig.bg}`}>
                      <ResponseIcon className={`h-5 w-5 ${responseConfig.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{responseConfig.name}</p>
                        <span className="rounded-full bg-gray-950/50 px-2.5 py-1 text-xs font-bold text-white">
                          {dispatch.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">{dispatch.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-950/50">
                    <div className={`h-full rounded-full ${dispatch.color}`} style={{ width: dispatch.width }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Level Card */}
        <div className={`bg-gradient-to-br from-gray-800/80 to-gray-800/40 backdrop-blur-sm border ${priorityStyle.border} rounded-2xl p-5`}>
          <div className="flex items-center gap-4">
            <div className={`${priorityStyle.bg} p-4 rounded-xl`}>
              <PriorityIcon className={`w-8 h-8 ${priorityStyle.color}`} />
            </div>
            <div className="flex-1">
                <p className="text-sm text-gray-400 mb-1">Priority Level</p>
                <div className="flex items-baseline gap-3">
                <h2 className={`text-2xl font-bold ${priorityStyle.color}`}>{severityLevel}</h2>
                <span className="text-sm text-gray-500">Scale: {scaleValue}/10</span>
              </div>
            </div>
          </div>

          {/* Priority Scale Bar */}
          <div className="mt-4">
            <div className="mb-2 grid grid-cols-4 gap-1 text-center text-[10px] text-gray-500 sm:text-xs">
              <span>Low<br />1-3</span>
              <span>Medium<br />4-5</span>
              <span>High<br />6-7</span>
              <span>Critical<br />8-10</span>
            </div>
            <div className="relative h-3 bg-gray-900/50 rounded-full overflow-hidden border border-gray-700/50">
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${scaleValue * 10}%`,
                  background: 'linear-gradient(90deg, #22c55e 0%, #eab308 45%, #f97316 65%, #dc2626 100%)'
                }}
              ></div>
            </div>
            <div className="relative mt-2 h-6">
              <div
                className={`absolute top-0 flex h-6 min-w-7 -translate-x-1/2 items-center justify-center rounded-md px-2 text-xs font-bold text-white ${priorityStyle.bar}`}
                style={{ left: `${scaleMarkerPosition}%` }}
              >
                {scaleValue}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Assessed severity: {priorityStyle.description}
            </p>
          </div>
        </div>

        {detectedIndicators.length > 0 && (
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-800/40 border border-gray-700 rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Assessment Indicators</h3>
            <div className="space-y-2">
              {detectedIndicators.map(indicator => (
                <p key={indicator} className="text-sm text-gray-300">
                  - {indicator}
                </p>
              ))}
            </div>
          </div>
        )}

        {annotatedImage && (
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-800/40 border border-purple-500/40 rounded-2xl p-5">
            <h3 className="font-semibold mb-1">Image Assessment</h3>
            <p className="text-xs text-gray-400 mb-3">Highlighted visual findings from the submitted photo</p>
            <img
              src={annotatedImage}
              alt="Emergency image assessment"
              className="w-full max-h-72 object-contain rounded-xl border border-gray-700 bg-black"
            />
          </div>
        )}

        {/* Nearest Unit Card */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-blue-500/20 p-1.5 rounded">
                  <ServiceIcon className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-xs text-gray-400">Nearest Unit</p>
              </div>
              <p className="font-bold text-lg">{nearestUnit}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-orange-500/20 p-1.5 rounded">
                  <Clock className="w-4 h-4 text-orange-400" />
                </div>
                <p className="text-xs text-gray-400">Estimated Arrival</p>
              </div>
              <p className="font-bold text-lg text-orange-400">{estimatedArrival}</p>
            </div>
          </div>
        </div>

        {/* Location Card */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="bg-green-500/20 p-2 rounded-lg">
              <MapPin className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Your Location</h3>
              <p className="text-sm text-gray-400 font-mono">{location}</p>
              <button
                onClick={openLocationMap}
                className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
              >
                <Navigation className="w-4 h-4" />
                View on map
              </button>
            </div>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-sm text-blue-300">
            <span className="font-semibold">Stay calm and safe.</span> Keep your phone nearby. Emergency services will contact you shortly.
          </p>
        </div>
      </div>

      <div className="mb-16 p-6 border-t border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <button
          onClick={onViewDetails}
          className={`w-full bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-lg`}
        >
          <History className="w-6 h-6" />
          View Report Details
        </button>
      </div>
    </div>
  );
}
