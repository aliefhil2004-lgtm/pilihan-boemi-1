import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, RotateCw, Send, Upload, ScanSearch, X } from 'lucide-react';
import { toast } from 'sonner';
import { reverseGeocode } from '../services/geocoding';
import { t, type Language } from '../i18n';
import { analyzeEmergencyImage } from '../roboflow';
import type { EvidenceMetadata } from '../types/emergency';
import { anonymizePhotoPixels, detectPrivacyRegionsFromPhoto } from '../services/privacyDetector';
import { formatSeverityScore } from '../utils/severity';

interface EmergencyReportScreenProps {
  onSubmit: (data: {
    photo: string | null;
    description: string;
    location: string;
    coords?: { lat: number; lng: number };
    evidenceMetadata?: EvidenceMetadata;
  }) => void;
  onBack?: () => void;
  defaultLocation?: string;
  defaultCoords?: { lat: number; lng: number };
  language: Language;
}

interface LiveCameraDetection {
  incidentType: string;
  severityScore: number;
  description?: string;
}

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

function extractLiveCameraDetection(value: unknown): LiveCameraDetection | null {
  if (!value || typeof value !== 'object') return null;
  const output = (value as {
    outputs?: Array<{
      incident_type?: unknown;
      severity_score?: unknown;
      description?: unknown;
    }>;
  }).outputs?.[0];

  if (!output || typeof output.incident_type !== 'string') return null;
  if (output.incident_type.toLowerCase() === 'none') return null;

  return {
    incidentType: output.incident_type,
    severityScore: typeof output.severity_score === 'number' ? output.severity_score : 0,
    description: typeof output.description === 'string' ? output.description : undefined
  };
}

function fingerprintPhoto(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 97) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `img-${(hash >>> 0).toString(16)}-${value.length}`;
}

