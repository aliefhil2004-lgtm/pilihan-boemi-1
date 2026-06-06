import { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Send, Navigation, FileText, Upload, ScanSearch, X } from 'lucide-react';
import { toast } from 'sonner';
import { reverseGeocode } from '../services/geocoding';
import { t, type Language } from '../i18n';

interface EmergencyReportScreenProps {
  onSubmit: (data: { photo: string | null; description: string; location: string }) => void;
  defaultLocation?: string;
  language: Language;
}

function preparePhotoForAnalysis(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read photo'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Invalid image file'));
      image.onload = () => {
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function EmergencyReportScreen({ onSubmit, defaultLocation, language }: EmergencyReportScreenProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(defaultLocation || '');
  const [isLocating, setIsLocating] = useState(!defaultLocation);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);

  useEffect(() => {
    // Auto-detect location on mount if no default location
    if (!defaultLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setLocation(await reverseGeocode(position.coords.latitude, position.coords.longitude));
          setIsLocating(false);
          toast.success(tr('report.locationDetected'));
        },
        () => {
          setLocation(tr('report.locationUnavailable'));
          setIsLocating(false);
        }
      );
    }
  }, [defaultLocation]);

  useEffect(() => {
    return () => cameraStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOpen(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(tr('report.cameraUnsupported'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      toast.error(tr('report.cameraFailed'));
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      toast.error(tr('report.cameraLoading'));
      return;
    }

    const canvas = document.createElement('canvas');
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL('image/jpeg', 0.82));
    closeCamera();
    toast.success(tr('report.photoCaptured'));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (file) {
      try {
        setPhoto(await preparePhotoForAnalysis(file));
        toast.success(tr('report.photoUploaded'));
      } catch {
        toast.error(tr('report.photoFailed'));
      }
    }
  };

  const handleSubmit = () => {
  if (!photo && !description.trim()) {
    toast.error(tr('report.needPhotoOrDescription'));
    return;
  }

  onSubmit({
    photo,
    description: description || tr('report.defaultDescription'),
    location
  });
};

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-gray-900 via-gray-900 to-black pb-16 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-5 py-5 sm:px-6">
        <h1 className="mb-1 text-2xl font-bold">{tr('report.title')}</h1>
        <p className="text-sm text-gray-400">{tr('report.subtitle')}</p>
      </div>

      {/* Content */}
      <div className="app-scrollbar flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {/* GPS Location Card */}
        <div className="rounded-xl border border-gray-700/80 bg-gray-800/60 p-4 sm:p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="bg-green-500/20 p-2 rounded-lg">
              <MapPin className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{tr('report.locationTitle')}</h3>
              <p className="text-sm text-gray-400">{tr('report.locationSubtitle')}</p>
            </div>
            {isLocating && (
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                {tr('report.locating')}
              </div>
            )}
          </div>

          <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
            <p className="text-sm text-green-300">
              {location || tr('report.detectingLocation')}
            </p>
          </div>

          <button
            onClick={() => {
              if (navigator.geolocation) {
                setIsLocating(true);
                navigator.geolocation.getCurrentPosition(
                  async (position) => {
                    setLocation(await reverseGeocode(position.coords.latitude, position.coords.longitude, location || 'Current GPS location'));
                    setIsLocating(false);
                    toast.success(tr('report.locationUpdated'));
                  },
                  () => {
                    setIsLocating(false);
                    toast.error(tr('report.locationFailed'));
                  }
                );
              }
            }}
            className="mt-3 w-full bg-gray-700/50 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            {tr('report.refreshLocation')}
          </button>
        </div>

        {/* Photo Upload Section */}
        <div className="rounded-xl border border-gray-700/80 bg-gray-800/60 p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-500/20 p-2 rounded-lg">
              <Camera className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold">{tr('report.photoTitle')}</h3>
              <p className="text-xs text-gray-400">{tr('report.photoSubtitle')}</p>
            </div>
          </div>

          {photo ? (
            <div className="relative group">
              <img
                src={photo}
                alt="Emergency"
                className="w-full h-48 object-cover rounded-xl border border-gray-700"
              />
              <button
                onClick={() => setPhoto(null)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white backdrop-blur-sm transition hover:bg-red-600"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : isCameraOpen ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-gray-700 bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="h-56 w-full object-cover" />
                <button
                  type="button"
                  onClick={closeCamera}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white backdrop-blur-sm hover:bg-red-600"
                  aria-label="Close camera"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={takePhoto}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                <Camera className="h-4 w-4" />
                {tr('report.takePhoto')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={openCamera}
                className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                <Camera className="h-4 w-4" />
                {tr('report.openCamera')}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-700 py-3 text-sm font-semibold text-white transition hover:bg-gray-600"
              >
                <Upload className="h-4 w-4" />
                {tr('report.uploadPhoto')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Description Input */}
        <div className="rounded-xl border border-gray-700/80 bg-gray-800/60 p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">{tr('report.describeTitle')}</h3>
              <p className="text-xs text-gray-400">
                {tr('report.describeSubtitle')}
                </p>
            </div>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr('report.describePlaceholder')}
            className="w-full h-32 bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />

          {description && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              {tr('report.descriptionReady')}
            </div>
          )}
        </div>

        {/* Assessment Indicator */}
        {(photo || description) && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <ScanSearch className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-300 mb-1">{tr('report.assessmentReady')}</p>
                <p className="text-xs text-gray-400">
                  {photo && description
                    ? tr('report.assessmentDetailPhotoDescription')
                    : photo
                    ? tr('report.assessmentDetailPhoto')
                    : tr('report.assessmentDetailDescription')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="border-t border-gray-800 bg-gray-950/90 p-4 backdrop-blur-sm">
        <button
          onClick={handleSubmit}
          className="group flex w-full items-center justify-center gap-3 rounded-lg bg-red-600 py-3.5 font-bold text-white shadow-lg transition hover:bg-red-500 disabled:bg-gray-700 disabled:shadow-none"
        >
          <Send className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          {tr('report.submit')}
        </button>
      </div>
    </div>
  );
}
