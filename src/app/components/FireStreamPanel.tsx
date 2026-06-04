import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Flame, Play, Radio, Square, Video } from 'lucide-react';
import { connectors, webrtc, type WebRTCOutputData } from '@roboflow/inference-sdk';
import { toast } from 'sonner';

const DEFAULT_RTSP_URL = 'rtsp://demo.roboflow.com:8554';

const outputNames = [
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
];

function displayValue(value: unknown) {
  if (value === undefined || value === null || value === '') return 'No data';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

export function FireStreamPanel() {
  const [rtspUrl, setRtspUrl] = useState(DEFAULT_RTSP_URL);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [prediction, setPrediction] = useState<Record<string, unknown> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const connectionRef = useRef<webrtc.RFWebRTCConnection | null>(null);

  const stopStream = async () => {
    await connectionRef.current?.cleanup();
    connectionRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  };

  useEffect(() => {
    return () => {
      void connectionRef.current?.cleanup();
    };
  }, []);

  const startStream = async () => {
    if (!rtspUrl.startsWith('rtsp://') && !rtspUrl.startsWith('rtsps://')) {
      toast.error('RTSP URL must start with rtsp:// or rtsps://');
      return;
    }

    setStatus('connecting');
    setPrediction(null);

    try {
      await connectionRef.current?.cleanup();
      const connection = await webrtc.useRtspStream({
        rtspUrl,
        connector: connectors.withProxyUrl('/api/roboflow-webrtc'),
        wrtcParams: {
          workspaceName: 'aliefs-workspace-bemvh',
          workflowId: 'emergency-severity-analyzer-1778770846609',
          imageInputName: 'image',
          streamOutputNames: ['annotated_image'],
          dataOutputNames: outputNames,
          processingTimeout: 3600,
          requestedPlan: 'webrtc-gpu-medium',
          requestedRegion: 'us'
        },
        onData: (data: WebRTCOutputData) => {
          setPrediction(data.serialized_output_data ?? null);
        }
      });

      connectionRef.current = connection;
      if (videoRef.current) {
        videoRef.current.srcObject = await connection.remoteStream();
        await videoRef.current.play();
      }
      setStatus('live');
      toast.success('Roboflow fire stream connected');
    } catch (error) {
      console.error('ROBOFLOW RTSP ERROR:', error);
      setStatus('error');
      toast.error('Unable to connect to the RTSP fire stream');
    }
  };

  const severity = Number(prediction?.severity_score ?? 0);
  const incidentType = displayValue(prediction?.incident_type);

  return (
    <div className="app-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
          <label htmlFor="rtsp-url" className="mb-2 block text-xs text-gray-400">RTSP stream URL</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="rtsp-url"
              value={rtspUrl}
              onChange={event => setRtspUrl(event.target.value)}
              disabled={status === 'connecting' || status === 'live'}
              className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white disabled:text-gray-500"
            />
            {status === 'live' ? (
              <button onClick={() => void stopStream()} className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold hover:bg-red-500">
                <Square className="h-4 w-4" /> Stop
              </button>
            ) : (
              <button onClick={() => void startStream()} disabled={status === 'connecting'} className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold hover:bg-orange-500 disabled:bg-gray-700">
                <Play className="h-4 w-4" /> {status === 'connecting' ? 'Connecting...' : 'Start Stream'}
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
          <div className="relative aspect-video overflow-hidden rounded-lg border border-gray-700 bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
            {status !== 'live' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 text-gray-500">
                <Video className="mb-3 h-10 w-10" />
                <p className="text-sm font-medium">{status === 'connecting' ? 'Connecting to Roboflow...' : 'Stream is offline'}</p>
              </div>
            )}
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md bg-black/70 px-2.5 py-1.5 text-xs">
              <Radio className={`h-3.5 w-3.5 ${status === 'live' ? 'animate-pulse text-red-400' : 'text-gray-500'}`} />
              {status === 'live' ? 'LIVE AI' : status.toUpperCase()}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
              <p className="text-xs text-gray-400">Detected incident</p>
              <div className="mt-2 flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-400" />
                <p className="font-semibold">{incidentType}</p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Severity</p>
                <p className={`text-xl font-bold ${severity >= 8 ? 'text-red-400' : severity >= 5 ? 'text-orange-400' : 'text-green-400'}`}>
                  {severity || 0}/10
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-950">
                <div className="h-full bg-gradient-to-r from-green-500 via-orange-500 to-red-600" style={{ width: `${Math.min(100, severity * 10)}%` }} />
              </div>
            </div>
            <div className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-orange-300">
                <AlertTriangle className="h-4 w-4" /> Emergency clues
              </p>
              <p className="break-words text-xs text-gray-300">{displayValue(prediction?.emergency_clues)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['Fire predictions', prediction?.fire_predictions],
            ['Recommended units', prediction?.recommended_units],
            ['Reasoning', prediction?.reasoning]
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
              <p className="mb-2 text-xs font-semibold text-gray-400">{label as string}</p>
              <p className="break-words text-xs text-gray-300">{displayValue(value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
