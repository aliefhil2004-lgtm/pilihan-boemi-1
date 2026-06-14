import { useEffect, useState } from 'react';
import { Image as ImageIcon, FileText, MapPin, ScanSearch, Radio } from 'lucide-react';

interface AIProcessingScreenProps {
  photo: string | null;
  description: string;
  isReady: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

export function AIProcessingScreen({ photo, description, isReady, onComplete, onCancel }: AIProcessingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);

  const steps = [
    { icon: ImageIcon, label: 'Analyzing emergency photo', duration: 260 },
    { icon: FileText, label: 'Processing incident description', duration: 220 },
    { icon: ScanSearch, label: 'Calculating severity scale (1-10)', duration: 260 },
    { icon: MapPin, label: 'Determining priority level', duration: 200 },
    { icon: Radio, label: 'Dispatching nearest units', duration: 180 }
  ];

  useEffect(() => {
    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 60);

    // Step progression
    let stepTimeout: ReturnType<typeof setTimeout>;
    let totalDelay = 0;

    steps.forEach((step, index) => {
      stepTimeout = setTimeout(() => {
        setCurrentStep(index);
      }, totalDelay);
      totalDelay += step.duration;
    });

    // Complete after all steps
    const completeTimeout = setTimeout(() => {
      setIsAnimationComplete(true);
    }, totalDelay + 150);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stepTimeout);
      clearTimeout(completeTimeout);
    };
  }, []);

  useEffect(() => {
    if (!isReady || !isAnimationComplete) return;
    onComplete();
  }, [isReady, isAnimationComplete, onComplete]);

  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-white px-6 pb-20 text-[#0b3850]">
      {/* Animated assessment core */}
      <div className="relative mb-8 flex h-[64px] w-[64px] items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-[#e5e7eb]" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#0b3850]" />
        <span className="sr-only">{Math.min(progress, 95)}%</span>
      </div>

      {/* Status Text */}
      <div className="mb-8 text-center">
        <h1 className="mb-6 text-2xl font-extrabold">Sending Alert...</h1>
        <p className="mx-auto max-w-xs text-lg leading-8 text-[#9aa3b1]">
          Establishing secure connection to emergency services. Do not close the app.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="hidden mb-12 w-full max-w-[230px]">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-cyan-400 transition-all duration-300 ease-out"
            style={{ width: `${Math.min(progress, 95)}%` }}
          ></div>
        </div>
      </div>

      {/* Processing Steps */}
      <div className="hidden w-full max-w-md space-y-3">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <div
              key={index}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/50 scale-105'
                  : isCompleted
                  ? 'bg-gray-800/50 border-gray-700 opacity-60'
                  : 'bg-gray-800/30 border-gray-800 opacity-40'
              }`}
            >
              <div
                className={`p-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-blue-500 to-purple-500 animate-pulse'
                    : isCompleted
                    ? 'bg-green-500/20'
                    : 'bg-gray-700'
                }`}
              >
                <StepIcon className={`w-5 h-5 ${isActive ? 'text-white' : isCompleted ? 'text-green-400' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                  {step.label}
                </p>
              </div>
              {isActive && (
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              )}
              {isCompleted && (
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Particle effects */}
      <div className="absolute bottom-28 left-1/2 -translate-x-1/2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-dashed border-[#d21a25] px-6 py-3 text-xs font-bold tracking-[0.18em] text-[#d21a25] transition hover:bg-red-50"
        >
          CANCEL REPORT
        </button>
      </div>
    </div>
  );
}
