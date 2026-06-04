import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { LoginScreen } from './components/LoginScreen';
import { RegisterScreen } from './components/RegisterScreen';
import { HomeScreen } from './components/HomeScreen';
import { EmergencyReportScreen } from './components/EmergencyReportScreen';
import { AIProcessingScreen } from './components/AIProcessingScreen';
import { EmergencyResultScreen } from './components/EmergencyResultScreen';
import { LiveTrackingScreen } from './components/LiveTrackingScreen';
import { EmergencyServiceDashboard } from './components/EmergencyServiceDashboard';
import { FireMapScreen } from './components/FireMapScreen';
import { ReportHistoryScreen } from './components/ReportHistoryScreen';
import { ChatScreen } from './components/ChatScreen';
import { Navigation } from './components/Navigation';
import { LocationPicker } from './components/LocationPicker';
import { ArrowLeft, LogOut, Flame } from 'lucide-react';
import { analyzeEmergency } from './services/ai';
import { createServiceStatuses, getReportServices, type ServiceType, type StoredEmergencyReport } from './types/emergency';
import { cleanupExpiredReports, resetPreviousHistoryOnce, saveReport } from './services/reportStorage';

type Screen = 'login' | 'register' | 'home' | 'report' | 'processing' | 'result' | 'tracking' | 'service-dashboard' | 'fire-map' | 'history' | 'chat';
type UserRole = 'civilian' | 'service' | null;

function getPortalRole(): Exclude<UserRole, null> {
  if (typeof window === 'undefined') return 'civilian';

  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const firstSubdomain = hostname.split('.')[0];
  const isServicePortal =
    ['service', 'services', 'responder', 'responders', 'admin'].includes(firstSubdomain) ||
    pathname.startsWith('/service') ||
    pathname.startsWith('/responder');

  return isServicePortal ? 'service' : 'civilian';
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  serviceType?: 'ambulance' | 'fire' | 'police';
  credentialPhoto?: string;
}

interface EmergencyData {
  id?: string;
  photo: string | null;
  description: string;
  location: string;
  injuryScale?: number;
  priority?: 'Critical' | 'Medium' | 'Low';
  emergencyType?: string;
  detectedIndicators?: string[];
  services?: ServiceType[];
  annotatedImage?: string;
}

interface UserLocation {
  address: string;
  coords: { lat: number; lng: number };
}

