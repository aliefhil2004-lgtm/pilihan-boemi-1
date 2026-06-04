import { Ambulance, Flame, Shield, MapPin, AlertCircle, Edit, Radio, ArrowRight, PhoneCall } from 'lucide-react';

interface HomeScreenProps {
  onEmergencyStart: () => void;
  onServiceSelect: (service: 'ambulance' | 'fire' | 'police') => void;
  currentLocation: string;
  onChangeLocation: () => void;
  userRole: 'civilian' | 'service';
}

export function HomeScreen({ onEmergencyStart, onServiceSelect, currentLocation, onChangeLocation, userRole }: HomeScreenProps) {
  const services = [
    { id: 'ambulance' as const, name: 'Medical Command', detail: 'Ambulance and medical response', icon: Ambulance, color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'hover:border-blue-500/60' },
    { id: 'fire' as const, name: 'Fire & Rescue', detail: 'Fire, rescue, and evacuation', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'hover:border-orange-500/60' },
    { id: 'police' as const, name: 'Police Command', detail: 'Security and public safety', icon: Shield, color: 'text-indigo-400', bg: 'bg-indigo-500/15', border: 'hover:border-indigo-500/60' }
  ];

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-gray-900 to-gray-950 pb-20 text-white">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-800/80 px-5 pb-4 pr-24 pt-6 sm:px-6 sm:pr-56">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-red-400">EmergencyConnect</p>
          <h1 className="text-2xl font-bold">{userRole === 'service' ? 'Response Center' : 'Need emergency help?'}</h1>
          <p className="mt-1 text-sm text-gray-400">
            {userRole === 'service' ? 'Select a command dashboard to continue' : 'Send your location and incident details'}
          </p>
        </div>
      </div>

      {/* Location Status */}
      <div className="mx-5 mt-5 rounded-lg border border-gray-700/80 bg-gray-800/60 p-4 sm:mx-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-500/15 p-2">
            <MapPin className="w-5 h-5 text-green-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400">{userRole === 'service' ? 'Command location' : 'Current location'}</p>
            <p className="truncate text-sm font-medium">{currentLocation}</p>
          </div>
          <button
            onClick={onChangeLocation}
            className="rounded-lg bg-gray-700/80 p-2 transition hover:bg-gray-700"
            aria-label="Change location"
          >
            <Edit className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      {userRole === 'civilian' ? (
        <div className="flex flex-1 flex-col justify-center px-5 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-sm text-center">
            <div className="relative mx-auto mb-7 flex h-64 w-64 items-center justify-center">
              <div className="absolute h-64 w-64 rounded-full border border-red-500/15 bg-red-500/5" />
              <div className="absolute h-56 w-56 rounded-full border border-red-500/25 bg-red-500/5" />
              <button
                onClick={onEmergencyStart}
                className="relative flex h-48 w-48 flex-col items-center justify-center rounded-full border-4 border-red-400/40 bg-red-600 text-white shadow-2xl shadow-red-950/70 transition hover:bg-red-500 active:scale-95"
              >
                <AlertCircle className="mb-2 h-14 w-14" />
                <span className="text-xl font-bold">Request Help</span>
                <span className="mt-1 text-xs text-red-100">Tap to start report</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-left">
                <p className="text-xs text-gray-500">National hotline</p>
                <p className="mt-1 flex items-center gap-2 font-semibold text-red-300"><PhoneCall className="h-4 w-4" />112</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-left">
                <p className="text-xs text-gray-500">Report status</p>
                <p className="mt-1 flex items-center gap-2 font-semibold text-green-300"><Radio className="h-4 w-4" />Ready</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="app-scrollbar flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-semibold">Command dashboards</h2>
                <p className="mt-1 text-sm text-gray-400">Open the dashboard for your assigned unit.</p>
              </div>
              <p className="hidden text-xs text-gray-500 sm:block">Emergency hotline 112</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {services.map(service => {
                const Icon = service.icon;
                return (
                  <button
                    key={service.id}
                    onClick={() => onServiceSelect(service.id)}
                    className={`group flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-800/60 p-5 text-left transition hover:bg-gray-800 ${service.border}`}
                  >
                    <div className={`rounded-lg p-3 ${service.bg}`}>
                      <Icon className={`h-7 w-7 ${service.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{service.name}</p>
                      <p className="mt-1 text-xs text-gray-400">{service.detail}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-600 transition group-hover:translate-x-0.5 group-hover:text-gray-300" />
                  </button>
                );
              })}
            </div>
            <div className="mt-5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-sm font-semibold text-blue-200">Operations status</p>
              <p className="mt-1 text-xs text-gray-400">All command channels are available and ready to receive reports.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
