import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
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
import { ProfileScreen } from './components/ProfileScreen';
import { CallScreen } from './components/CallScreen';
import { IPhoneStatusBar } from './components/IPhoneStatusBar';
import { SplashScreen } from './components/SplashScreen';
import { LocationPicker } from './components/LocationPicker';
import { CountryPicker } from './components/CountryPicker';
import { LanguageToggle } from './components/LanguageToggle';
import { ArrowLeft, Globe2 } from 'lucide-react';
import { analyzeEmergency } from './services/ai';
import { createServiceStatuses, getReportServices, type ServiceType, type StoredEmergencyReport } from './types/emergency';
import { cleanupExpiredReports, deleteReports, resetPreviousHistoryOnce, saveReport } from './services/reportStorage';
import { startReportSync } from './services/firebaseSync';
import {
  getFriendlyAuthError,
  getUserProfile,
  listenToCitizenSession,
  loginCitizenAccount,
  loginServiceAccount,
  logoutFirebaseAccount,
  registerCitizenAccount,
  type UserProfile
} from './services/auth';
import { getAseanCountry, type AseanCountryCode } from './config/asean';
import { getServiceContactNumber } from './config/contacts';
import { t as translate, type Language } from './i18n';
import type { PrivacyRegion } from './types/emergency';

type Screen = 'login' | 'register' | 'home' | 'report' | 'processing' | 'result' | 'tracking' | 'service-dashboard' | 'fire-map' | 'history' | 'chat' | 'profile' | 'call';
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
  identityType: 'national-id' | 'passport';
  identityNumber: string;
  serviceType?: 'ambulance' | 'fire' | 'police';
  credentialPhoto?: string;
}

interface EmergencyData {
  id?: string;
  photo: string | null;
  description: string;
  location: string;
  coords?: { lat: number; lng: number };
  injuryScale?: number;
  priority?: 'Critical' | 'Medium' | 'Low';
  emergencyType?: string;
  detectedIndicators?: string[];
  services?: ServiceType[];
  annotatedImage?: string;
  privacyRegions?: PrivacyRegion[];
}

interface UserLocation {
  address: string;
  coords: { lat: number; lng: number };
}

