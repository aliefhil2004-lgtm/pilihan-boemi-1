import { useEffect, useState } from 'react';
import { Sparkles, Image as ImageIcon, FileText, MapPin, Brain, Zap } from 'lucide-react';

interface AIProcessingScreenProps {
  photo: string | null;
  description: string;
  onComplete: () => void;
}

export function AIProcessingScreen({ photo, description, onComplete }: AIProcessingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { icon: ImageIcon, label: 'Analyzing emergency photo', duration: 800 },
    { icon: FileText, label: 'Processing incident description', duration: 700 },
    { icon: Brain, label: 'Calculating severity scale (1-10)', duration: 900 },
    { icon: MapPin, label: 'Determining priority level', duration: 600 },
    { icon: Zap, label: 'Dispatching nearest units', duration: 500 }
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
      onComplete();
    }, totalDelay + 500);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stepTimeout);
      clearTimeout(completeTimeout);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white items-center justify-center p-6 pb-20">
      {/* Animated AI Core */}
      <div className="relative mb-12">
        {/* Outer rotating rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 border-2 border-blue-500/20 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-56 h-56 border-2 border-purple-500/20 rounded-full animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 border-2 border-pink-500/20 rounded-full animate-spin" style={{ animationDuration: '4s' }}></div>
        </div>

        {/* Central AI icon */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-12 rounded-full animate-pulse shadow-2xl shadow-purple-500/50">
            <Brain className="w-20 h-20" />
          </div>
        </div>

        {/* Scanning effect */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse"></div>
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          AI Analysis in Progress
        </h1>
        <p className="text-gray-400">
          Analyzing emergency situation…
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md mb-12">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="text-center mt-2 text-sm text-gray-500">
          {progress}%
        </div>
      </div>

      {/* Processing Steps */}
      <div className="w-full max-w-md space-y-3">
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-blue-400 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}
