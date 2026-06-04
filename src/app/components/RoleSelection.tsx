import { Ambulance, Flame, Shield, AlertCircle } from 'lucide-react';

interface RoleSelectionProps {
  onSelectRole: (role: 'civilian' | 'ambulance' | 'fire' | 'police') => void;
}

export function RoleSelection({ onSelectRole }: RoleSelectionProps) {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-red-600 to-red-700">
      {/* Header */}
      <div className="text-white p-6 pt-12 text-center">
        <AlertCircle className="w-20 h-20 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Emergency Response</h1>
        <p className="text-red-100">Fast. Reliable. Life-saving.</p>
      </div>

      {/* Role Cards */}
      <div className="flex-1 p-6 space-y-4">
        {/* Civilian Card */}
        <button
          onClick={() => onSelectRole('civilian')}
          className="w-full bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition transform hover:scale-105 active:scale-95"
        >
          <div className="flex items-center gap-4">
            <div className="bg-red-100 p-4 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-left flex-1">
              <h2 className="text-xl font-bold text-gray-900">I Need Help</h2>
              <p className="text-sm text-gray-600">Report an emergency</p>
            </div>
            <div className="text-2xl text-gray-300">→</div>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-red-300"></div>
          <span className="text-red-100 text-sm font-medium">Emergency Services</span>
          <div className="flex-1 h-px bg-red-300"></div>
        </div>

        {/* Emergency Services Cards */}
        <div className="space-y-3">
          <button
            onClick={() => onSelectRole('ambulance')}
            className="w-full bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition transform hover:scale-102 active:scale-98 flex items-center gap-4"
          >
            <div className="bg-blue-100 p-3 rounded-full">
              <Ambulance className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-bold text-gray-900">Ambulance</h3>
              <p className="text-xs text-gray-500">Medical emergencies</p>
            </div>
            <div className="text-xl text-gray-300">→</div>
          </button>

          <button
            onClick={() => onSelectRole('fire')}
            className="w-full bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition transform hover:scale-102 active:scale-98 flex items-center gap-4"
          >
            <div className="bg-red-100 p-3 rounded-full">
              <Flame className="w-6 h-6 text-red-600" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-bold text-gray-900">Fire Department</h3>
              <p className="text-xs text-gray-500">Fire & rescue</p>
            </div>
            <div className="text-xl text-gray-300">→</div>
          </button>

          <button
            onClick={() => onSelectRole('police')}
            className="w-full bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition transform hover:scale-102 active:scale-98 flex items-center gap-4"
          >
            <div className="bg-indigo-100 p-3 rounded-full">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-bold text-gray-900">Police</h3>
              <p className="text-xs text-gray-500">Security & law enforcement</p>
            </div>
            <div className="text-xl text-gray-300">→</div>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-red-100 p-6 text-xs">
        <p>Emergency hotline: 911</p>
        <p className="mt-1 opacity-75">For life-threatening situations, call immediately</p>
      </div>
    </div>
  );
}
