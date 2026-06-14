import { useState, useEffect } from 'react';
import { MapPin, Search, Navigation, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AseanCountry } from '../config/asean';
import { reverseGeocode } from '../services/geocoding';

interface LocationPickerProps {
  currentLocation: string;
  onLocationChange: (location: string, coords: { lat: number; lng: number }) => void;
  onRefreshLocation: () => void | Promise<void>;
  onClose: () => void;
  country: AseanCountry;
}

export function LocationPicker({ currentLocation, onLocationChange, onRefreshLocation, onClose, country }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCities, setFilteredCities] = useState(country.cities);

  useEffect(() => {
    if (searchQuery) {
      const filtered = country.cities.filter(
        city =>
          city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          city.region.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCities(filtered);
    } else {
      setFilteredCities(country.cities);
    }
  }, [country, searchQuery]);

  const handleCitySelect = (city: AseanCountry['cities'][number]) => {
    onLocationChange(`${city.name}, ${city.region}, ${country.name}`, { lat: city.lat, lng: city.lng });
    toast.success(`Location set to ${city.name}`);
    onClose();
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const address = await reverseGeocode(lat, lng, `Current location in ${country.name}`);
          onLocationChange(address, { lat, lng });
          toast.success('Current location detected');
          onClose();
        },
        () => {
          toast.error('Unable to get current location');
        }
      );
    } else {
      toast.error('Geolocation not supported');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end">
      <div className="w-full bg-gray-900 rounded-t-3xl border-t border-gray-800 max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">Change Location</h2>
            <p className="text-sm text-gray-400">Select or enter your location</p>
          </div>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 p-2 rounded-full transition"
            aria-label="Close location picker"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-800">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search cities in ${country.name}...`}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b border-gray-800">
          <button
            onClick={handleCurrentLocation}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30"
          >
            <Navigation className="w-5 h-5 text-white" />
            <span className="font-medium text-white">Use Current GPS Location</span>
          </button>
          <button
            onClick={() => { void onRefreshLocation(); }}
            className="mt-3 w-full rounded-xl border border-blue-500/30 bg-white py-3 px-4 flex items-center justify-center gap-2 text-blue-600 transition hover:bg-blue-50"
          >
            <Navigation className="w-5 h-5" />
            <span className="font-medium">Refresh Location</span>
          </button>
        </div>

        {/* City List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Popular Cities</h3>
          <div className="space-y-2">
            {filteredCities.map((city) => (
              <button
                key={city.name}
                onClick={() => handleCitySelect(city)}
                className="w-full bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-blue-500/50 rounded-xl p-4 flex items-center gap-3 transition group"
              >
                <div className="bg-green-500/20 p-2 rounded-lg group-hover:bg-green-500/30 transition">
                  <MapPin className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-white">{city.name}</p>
                  <p className="text-xs text-gray-400">{city.region}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