function detectCurrentLocation(countryName: string): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const { reverseGeocode } = await import('./services/geocoding');
        const address = await reverseGeocode(lat, lng, `Current location in ${countryName}`);
        resolve({ address, coords: { lat, lng } });
      },
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export default function App() {
  const portalRole = getPortalRole();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [showSplash, setShowSplash] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceType>(() =>
    (localStorage.getItem('serviceType') as ServiceType) || 'ambulance'
  );
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [language, setLanguage] = useState<Language>(() =>
    (localStorage.getItem('appLanguage') as Language) || 'en'
  );
  const [countryCode, setCountryCode] = useState<AseanCountryCode>(() =>
    (localStorage.getItem('aseanCountry') as AseanCountryCode) || 'ID'
  );
  const [chatReportId, setChatReportId] = useState<string | null>(null);
  const [chatReturnScreen, setChatReturnScreen] = useState<Screen>('history');
  const [callReturnScreen, setCallReturnScreen] = useState<Screen>('home');
  const [callData, setCallData] = useState<{
    contactName: string;
    contactRole: string;
    serviceType?: ServiceType;
    callerRole: 'civilian' | 'service';
  } | null>(null);
  const [historyReportId, setHistoryReportId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isProcessingReady, setIsProcessingReady] = useState(false);
  const pendingReportRef = useRef<{
    photo: string | null;
    description: string;
    location: string;
  } | null>(null);
  const country = getAseanCountry(countryCode);
  const [userLocation, setUserLocation] = useState<UserLocation>(() => ({
    address: getAseanCountry((localStorage.getItem('aseanCountry') as AseanCountryCode) || 'ID').center.address,
    coords: {
      lat: getAseanCountry((localStorage.getItem('aseanCountry') as AseanCountryCode) || 'ID').center.lat,
      lng: getAseanCountry((localStorage.getItem('aseanCountry') as AseanCountryCode) || 'ID').center.lng
    }
  }));
  const [emergencyData, setEmergencyData] = useState<EmergencyData>({
    photo: null,
    description: '',
    location: ''
  });
  const primaryEmergencyService = emergencyData.services?.[0] ?? selectedService;
  const canViewSensitiveMedia = userRole === 'service';
  const tr = (key: Parameters<typeof translate>[1]) => translate(language, key);

  function mapResponsePlanToServices(responsePlan?: Array<ServiceType | 'disaster-response'>, fallback: ServiceType[] = []): ServiceType[] {
    const mapped = (responsePlan ?? []).flatMap(role => role === 'disaster-response' ? [] : [role]);
    return [...new Set((mapped.length ? mapped : fallback).filter((service): service is ServiceType => service === 'ambulance' || service === 'fire' || service === 'police'))];
  }

  useEffect(() => {
    resetPreviousHistoryOnce();
    cleanupExpiredReports();
    const stopFirebaseSync = startReportSync();
    const cleanupInterval = setInterval(cleanupExpiredReports, 60 * 1000);
    const splashTimer = window.setTimeout(() => setShowSplash(false), 1200);
    return () => {
      clearInterval(cleanupInterval);
      clearTimeout(splashTimer);
      stopFirebaseSync();
    };
  }, []);

  useEffect(() => {
    if (portalRole === 'service') return undefined;

    return listenToCitizenSession(user => {
      if (!user) return;
      void getUserProfile(user).then(setUserProfile).catch(() => {
        setUserProfile({
          uid: user.uid,
          name: user.displayName ?? undefined,
          email: user.email ?? undefined
        });
      });
      setUserRole('civilian');
      setCurrentScreen(screen => screen === 'login' || screen === 'register' ? 'home' : screen);
    });
  }, [portalRole]);

  const handleLogin = async (role: UserRole, credentials: { email: string; password: string }) => {
    if (role === 'service') {
      try {
        const serviceSession = await loginServiceAccount(credentials.email, credentials.password);
        setSelectedService(serviceSession.serviceType);
        setUserProfile(serviceSession.profile);
        localStorage.setItem('serviceType', serviceSession.serviceType);
        setUserRole(role);
        setCurrentScreen('home');
        toast.success(language === 'id' ? 'Masuk sebagai Layanan Darurat' : 'Logged in as Emergency Service');
      } catch (error) {
        toast.error(getFriendlyAuthError(error));
      }
      return;
    }

    try {
      const user = await loginCitizenAccount(credentials.email, credentials.password);
      setUserProfile(await getUserProfile(user));
      setUserRole('civilian');
      setCurrentScreen('home');
      toast.success(language === 'id' ? 'Akun warga berhasil masuk' : 'Citizen account logged in');
    } catch (error) {
      toast.error(getFriendlyAuthError(error));
    }
  };

  const handleRegister = async (role: UserRole, data: RegisterData) => {
    if (role === 'service') {
      setCurrentScreen('login');
      toast.error(language === 'id' ? 'Akun layanan darurat dibuat oleh admin' : 'Emergency service accounts are created by admin');
      return;
    }

    try {
      const user = await registerCitizenAccount({
        ...data,
        countryCode: country.code
      });
      setUserProfile({
        uid: user.uid,
        name: data.name,
        email: data.email,
        phone: data.phone,
        identityNumber: data.identityNumber,
        role: 'civilian'
      });
      setUserRole('civilian');
      setCurrentScreen('home');
      toast.success(language === 'id' ? 'Akun warga berhasil dibuat' : 'Citizen account created');
    } catch (error) {
      toast.error(getFriendlyAuthError(error));
    }
  };

  const handleLogout = async () => {
    await logoutFirebaseAccount();
    setUserProfile(null);
    setUserRole(null);
    setCurrentScreen('login');
  };

  const handleLocationChange = (location: string, coords: { lat: number; lng: number }) => {
    setUserLocation({ address: location, coords });
  };

  const handleCountryChange = (code: AseanCountryCode) => {
    const nextCountry = getAseanCountry(code);
    localStorage.setItem('aseanCountry', code);
    setCountryCode(code);
    setUserLocation({
      address: nextCountry.center.address,
      coords: { lat: nextCountry.center.lat, lng: nextCountry.center.lng }
    });
    setShowCountryPicker(false);
  };

  const handleLanguageChange = (nextLanguage: Language) => {
    localStorage.setItem('appLanguage', nextLanguage);
    setLanguage(nextLanguage);
  };

  const handleRefreshLocation = async () => {
    try {
      const nextLocation = await detectCurrentLocation(country.name);
      setUserLocation(nextLocation);
      setEmergencyData(prev => ({ ...prev, location: nextLocation.address }));
      toast.success('Current location refreshed');
    } catch {
      toast.error('Unable to refresh current location');
    }
  };

  const handleBack = () => {
    if (currentScreen === 'report') {
      setCurrentScreen('home');
    } else if (currentScreen === 'result') {
      setCurrentScreen('home');
    } else if (currentScreen === 'tracking') {
      setCurrentScreen('history');
    } else if (currentScreen === 'service-dashboard' || currentScreen === 'fire-map') {
      setCurrentScreen('home');
    } else if (currentScreen === 'history') {
      setCurrentScreen('home');
    } else if (currentScreen === 'profile') {
      setCurrentScreen('home');
    } else if (currentScreen === 'chat') {
      setCurrentScreen(chatReturnScreen);
    }
  };

  const handleEmergencyStart = () => {
    setCurrentScreen('report');
  };

  const handleCurrentLocationRefresh = async () => {
    await handleRefreshLocation();
    setShowLocationPicker(false);
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
    if (isSubmittingReport) return;

    setIsSubmittingReport(true);
    setIsProcessingReady(false);
    pendingReportRef.current = data;
    setEmergencyData({
      photo: data.photo,
      description: data.description,
      location: data.location
    });
    setCurrentScreen('processing');

    try {
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
      const responsePlan = 'responsePlan' in aiResult && Array.isArray(aiResult.responsePlan)
        ? aiResult.responsePlan
        : [aiResult.service];
      const priorityRole = 'priorityRole' in aiResult && aiResult.priorityRole
        ? aiResult.priorityRole
        : aiResult.service;
      const orderedServices = mapResponsePlanToServices(responsePlan, requiredServices);
      const reportId = Date.now().toString();
      if (pendingReportRef.current !== data) return;
      setSelectedService(aiResult.service);

      const reportData: EmergencyData = {
        ...data,
        coords: userLocation.coords,
        injuryScale: severityScore,
        priority:
          aiResult.severity === 'Critical'
            ? 'Critical'
            : aiResult.severity === 'High' || aiResult.severity === 'Medium'
            ? 'Medium'
            : 'Low',
        emergencyType: aiResult.type,
        detectedIndicators,
        annotatedImage: aiResult.annotatedImage,
        privacyRegions: aiResult.privacyRegions,
        id: reportId,
        services: orderedServices
      };

      setEmergencyData(reportData);

      const newReport: StoredEmergencyReport = {
        id: reportId,
        photo: data.photo,
        description: data.description,
        location: data.location,
        coords: userLocation.coords,
        service: aiResult.service,
        services: orderedServices,
        responsePlan,
        priorityRole,
        serviceStatuses: createServiceStatuses(orderedServices),
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
        privacyRegions: aiResult.privacyRegions,
        countryCode: country.code,
        timestamp: new Date(),
        status: 'pending',
        auditTrail: [{
          id: `${reportId}-created`,
          service: aiResult.service,
          action: 'report_created',
          label: 'Emergency report submitted',
          timestamp: new Date().toISOString()
        }]
      };

      saveReport(newReport);

      console.log('REPORT SAVED:', reportData);
      pendingReportRef.current = null;
      setIsProcessingReady(true);
    } finally {
      setIsSubmittingReport(false);
    }
  };
  const handleProcessingComplete = () => {
    setCurrentScreen('result');
  };

  const handleFalseReportDone = () => {
    setEmergencyData({ photo: null, description: '', location: '' });
    setHistoryReportId(null);
    setCurrentScreen('home');
  };

  const handleCancelPendingSubmission = () => {
    pendingReportRef.current = null;
    setIsSubmittingReport(false);
    setIsProcessingReady(false);
    setEmergencyData({ photo: null, description: '', location: '' });
    setHistoryReportId(null);
    setCurrentScreen('home');
    toast.info(language === 'id' ? 'Laporan dibatalkan' : 'Report canceled');
  };

  const handleCancelSubmittedReport = () => {
    if (emergencyData.id) deleteReports([emergencyData.id]);
    setEmergencyData({ photo: null, description: '', location: '' });
    setHistoryReportId(null);
    setCurrentScreen('home');
    toast.info(language === 'id' ? 'Laporan dibatalkan' : 'Report canceled');
    window.setTimeout(() => {
      if (emergencyData.id) deleteReports([emergencyData.id]);
    }, 800);
  };

const handleOpenChat = (reportId: string, returnScreen: Screen = currentScreen) => {
  setChatReportId(reportId);
  setChatReturnScreen(returnScreen);
  setCurrentScreen('chat');
};

const handleOpenCall = (
  data: {
    contactName: string;
    contactRole: string;
    serviceType?: ServiceType;
    callerRole: 'civilian' | 'service';
  },
  returnScreen: Screen = currentScreen
) => {
  setCallData(data);
  setCallReturnScreen(returnScreen);
  setCurrentScreen('call');
};

const handleTrackReport = (report: StoredEmergencyReport) => {
  setHistoryReportId(report.id);
  const services = getReportServices(report);
  setSelectedService(services[0]);
  setEmergencyData({
    id: report.id,
    photo: report.photo,
    description: report.description,
    location: report.location,
    coords: report.coords,
    injuryScale: report.injuryScale,
    emergencyType: report.emergencyType,
    detectedIndicators: report.detectedIndicators,
    services
  });
  setCurrentScreen('tracking');
};

const handleNavigate = (screen: 'home' | 'history' | 'profile') => {
  if (
    screen === 'home' ||
    screen === 'history' ||
    screen === 'profile'
  ) {
    if (screen === 'history') setHistoryReportId(null);
    setCurrentScreen(screen);
  }
};


  const showBackButton =
    currentScreen !== 'home' &&
    currentScreen !== 'report' &&
    currentScreen !== 'history' &&
    currentScreen !== 'tracking' &&
    currentScreen !== 'processing' &&
    currentScreen !== 'result' &&
    currentScreen !== 'service-dashboard' &&
    currentScreen !== 'fire-map' &&
    currentScreen !== 'chat' &&
    currentScreen !== 'call' &&
    currentScreen !== 'profile' &&
    currentScreen !== 'login' &&
    currentScreen !== 'register';
  const showNavigation =
    userRole === 'civilian'
      ? currentScreen !== 'service-dashboard' && currentScreen !== 'processing' && currentScreen !== 'fire-map' && currentScreen !== 'call'
      : userRole === 'service' && (currentScreen === 'home' || currentScreen === 'profile');
  
  // Show login or register screen if not logged in
  if (!userRole) {
    return (
      <div className={`app-shell flex flex-col ${portalRole === 'service' ? 'app-shell-service' : 'app-shell-civilian'}`}>
      <IPhoneStatusBar dark={false} />
        <Toaster position="top-center" richColors />
        {showSplash ? (
          <SplashScreen />
        ) : (
          <>
        <div className="hidden absolute right-4 top-4 z-50 items-center gap-2">
          <LanguageToggle language={language} onChange={handleLanguageChange} />
          <button
            onClick={() => setShowCountryPicker(true)}
            className="flex h-10 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/90 px-3 text-sm text-white shadow-lg"
          >
            <Globe2 className="h-4 w-4 text-blue-400" />
            {country.flag} {country.code}
          </button>
        </div>
        {currentScreen === 'register' ? (
          <RegisterScreen
            onRegister={handleRegister}
            onBackToLogin={() => setCurrentScreen('login')}
            forcedRole={portalRole}
            country={country}
            language={language}
          />
        ) : (
          <LoginScreen
            onLogin={handleLogin}
            onGoToRegister={() => setCurrentScreen('register')}
            forcedRole={portalRole}
            language={language}
          />
        )}
        {showCountryPicker && (
          <CountryPicker
            currentCountry={countryCode}
            onSelect={handleCountryChange}
            onClose={() => setShowCountryPicker(false)}
          />
        )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`app-shell flex flex-col ${userRole === 'service' ? 'app-shell-service' : 'app-shell-civilian'}`}>
      <IPhoneStatusBar dark={userRole === 'service' && currentScreen === 'service-dashboard'} />
      <Toaster position="top-center" richColors />

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
          onOpenDangerMap={() => setCurrentScreen('fire-map')}
          currentLocation={userLocation.address}
          onChangeLocation={handleCurrentLocationRefresh}
          country={country}
          userRole={userRole}
          serviceType={userRole === 'service' ? selectedService : undefined}
          language={language}
        />
      )}

      {currentScreen === 'report' && (
        <EmergencyReportScreen
          onSubmit={handleReportSubmit}
          onBack={() => setCurrentScreen('home')}
          defaultLocation={userLocation.address}
          language={language}
        />
      )}

      {currentScreen === 'processing' && (
        <AIProcessingScreen
          photo={emergencyData.photo}
          description={emergencyData.description}
          isReady={isProcessingReady}
          onComplete={handleProcessingComplete}
          onCancel={handleCancelPendingSubmission}
        />
      )}

      {currentScreen === 'result' && (
        <EmergencyResultScreen
          emergencyType={emergencyData.emergencyType || 'Emergency situation'}
          priority={emergencyData.priority || 'Medium'}
          recommendedService={selectedService}
          recommendedServices={emergencyData.services ?? [selectedService]}
          reportId={emergencyData.id}
          injuryScale={emergencyData.injuryScale || 5}
          location={emergencyData.location}
          detectedIndicators={emergencyData.detectedIndicators}
          annotatedImage={emergencyData.annotatedImage}
          privacyRegions={emergencyData.privacyRegions}
          isFalseReport={Boolean((emergencyData as { isFalseReport?: boolean }).isFalseReport)}
          falseReportReason={(emergencyData as { falseReportReason?: string }).falseReportReason}
          servicePhoneNumber={getServiceContactNumber(primaryEmergencyService)}
          canViewSensitiveMedia={canViewSensitiveMedia}
          onCancelReport={handleCancelSubmittedReport}
          onOpenChat={() => {
            if (emergencyData.id) handleOpenChat(emergencyData.id, 'result');
          }}
          onCallResponder={() => handleOpenCall({
            contactName: primaryEmergencyService === 'ambulance' ? 'Medic Command' : primaryEmergencyService === 'fire' ? 'Fire Command' : 'Police Command',
            contactRole: primaryEmergencyService === 'ambulance' ? 'Medic Responder' : primaryEmergencyService === 'fire' ? 'Fire Responder' : 'Police Responder',
            serviceType: primaryEmergencyService,
            callerRole: 'civilian'
          }, 'result')}
          onViewDetails={() => {
            setHistoryReportId(emergencyData.id ?? null);
            setCurrentScreen('tracking');
          }}
          onFalseReportDone={handleFalseReportDone}
          language={language}
        />
      )}

      {currentScreen === 'tracking' && (
        <LiveTrackingScreen
          reportId={emergencyData.id ?? ''}
          serviceTypes={emergencyData.services ?? [selectedService]}
          userLocation={emergencyData.coords ?? userLocation.coords}
          onOpenChat={() => emergencyData.id && handleOpenChat(emergencyData.id, 'tracking')}
          onBack={() => setCurrentScreen('history')}
          servicePhoneNumber={getServiceContactNumber(primaryEmergencyService)}
        />
      )}

      {currentScreen === 'service-dashboard' && (
        <EmergencyServiceDashboard
          country={country}
          serviceType={selectedService}
          canViewSensitiveMedia={canViewSensitiveMedia}
          onBack={() => setCurrentScreen('home')}
          onOpenChat={reportId => handleOpenChat(reportId, 'service-dashboard')}
          onCallCitizen={() => handleOpenCall({
            contactName: 'Mytha Floyen',
            contactRole: 'Civilian',
            serviceType: selectedService,
            callerRole: 'service'
          }, 'service-dashboard')}
        />
      )}

      {currentScreen === 'fire-map' && (
        <FireMapScreen
          userLocation={userLocation.coords}
          countryCode={country.code}
          onBack={() => setCurrentScreen('home')}
          language={language}
        />
      )}

      {currentScreen === 'history' && (
        <ReportHistoryScreen
          initialReportId={historyReportId}
          onOpenChat={reportId => handleOpenChat(reportId, 'history')}
          onTrack={handleTrackReport}
          canViewSensitiveMedia={canViewSensitiveMedia}
        />
      )}

      {currentScreen === 'profile' && (
        <ProfileScreen
          country={country}
          currentLocation={userLocation.address}
          language={language}
          onLogout={handleLogout}
          onLanguageChange={handleLanguageChange}
          userRole={userRole}
          serviceType={userRole === 'service' ? selectedService : undefined}
          userName={userProfile?.name}
          userEmail={userProfile?.email}
          userPhone={userProfile?.phone}
          userIdentityNumber={userProfile?.identityNumber}
        />
      )}

      {currentScreen === 'call' && callData && (
        <CallScreen
          {...callData}
          onBack={() => setCurrentScreen(callReturnScreen)}
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
          language={language}
          userRole={userRole}
        />
      )}

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <LocationPicker
          currentLocation={userLocation.address}
          onLocationChange={handleLocationChange}
          onRefreshLocation={handleRefreshLocation}
          onClose={() => setShowLocationPicker(false)}
          country={country}
        />
      )}

      {showCountryPicker && (
        <CountryPicker
          currentCountry={countryCode}
          onSelect={handleCountryChange}
          onClose={() => setShowCountryPicker(false)}
        />
      )}
    </div>
  );
}