export default function App() {
  const portalRole = getPortalRole();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [selectedService, setSelectedService] = useState<ServiceType>('ambulance');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [chatReportId, setChatReportId] = useState<string | null>(null);
  const [chatReturnScreen, setChatReturnScreen] = useState<Screen>('history');
  const [userLocation, setUserLocation] = useState<UserLocation>({
    address: 'Jakarta, DKI Jakarta, Indonesia',
    coords: { lat: -6.2088, lng: 106.8456 }
  });
  const [emergencyData, setEmergencyData] = useState<EmergencyData>({
    photo: null,
    description: '',
    location: ''
  });

  useEffect(() => {
    resetPreviousHistoryOnce();
    cleanupExpiredReports();
    const cleanupInterval = setInterval(cleanupExpiredReports, 60 * 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  const handleLogin = (role: UserRole, credentials: { email: string; password: string }) => {
    setUserRole(role);
    setCurrentScreen('home');
  };

  const handleRegister = (role: UserRole, data: RegisterData) => {
    // In production, this would send to backend for verification
    // For demo, we'll auto-approve and login
    setUserRole(role);
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentScreen('login');
  };

  const handleLocationChange = (location: string, coords: { lat: number; lng: number }) => {
    setUserLocation({ address: location, coords });
  };

  const handleBack = () => {
    if (currentScreen === 'report') {
      setCurrentScreen('home');
    } else if (currentScreen === 'result') {
      setCurrentScreen('home');
    } else if (currentScreen === 'tracking') {
      setCurrentScreen('result');
    } else if (currentScreen === 'service-dashboard' || currentScreen === 'fire-map') {
      setCurrentScreen('home');
    } else if (currentScreen === 'history') {
      setCurrentScreen('home');
    } else if (currentScreen === 'chat') {
      setCurrentScreen(chatReturnScreen);
    }
  };

  const handleEmergencyStart = () => {
    setCurrentScreen('report');
  };

  const handleServiceSelect = (service: ServiceType) => {
    // Only allow emergency service role to access dashboards
    if (userRole !== 'service') {
      return;
    }
    setSelectedService(service);
    setCurrentScreen('service-dashboard');
  };

const handleReportSubmit = async (data: {
  photo: string | null;
  description: string;
  location: string;
}) => {
  const aiResult = await analyzeEmergency(data.description, data.photo);
  const severityScore =
    'severityScore' in aiResult && typeof aiResult.severityScore === 'number'
      ? aiResult.severityScore
      : aiResult.severity === 'Critical'
      ? 9
      : aiResult.severity === 'High'
      ? 7
      : 5;
  const detectedIndicators =
    'indicators' in aiResult && Array.isArray(aiResult.indicators)
      ? aiResult.indicators
      : [];
  const requiredServices =
    'services' in aiResult && Array.isArray(aiResult.services) && aiResult.services.length
      ? aiResult.services
      : [aiResult.service];
  const reportId = Date.now().toString();
  setSelectedService(aiResult.service);

  const reportData: EmergencyData = {
    ...data,
    injuryScale: severityScore,
    priority:
      aiResult.severity === 'Critical'
        ? 'Critical'
        : aiResult.severity === 'High' || aiResult.severity === 'Medium'
        ? 'Medium'
        : 'Low',
    emergencyType: aiResult.type,
    detectedIndicators,
    annotatedImage: aiResult.annotatedImage
    ,id: reportId,
    services: requiredServices
  };

  setEmergencyData(reportData);

const newReport: StoredEmergencyReport = {
  id: reportId,
  photo: data.photo,
  description: data.description,
  location: data.location,
  service: aiResult.service,
  services: requiredServices,
  serviceStatuses: createServiceStatuses(requiredServices),
  severity:
    aiResult.severity === 'Critical'
      ? 'critical'
      : aiResult.severity === 'High'
      ? 'severe'
      : aiResult.severity === 'Medium'
      ? 'moderate'
      : 'minor',
  injuryScale: severityScore,
  detectedIndicators,
  timestamp: new Date(),
  status: 'pending'
};

saveReport(newReport);

  console.log('REPORT SAVED:', reportData);
  setCurrentScreen('processing');
};
const handleProcessingComplete = () => {
  setCurrentScreen('result');
};

const handleStartTracking = () => {
  setCurrentScreen('tracking');
};

const handleOpenChat = (reportId: string, returnScreen: Screen = currentScreen) => {
  setChatReportId(reportId);
  setChatReturnScreen(returnScreen);
  setCurrentScreen('chat');
};

const handleTrackReport = (report: StoredEmergencyReport) => {
  const services = getReportServices(report);
  setSelectedService(services[0]);
  setEmergencyData({
    id: report.id,
    photo: report.photo,
    description: report.description,
    location: report.location,
    injuryScale: report.injuryScale,
    emergencyType: report.emergencyType,
    detectedIndicators: report.detectedIndicators,
    services
  });
  setCurrentScreen('tracking');
};

const handleNavigate = (screen: 'home' | 'report' | 'history') => {
  if (
    screen === 'home' ||
    screen === 'report' ||
    screen === 'history'
  ) {
    setCurrentScreen(screen);
  }
};


  const showBackButton = currentScreen !== 'home' && currentScreen !== 'processing' && currentScreen !== 'service-dashboard' && currentScreen !== 'fire-map' && currentScreen !== 'chat' && currentScreen !== 'login' && currentScreen !== 'register';
  const showNavigation =
  userRole === 'civilian' &&
  currentScreen !== 'service-dashboard' &&
  currentScreen !== 'fire-map' &&
  currentScreen !== 'processing' &&
  currentScreen !== 'result';
  
  // Show login or register screen if not logged in
  if (!userRole) {
    return (
      <div className={`app-shell flex flex-col ${portalRole === 'service' ? 'app-shell-service' : 'app-shell-civilian'}`}>
        <Toaster position="top-center" richColors />
        {currentScreen === 'register' ? (
          <RegisterScreen
            onRegister={handleRegister}
            onBackToLogin={() => setCurrentScreen('login')}
            forcedRole={portalRole}
          />
        ) : (
          <LoginScreen
            onLogin={handleLogin}
            onGoToRegister={() => setCurrentScreen('register')}
            forcedRole={portalRole}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`app-shell flex flex-col ${userRole === 'service' ? 'app-shell-service' : 'app-shell-civilian'}`}>
      <Toaster position="top-center" richColors />

      {/* Top Actions */}
      {(currentScreen === 'home' || currentScreen === 'service-dashboard') && (
        <div className="absolute right-4 top-4 z-50 flex items-center gap-2 sm:right-6 sm:top-5">
          {/* Fire Map Button - Only for Service role */}
          {userRole === 'service' && (
            <button
              onClick={() => setCurrentScreen('fire-map')}
              className="flex h-10 items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/15 px-3 text-orange-300 shadow-lg backdrop-blur-sm transition hover:bg-orange-500/25"
              aria-label="Open fire map"
            >
              <Flame className="w-4 h-4" />
              <span className="hidden text-sm sm:inline">Fire Map</span>
            </button>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex h-10 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/90 px-3 text-white shadow-lg backdrop-blur-sm transition hover:bg-gray-700"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden text-sm sm:inline">Logout</span>
          </button>
        </div>
      )}

      {showBackButton && (
        <button
          onClick={handleBack}
          className="absolute left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/90 text-white shadow-lg backdrop-blur-sm transition hover:bg-gray-700 sm:left-6 sm:top-5"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {currentScreen === 'home' && userRole && (
        <HomeScreen
          onEmergencyStart={handleEmergencyStart}
          onServiceSelect={handleServiceSelect}
          currentLocation={userLocation.address}
          onChangeLocation={() => setShowLocationPicker(true)}
          userRole={userRole}
        />
      )}

      {currentScreen === 'report' && (
        <EmergencyReportScreen
          onSubmit={handleReportSubmit}
          defaultLocation={userLocation.address}
        />
      )}

      {currentScreen === 'processing' && (
        <AIProcessingScreen
          photo={emergencyData.photo}
          description={emergencyData.description}
          onComplete={handleProcessingComplete}
        />
      )}

      {currentScreen === 'result' && (
        <EmergencyResultScreen
          emergencyType={emergencyData.emergencyType || 'Emergency situation'}
          priority={emergencyData.priority || 'Medium'}
          recommendedService={selectedService}
          recommendedServices={emergencyData.services ?? [selectedService]}
          injuryScale={emergencyData.injuryScale || 5}
          location={emergencyData.location}
          detectedIndicators={emergencyData.detectedIndicators}
          annotatedImage={emergencyData.annotatedImage}
          onStartTracking={handleStartTracking}
          onOpenChat={() => emergencyData.id && handleOpenChat(emergencyData.id, 'result')}
        />
      )}

      {currentScreen === 'tracking' && (
        <LiveTrackingScreen
  serviceTypes={emergencyData.services ?? [selectedService]}
  userLocation={userLocation.coords}
  onOpenChat={() => emergencyData.id && handleOpenChat(emergencyData.id, 'tracking')}
  onBack={() => setCurrentScreen('result')}
/>
      )}

      {currentScreen === 'service-dashboard' && (
        <EmergencyServiceDashboard serviceType={selectedService} onOpenChat={reportId => handleOpenChat(reportId, 'service-dashboard')} />
      )}

      {currentScreen === 'fire-map' && (
        <FireMapScreen userLocation={userLocation.coords} onBack={() => setCurrentScreen('home')} />
      )}

      {currentScreen === 'history' && (
        <ReportHistoryScreen
          onOpenChat={reportId => handleOpenChat(reportId, 'history')}
          onTrack={handleTrackReport}
        />
      )}

      {currentScreen === 'chat' && chatReportId && (
        <ChatScreen
          reportId={chatReportId}
          userRole={userRole}
          serviceType={userRole === 'service' ? selectedService : undefined}
          onBack={() => setCurrentScreen(chatReturnScreen)}
        />
      )}

      {showNavigation && (
        <Navigation
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
        />
      )}

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <LocationPicker
          currentLocation={userLocation.address}
          onLocationChange={handleLocationChange}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </div>
  );
}