function preparePhotoForAnalysis(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
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
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.82),
          width: canvas.width,
          height: canvas.height
        });
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function EmergencyReportScreen({ onSubmit, onBack, defaultLocation, defaultCoords, language }: EmergencyReportScreenProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(defaultLocation || '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>(defaultCoords);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | undefined>();
  const [evidenceMetadata, setEvidenceMetadata] = useState<EvidenceMetadata | undefined>();
  const [isLocating, setIsLocating] = useState(!defaultLocation);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [liveDetection, setLiveDetection] = useState<LiveCameraDetection | null>(null);
  const [isLiveAnalyzing, setIsLiveAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const liveAnalysisBusyRef = useRef(false);
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);

  useEffect(() => {
    // Refresh coordinates and accuracy even when a default address is already available.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const nextCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCoords(nextCoords);
          setGpsAccuracyMeters(position.coords.accuracy);
          if (!defaultLocation) setLocation(await reverseGeocode(nextCoords.lat, nextCoords.lng));
          setIsLocating(false);
          if (!defaultLocation) toast.success(tr('report.locationDetected'));
        },
        () => {
          if (!defaultLocation) setLocation(tr('report.locationUnavailable'));
          setIsLocating(false);
        }
      );
    }
  }, [defaultLocation]);

  useEffect(() => {
    return () => cameraStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (!isCameraOpen || !videoRef.current || !cameraStreamRef.current) return;
    const video = videoRef.current;
    video.srcObject = cameraStreamRef.current;
    void video.play().catch(() => undefined);
  }, [isCameraOpen]);

  useEffect(() => {
    if (!isCameraOpen) return undefined;

    const analyzeCurrentFrame = async () => {
      const video = videoRef.current;
      if (liveAnalysisBusyRef.current || !video?.videoWidth || !video.videoHeight) return;

      liveAnalysisBusyRef.current = true;
      setIsLiveAnalyzing(true);
      try {
        const canvas = document.createElement('canvas');
        const maxDimension = 640;
        const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL('image/jpeg', 0.82);
        const privacyRegions = await detectPrivacyRegionsFromPhoto(frame);
        const anonymizedFrame = await anonymizePhotoPixels(frame, privacyRegions);
        const result = await analyzeEmergencyImage(anonymizedFrame, description);
        setLiveDetection(extractLiveCameraDetection(result));
      } catch {
        setLiveDetection(null);
      } finally {
        liveAnalysisBusyRef.current = false;
        setIsLiveAnalyzing(false);
      }
    };

    const firstRun = window.setTimeout(analyzeCurrentFrame, 900);
    const interval = window.setInterval(analyzeCurrentFrame, 3000);
    return () => {
      window.clearTimeout(firstRun);
      window.clearInterval(interval);
    };
  }, [isCameraOpen]);

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOpen(false);
    setLiveDetection(null);
    setIsLiveAnalyzing(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(tr('report.cameraUnsupported'));
      fileInputRef.current?.click();
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
    } catch {
      toast.error(tr('report.cameraFailed'));
      fileInputRef.current?.click();
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    setPhoto(dataUrl);
    setEvidenceMetadata({
      source: 'camera',
      capturedAt: new Date().toISOString(),
      mimeType: 'image/jpeg',
      sizeBytes: Math.round(dataUrl.length * 0.75),
      width: canvas.width,
      height: canvas.height,
      gpsAccuracyMeters,
      fingerprint: fingerprintPhoto(dataUrl)
    });
    closeCamera();
    toast.success(tr('report.photoCaptured'));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (file) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast.error('Please upload a JPG, JPEG, PNG, WEBP, GIF, HEIC, or HEIF image.');
        return;
      }

      try {
        const prepared = await preparePhotoForAnalysis(file);
        setPhoto(prepared.dataUrl);
        setEvidenceMetadata({
          source: 'upload',
          fileLastModifiedAt: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
          mimeType: file.type,
          sizeBytes: file.size,
          width: prepared.width,
          height: prepared.height,
          gpsAccuracyMeters,
          fingerprint: fingerprintPhoto(prepared.dataUrl)
        });
        toast.success(tr('report.photoUploaded'));
      } catch {
        toast.error(tr('report.photoFailed'));
      }
    }
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    const trimmedDescription = description.trim();

    if (!photo && !trimmedDescription) {
      toast.error(tr('report.needPhotoOrDescription'));
      return;
    }

    setIsSubmitting(true);
    Promise.resolve(
      onSubmit({
        photo,
        description: trimmedDescription || tr('report.defaultDescription'),
        location,
        coords,
        evidenceMetadata: evidenceMetadata
          ? { ...evidenceMetadata, gpsAccuracyMeters: evidenceMetadata.gpsAccuracyMeters ?? gpsAccuracyMeters }
          : undefined
      })
    ).catch(() => {
      setIsSubmitting(false);
    });
  };

  return (
    <div className="flex h-full flex-col bg-white text-[#0b3850]">
      <div className="flex h-[88px] shrink-0 items-center bg-white px-7 pt-[36px] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <button
          type="button"
          onClick={onBack}
          className="mr-4 flex h-7 w-7 items-center justify-center rounded-lg text-[#0b3850] transition hover:bg-slate-100"
          aria-label="Back"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <h1 className="text-[17px] font-extrabold leading-6">{tr('report.title')}</h1>
      </div>

      <div className="app-scrollbar flex-1 space-y-4 overflow-y-auto px-[26px] pb-24 pt-5">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-extrabold leading-6">{tr('report.locationTitle')}</h3>
            {isLocating && (
              <div className="flex items-center gap-2 text-xs text-[#6da5c4]">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[#6da5c4]"></div>
                {tr('report.locating')}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#d7dbe0] bg-[#fafbfc] px-5 py-3">
            <p className="truncate text-[13px] text-[#0b3850]">
              {location || tr('report.detectingLocation')}
            </p>
          </div>

          <button
            onClick={() => {
              if (navigator.geolocation) {
                setIsLocating(true);
                navigator.geolocation.getCurrentPosition(
                  async (position) => {
                    const nextCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
                    setCoords(nextCoords);
                    setLocation(await reverseGeocode(nextCoords.lat, nextCoords.lng, location || 'Current GPS location'));
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
            className="mt-3 flex h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-[#6da5c4] px-5 text-[14px] font-bold text-white transition hover:bg-[#5d99b8]"
          >
            <RotateCw className="h-[18px] w-[18px]" />
            {tr('report.refreshLocation')}
          </button>
        </div>

        <div>
          <h3 className="mb-3 text-[14px] font-extrabold leading-6">Photo</h3>

          {photo ? (
            <div className="relative group">
              <img
                src={photo}
                alt="Emergency"
                className="h-[140px] w-full rounded-xl border border-[#d7dbe0] object-cover"
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
              <div className="relative overflow-hidden rounded-xl border border-[#d7dbe0] bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="h-[180px] w-full object-cover" />
                <div className="absolute left-3 top-3 max-w-[calc(100%-4.5rem)] rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-sm">
                  <p className="font-semibold text-blue-200">{tr('report.liveAnalysisTitle')}</p>
                  {liveDetection ? (
                    <div className="mt-1 space-y-0.5">
                      <p>
                        {tr('report.liveDetected')}: <span className="font-semibold text-green-300">{liveDetection.incidentType}</span>
                      </p>
                      <p>
                        {tr('report.liveSeverity')}: <span className="font-semibold text-yellow-300">{formatSeverityScore(liveDetection.severityScore)}/10</span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-gray-300">
                      {isLiveAnalyzing ? tr('report.liveAnalyzing') : tr('report.liveNoDetection')}
                    </p>
                  )}
                </div>
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
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-[#6da5c4] text-[14px] font-semibold text-white transition hover:bg-[#5d99b8]"
              >
                <Camera className="h-4 w-4" />
                {tr('report.takePhoto')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={openCamera}
                className="flex h-[140px] w-full flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-[#d7dbe0] bg-[#fafbfc] text-[#9aa3b1] transition hover:border-[#6da5c4]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                  <Camera className="h-5 w-5" />
                </span>
                Take a Photo
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-[#6da5c4] text-[14px] font-bold text-white transition hover:bg-[#5d99b8]"
              >
                <Upload className="h-4 w-4" />
                {tr('report.uploadPhoto')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={`${ACCEPTED_IMAGE_EXTENSIONS},${ACCEPTED_IMAGE_TYPES.join(',')}`}
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 text-[14px] font-extrabold leading-6">Emergency Describe (Optional)</h3>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr('report.describePlaceholder')}
            className="h-[100px] w-full resize-none rounded-xl border border-[#d7dbe0] bg-[#fafbfc] p-4 text-[13px] text-[#0b3850] placeholder:text-[#9aa3b1] transition focus:border-[#6da5c4] focus:outline-none"
          />

          {description && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
              {tr('report.descriptionReady')}
            </div>
          )}
        </div>

        {/* Assessment Indicator */}
        {(photo || description) && (
          <div className="rounded-lg bg-[#9cc4d8] px-5 py-4 text-white">
            <div className="flex items-start gap-3.5">
              <ScanSearch className="mt-0.5 h-5 w-5 flex-shrink-0 text-white" />
              <div className="flex-1">
                <p className="mb-1 text-[13px] font-bold leading-4 text-white">{tr('report.assessmentReady')}</p>
                <p className="text-[12px] leading-4 text-white">
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

        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          className="group flex h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-[#ff3833] text-[14px] font-bold text-white shadow-lg shadow-red-200 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Send className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
          {isSubmitting ? 'Sending...' : tr('report.submit')}
        </button>
      </div>
    </div>
  );
}
