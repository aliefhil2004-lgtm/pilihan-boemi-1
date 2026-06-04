import { Globe2, X } from 'lucide-react';
import { ASEAN_COUNTRIES, type AseanCountryCode } from '../config/asean';

interface CountryPickerProps {
  currentCountry: AseanCountryCode;
  onSelect: (country: AseanCountryCode) => void;
  onClose: () => void;
}

export function CountryPicker({ currentCountry, onSelect, onClose }: CountryPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/80 backdrop-blur-sm">
      <div className="app-scrollbar max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-gray-700 bg-gray-900 p-5 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe2 className="h-6 w-6 text-blue-400" />
            <div>
              <h2 className="text-xl font-bold">Select ASEAN Country</h2>
              <p className="text-sm text-gray-400">Updates locations and emergency numbers</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-gray-800 p-2 hover:bg-gray-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ASEAN_COUNTRIES.map(country => (
            <button
              key={country.code}
              onClick={() => onSelect(country.code)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                currentCountry === country.code
                  ? 'border-blue-500 bg-blue-500/15'
                  : 'border-gray-700 bg-gray-800/60 hover:border-gray-500'
              }`}
            >
              <span className="text-2xl">{country.flag}</span>
              <div>
                <p className="font-semibold">{country.name}</p>
                <p className="text-xs text-gray-400">{country.center.address}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Medical {country.emergency.ambulance} · Fire {country.emergency.fire} · Police {country.emergency.police}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
