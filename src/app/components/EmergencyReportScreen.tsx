import { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Send, Navigation, Image as ImageIcon, Sparkles, Upload, X } from 'lucide-react';
import { connectors, streams, webrtc, type WebRTCOutputData } from '@roboflow/inference-sdk';
import { toast } from 'sonner';

interface EmergencyReportScreenProps {
  onSubmit: (data: { photo: string | null; description: string; location: string }) => void;
  defaultLocation?: string;
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

export function EmergencyReportScreen({ onSubmit, defaultLocation }: EmergencyReportScreenProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(defaultLocation || '');
  const [isLocating, setIsLocating] = useState(!defaultLocation);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [livePrediction, setLivePrediction] = useState<Record<string, unknown> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const liveConnectionRef = useRef<webrtc.RFWebRTCConnection | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-detect location on mount if no default location
    if (!defaultLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
          setIsLocating(false);
          toast.success('Location detected');
        },
        () => {
          setLocation('Location unavailable');
          setIsLocating(false);
        }
      );
    }
  }, [defaultLocation]);

  useEffect(() => {
    return () => {
      void liveConnectionRef.current?.cleanup();
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopLiveCamera = async () => {
    await liveConnectionRef.current?.cleanup();
    liveConnectionRef.current = null;
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsLiveStreaming(false);
    setIsLiveConnecting(false);
    setIsCameraOpen(false);
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOpen(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Camera access is not supported on this device');
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      toast.error('Unable to access camera. Please allow camera permission or upload a photo.');
    }
  };

  const openLiveCamera = async () => {
    setIsLiveConnecting(true);
    setLivePrediction(null);

    try {
      stopCamera();
      const connector = connectors.withProxyUrl('/api/roboflow-webrtc');
      const stream = await streams.useCamera({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);

      const connection = await webrtc.useStream({
        source: stream,
        connector,
        wrtcParams: {
          workspaceName: 'aliefs-workspace-bemvh',
          workflowId: 'emergency-severity-analyzer-1778770846609',
          streamOutputNames: ['annotated_image'],
          dataOutputNames: [
            'incident_type',
            'severity_score',
            'description',
            'raw_response',
            'detections',
            'recommended_units',
            'reasoning',
            'fire_predictions',
            'vehicle_predictions',
            'new_cctv_objects',
            'already_seen_cctv_objects',
            'emergency_clues'
          ],
          processingTimeout: 3600,
          requestedPlan: 'webrtc-gpu-medium',
          requestedRegion: 'us'
        },
        onData: (data: WebRTCOutputData) => {
          setLivePrediction(data.serialized_output_data ?? null);
        }
      });

      liveConnectionRef.current = connection;
      if (videoRef.current) {
        videoRef.current.srcObject = await connection.remoteStream();
      }
      setIsLiveStreaming(true);
      toast.success('Live Roboflow analysis connected');
    } catch (error) {
      console.error('ROBOFLOW LIVE ERROR:', error);
      await stopLiveCamera();
      toast.error('Unable to start live AI camera. Please use photo capture instead.');
    } finally {
      setIsLiveConnecting(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.error('Camera is still loading. Please try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL('image/jpeg', 0.9));
    if (liveConnectionRef.current) {
      void stopLiveCamera();
    } else {
      stopCamera();
    }
    toast.success('Photo captured and ready for AI analysis');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (file) {
      try {
        setPhoto(await preparePhotoForAnalysis(file));
        toast.success('Photo uploaded and ready for AI analysis');
      } catch {
        toast.error('Unable to prepare this photo. Please choose another image.');
      }
    }
  };

  const handleSubmit = () => {
  if (!photo && !description.trim()) {
    toast.error('Please add a photo or description');
    return;
  }

  onSubmit({
    photo,
    description: description || 'Emergency photo report',
    location
  });
};

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white pb-16">
      {/* Header */}
      <div className="border-b border-gray-800 py-5 pl-20 pr-5 sm:pr-6">
        <h1 className="text-2xl font-bold mb-1">Emergency Report</h1>
        <p className="text-sm text-gray-400">Provide details to help us respond faster</p>
      </div>

      {/* Content */}
      <div className="app-scrollbar flex-1 overflow-y-auto p-5 space-y-4 sm:p-6">
        {/* GPS Location Card */}
        <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="bg-green-500/20 p-2 rounded-lg">
              <MapPin className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Auto-detected Location</h3>
              <p className="text-sm text-gray-400">GPS coordinates</p>
            </div>
            {isLocating && (
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                Locating...
              </div>
            )}
          </div>

          <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
            <p className="text-sm font-mono text-green-400">
              {location || 'Detecting location...'}
            </p>
          </div>

          <button
            onClick={() => {
              if (navigator.geolocation) {
                setIsLocating(true);
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
                    setIsLocating(false);
                    toast.success('Location updated');
                  },
                  () => {
                    setIsLocating(false);
                    toast.error('Unable to get location');
                  }
                );
              }
            }}
            className="mt-3 w-full bg-gray-700/50 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            Refresh Location
          </button>
        </div>

        {/* Photo Upload Section */}
        <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-500/20 p-2 rounded-lg">
              <Camera className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold">Emergency Photo</h3>
              <p className="text-xs text-gray-400">Optional but recommended</p>
            </div>
          </div>

          {photo ? (
            <div className="relative group">
              <img
                src={photo}
                alt="Emergency"
                className="w-full h-48 object-cover rounded-xl border border-gray-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition flex items-end p-4">
                <button
                  onClick={() => setPhoto(null)}
                  className="w-full bg-red-500/90 hover:bg-red-500 text-white py-2 rounded-lg font-medium transition"
                >
                  Remove Photo
                </button>
              </div>
            </div>
          ) : isCameraOpen ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-purple-500/50 bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-56 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (liveConnectionRef.current) {
                      void stopLiveCamera();
                    } else {
                      stopCamera();
                    }
                  }}
                  className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition"
                  aria-label="Close camera"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={capturePhoto}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Capture Photo
              </button>
              {(isLiveConnecting || isLiveStreaming) && (
                <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3">
                  <p className="text-xs font-semibold text-blue-300">
                    {isLiveConnecting ? 'Connecting to Roboflow live analysis...' : 'Roboflow live analysis active'}
                  </p>
                  {livePrediction && (
                    <p className="mt-1 text-xs text-gray-300">
                      Latest result: {String(livePrediction.incident_type ?? 'Analyzing frame')}
                      {livePrediction.severity_score !== undefined
                        ? ` - severity ${String(livePrediction.severity_score)}/10`
                        : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-gray-700 rounded-xl">
                <div className="bg-purple-500/10 p-3 rounded-full mb-2">
                  <ImageIcon className="w-7 h-7 text-purple-400" />
                </div>
                <span className="text-sm text-gray-400 font-medium">Add a photo for YOLO analysis</span>
                <span className="text-xs text-gray-500 mt-1">Capture a live frame or choose an existing image</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={openCamera}
                  className="bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Open Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Photo
                </button>
              </div>
              <button
                type="button"
                onClick={openLiveCamera}
                disabled={isLiveConnecting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isLiveConnecting ? 'Connecting Live AI...' : 'Live AI Camera'}
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
        <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">Describe the Emergency</h3>
              <p className="text-xs text-gray-400">
                Optional extra information
                </p>
            </div>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? Be as detailed as possible..."
            className="w-full h-32 bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />

          {description && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              AI emergency detection ready
            </div>
          )}
        </div>

        {/* AI Detection Indicator */}
        {(photo || description) && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-300 mb-1">AI Analysis Ready</p>
                <p className="text-xs text-gray-400">
                  Our AI will analyze your {photo && description ? 'photo and description' : photo ? 'photo' : 'description'} to determine emergency priority and dispatch the right responders.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="border-t border-gray-800 bg-gray-950/90 p-4 backdrop-blur-sm sm:p-5">
        <button
          onClick={handleSubmit}
          className="group flex w-full items-center justify-center gap-3 rounded-lg bg-red-600 py-3.5 font-bold text-white shadow-lg transition hover:bg-red-500 disabled:bg-gray-700 disabled:shadow-none"
        >
          <Send className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          Send Emergency Alert
        </button>
      </div>
    </div>
  );
}
