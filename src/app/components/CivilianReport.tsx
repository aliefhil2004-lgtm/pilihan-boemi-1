import { useState } from 'react';
import { Camera, MapPin, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { calculateInjuryScale, getInjuryLabel } from '../utils/injuryScaleCalculator';

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
];

const ACCEPTED_IMAGE_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif';

export function CivilianReport() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<'minor' | 'moderate' | 'severe' | 'critical'>('moderate');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast.error('Please upload a JPG, JPEG, PNG, WEBP, GIF, HEIC, or HEIF image.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
          toast.success('Location captured');
        },
        () => {
          toast.error('Unable to get location');
        }
      );
    }
  };
  const handleSubmit = () => {
    if (!photo && !description.trim()) {
      toast.error('Please add a photo or description');
      return;
    }

    setIsSubmitting(true);

    // Calculate injury scale
    const injuryScale = calculateInjuryScale({
      severity,
      description,
      hasPhoto: !!photo
    });

    const injuryLabel = getInjuryLabel(injuryScale);

    // Mock submission
    setTimeout(() => {
      toast.success(`Emergency report submitted! Priority: ${injuryLabel} (${injuryScale}/10)`);
      setPhoto(null);
      setDescription('');
      setLocation('');
      setSeverity('moderate');
      setIsSubmitting(false);
    }, 1500);
  };

  const severityColors = {
    minor: 'bg-green-500',
    moderate: 'bg-yellow-500',
    severe: 'bg-orange-500',
    critical: 'bg-red-500'
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 text-white p-4 shadow-lg">
        <h1 className="text-xl font-bold">Emergency Report</h1>
        <p className="text-sm opacity-90">Help is on the way</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Photo Upload */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="block text-sm font-semibold mb-2 text-gray-700">
            Emergency Photo *
          </label>
          {photo ? (
            <div className="relative">
              <img src={photo} alt="Emergency" className="w-full h-48 object-cover rounded-lg" />
              <button
                onClick={() => setPhoto(null)}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 shadow-lg"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <Camera className="w-12 h-12 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">Tap to capture or upload</span>
              <input
                type="file"
                accept={`${ACCEPTED_IMAGE_EXTENSIONS},${ACCEPTED_IMAGE_TYPES.join(',')}`}
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="block text-sm font-semibold mb-2 text-gray-700">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the emergency situation..."
            className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Severity Level */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="block text-sm font-semibold mb-3 text-gray-700">
            Injury Severity
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['minor', 'moderate', 'severe', 'critical'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setSeverity(level)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  severity === level
                    ? `${severityColors[level]} text-white border-transparent`
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                <span className="capitalize font-medium">{level}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="block text-sm font-semibold mb-2 text-gray-700">
            Location
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter location or use GPS"
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              onClick={getCurrentLocation}
              className="bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition"
            >
              <MapPin className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Alert Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Your report will be immediately visible to nearby emergency services. Only submit genuine emergencies.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <div className="p-4 bg-white border-t border-gray-200">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-red-600 text-white py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:bg-red-700 disabled:bg-gray-400 transition shadow-lg"
        >
          {isSubmitting ? (
            'Sending...'
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit Emergency Report
            </>
          )}
        </button>
      </div>
    </div>
  );
}
