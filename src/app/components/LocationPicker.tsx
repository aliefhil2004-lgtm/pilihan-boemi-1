import { useState, useEffect } from 'react';
import { MapPin, Search, Navigation, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AseanCountry } from '../config/asean';

interface LocationPickerProps {
  currentLocation: string;
  onLocationChange: (location: string, coords: { lat: number; lng: number }) => void;
  onClose: () => void;
  country: AseanCountry;
}

export function LocationPicker({ currentLocation, onLocationChange, onClose, country }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCities, setFilteredCities] = useState(country.cities);
  const [customLat, setCustomLat] = useState('');
  const [customLng, setCustomLng] = useState('');

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

  const handleCustomLocation = () => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);

    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Invalid coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Coordinates are outside the valid global range');
      return;
    }

    onLocationChange(`Custom Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, { lat, lng });
    toast.success('Custom location set');
    onClose();
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          onLocationChange(`GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, { lat, lng });
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
                <div className="text-xs text-gray-500">
                  {city.lat.toFixed(2)}, {city.lng.toFixed(2)}
                </div>
              </button>
            ))}
          </div>

          {/* Custom Coordinates */}
          <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Enter Custom Coordinates</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Latitude</label>
                <input
                  type="number"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                  placeholder="-6.2088"
                  step="0.0001"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Longitude</label>
                <input
                  type="number"
                  value={customLng}
                  onChange={(e) => setCustomLng(e.target.value)}
                  placeholder="106.8456"
                  step="0.0001"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={handleCustomLocation}
              className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg py-2 text-sm font-medium text-white transition"
            >
              Set Custom Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
