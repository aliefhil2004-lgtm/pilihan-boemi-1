import { useEffect, useState } from 'react';
import { Ambulance, Flame, Shield, AlertCircle, ArrowRight, AlertTriangle, Map, RefreshCw } from 'lucide-react';
import type { AseanCountry } from '../config/asean';
import type { StoredEmergencyReport } from '../types/emergency';
import { getReportServices, getServiceStatus } from '../types/emergency';
import { cleanupExpiredReports } from '../services/reportStorage';
import { t, type Language } from '../i18n';

interface HomeScreenProps {
  onEmergencyStart: () => void;
  onServiceSelect: (service: 'ambulance' | 'fire' | 'police') => void;
  onOpenDangerMap: () => void;
  onCallEmergency: () => void;
  currentLocation: string;
  onChangeLocation: () => void | Promise<void>;
  country: AseanCountry;
  userRole: 'civilian' | 'service';
  serviceType?: 'ambulance' | 'fire' | 'police';
  serviceDisplayName?: string;
  language: Language;
}

export function HomeScreen({ onEmergencyStart, onServiceSelect, onOpenDangerMap, onCallEmergency, currentLocation, onChangeLocation, country, userRole, serviceType, serviceDisplayName, language }: HomeScreenProps) {
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);
  const [highestPriorityReport, setHighestPriorityReport] = useState<StoredEmergencyReport | null>(null);
  const services = [
    { id: 'ambulance' as const, name: tr('service.medicalCommand'), detail: tr('service.medicalDetail'), icon: Ambulance, color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'hover:border-blue-500/60' },
    { id: 'fire' as const, name: tr('service.fireCommand'), detail: tr('service.fireDetail'), icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'hover:border-orange-500/60' },
    { id: 'police' as const, name: tr('service.policeCommand'), detail: tr('service.policeDetail'), icon: Shield, color: 'text-indigo-400', bg: 'bg-indigo-500/15', border: 'hover:border-indigo-500/60' }
  ];
  const visibleServices = userRole === 'service' && serviceType
    ? services.filter(service => service.id === serviceType)
    : services;

  useEffect(() => {
    if (userRole !== 'service') return;

    const refreshHighestPriority = () => {
      const activeReports = cleanupExpiredReports()
        .filter(report =>
          report.injuryScale >= 5 &&
          !['resolved', 'done', 'declined'].includes(report.status) &&
          (!serviceType || getReportServices(report).includes(serviceType)) &&
          (!serviceType || !['done', 'declined', 'resolved'].includes(getServiceStatus(report, serviceType))) &&
          (!report.countryCode || report.countryCode === country.code)
        )
        .sort((a, b) => b.injuryScale - a.injuryScale);
      setHighestPriorityReport(activeReports[0] ?? null);
    };

    refreshHighestPriority();
    const interval = setInterval(refreshHighestPriority, 2000);
    window.addEventListener('emergency-reports-updated', refreshHighestPriority);
    return () => {
      clearInterval(interval);
      window.removeEventListener('emergency-reports-updated', refreshHighestPriority);
    };
  }, [country.code, serviceType, userRole]);

  const priorityLabel =
    !highestPriorityReport ? null :
    highestPriorityReport.injuryScale >= 8 ? 'HIGH' :
    'MEDIUM';

  return (
    <div className="app-scrollbar flex h-full flex-col overflow-y-auto bg-white pb-20 text-[#0b3850]">
      {/* Header */}
      <div className="shrink-0 flex items-start justify-between px-5 pb-[11px] pt-[59px]">
        <div>
          <h1 className="text-[24px] font-bold leading-8 tracking-normal">{userRole === 'service' ? tr('home.responseCenter') : tr('home.needHelp')}</h1>
          <p className="mt-1 text-[14px] leading-5 text-[#9aa3b1]">
            {userRole === 'service' ? tr('home.selectDashboard') : tr('home.sendLocation')}
          </p>
        </div>
        {userRole === 'service' && (
          <button
            onClick={onOpenDangerMap}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#679cbc] text-white"
            aria-label="Open emergency map"
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
        )}
      </div>

        <div className="relative mx-[15px] mt-0 flex h-[57px] shrink-0 items-start justify-between overflow-hidden rounded-[10px] bg-[#0c2f45] px-4 py-[10px] text-white">
        <div className="pointer-events-none absolute -left-24 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -right-20 -top-10 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative flex w-full items-center gap-4 pr-1">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-[11px] font-medium leading-[16.5px] text-white">{userRole === 'service' ? tr('home.commandLocation') : tr('home.currentLocation')}</p>
            <p className="truncate text-[14px] font-semibold leading-5 text-white">{currentLocation}</p>
          </div>
          <button
            onClick={onChangeLocation}
            className="ml-auto flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-white bg-white/5 transition hover:bg-white/10"
            aria-label="Refresh current location"
          >
            <RefreshCw className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {userRole === 'civilian' ? (
        <div className="flex flex-1 flex-col px-0 py-0">
          <div className="mx-auto w-full max-w-sm text-center">
            <div className="relative mx-auto mb-0 mt-[104px] flex h-[292px] w-[292px] items-center justify-center">
              <div className="absolute h-[292px] w-[292px] rounded-full border border-[#1f2937]/30 bg-white" />
              <div className="absolute h-[258px] w-[258px] rounded-full border-2 border-[#ff3b30] bg-[#fff3f2]" />
              <button
                onClick={onEmergencyStart}
                className="relative flex h-[220px] w-[220px] flex-col items-center justify-center rounded-full bg-[#ff3b30] text-white shadow-[0_0_50px_rgba(255,59,48,0.4)] transition hover:bg-red-500 active:scale-95"
              >
                <span className="mb-[15px] flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/20">
                  <AlertCircle className="h-[50px] w-[50px]" />
                </span>
                <span className="text-[40px] font-bold leading-7">SOS</span>
                <span className="mt-2 text-[14px] font-medium leading-[16.5px] text-white/80">{tr('home.tapToStart')}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onCallEmergency}
              className="mb-[58px] mt-[19px] block w-full text-[11px] leading-4 text-[#6a7282] transition hover:text-[#0b3850]"
            >
              Emergency Hotline: <span className="font-bold text-[#ff6467]">{country.emergency.ambulance}</span>
            </button>
            <button
              onClick={onOpenDangerMap}
              className="relative mx-4 flex h-[68px] w-[358px] items-center justify-between overflow-hidden rounded-[10px] bg-[#0c324a] p-[10px] text-left text-white transition hover:bg-[#123f59]"
            >
              <span className="pointer-events-none absolute -right-20 -top-12 h-40 w-40 rounded-full bg-white/10" />
              <span className="pointer-events-none absolute -right-32 top-2 h-36 w-36 rounded-full bg-white/10" />
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#0c3249]">
                <Map className="h-[18px] w-[18px]" />
              </span>
              <span className="relative min-w-0 flex-1 px-4">
                <span className="block truncate text-[16px] font-semibold leading-6">{tr('home.viewDangerMap')}</span>
                <span className="block truncate text-[14px] font-normal leading-5 text-white">{tr('home.viewDangerMapDetail')}</span>
              </span>
              <ArrowRight className="relative h-3 w-2 shrink-0" />
            </button>
          </div>
        </div>
      ) : (
        <div className="app-scrollbar flex-1 overflow-y-auto px-4 pb-24 pt-2">
          <div className="mx-auto max-w-sm">
            <div className="mb-4">
              <p className="px-1 text-[12px] font-semibold uppercase leading-4 tracking-[1.2px] text-[#42474d]">{tr('home.commandDashboards')}</p>
            </div>
            <div className="overflow-hidden rounded-lg bg-white shadow-[0_4px_4px_rgba(0,0,0,0.25)]">
              {visibleServices.map(service => {
                const Icon = service.icon;
                const isMedical = service.id === 'ambulance';
                const accent = isMedical ? '#679cbc' : service.id === 'fire' ? '#ff5c00' : '#2563eb';
                return (
                  <button
                    key={service.id}
                    onClick={() => onServiceSelect(service.id)}
                    className="group flex w-full items-center gap-4 border-l-[5px] px-6 py-6 text-left transition hover:bg-slate-50"
                    style={{ borderLeftColor: accent }}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: accent }}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-bold leading-6 text-[#0c324a]">{userRole === 'service' && serviceDisplayName ? serviceDisplayName : service.name}</p>
                      <p className="text-[14px] leading-5 text-[#42474d]">{service.detail}</p>
                    </div>
                    <ArrowRight className="h-3 w-2 shrink-0 text-[#42474d]/40 transition group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex min-h-[104px] items-start gap-4 rounded-lg bg-[#c11720] px-4 py-5 text-white">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#c11720]">
                <AlertTriangle className="h-[22px] w-[22px] fill-current" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold uppercase leading-4 tracking-[0.6px]">{tr('home.highestPriority')}</p>
                  {highestPriorityReport ? (
                    <>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <p className="text-[14px] font-bold leading-5 text-white/90">{priorityLabel}</p>
                        <span className="rounded-md bg-white/15 px-2 py-1 text-[10px] font-bold text-white">
                          {highestPriorityReport.injuryScale}/10
                        </span>
                      </div>
                      <p className="mt-2 truncate text-[14px] leading-5 text-white/85">
                        {highestPriorityReport.emergencyType ?? highestPriorityReport.description ?? 'Emergency report'}
                      </p>
                      <p className="mt-2 truncate text-[12px] leading-4 text-white/75">{highestPriorityReport.location}</p>
                    </>
                  ) : (
                    <p className="mt-1 text-[14px] leading-5 text-white/80">{tr('home.noActiveReports')}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-2 rounded-lg border border-white/5 bg-[#0c2f45] p-4 text-white">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                <p className="text-[12px] font-bold uppercase leading-4 tracking-[0.6px]">{tr('home.operationsStatus')}</p>
              </div>
              <p className="mt-2 text-[12px] leading-[15px]">{tr('home.operationsReady')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
