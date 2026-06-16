import { Bell, BriefcaseMedical, ChevronRight, CircleHelp, FileText, Globe2, IdCard, LockKeyhole, LogOut, Mail, MapPin, Pencil, Phone, ShieldCheck, User } from 'lucide-react';
import { t, type Language } from '../i18n';
import type { AseanCountry } from '../config/asean';
import { serviceUnitConfig } from '../config/serviceUnits';

interface ProfileScreenProps {
  country: AseanCountry;
  currentLocation: string;
  language: Language;
  onLogout: () => void;
  userRole?: 'civilian' | 'service' | null;
  serviceType?: 'ambulance' | 'fire' | 'police';
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userIdentityNumber?: string;
  onLanguageChange: (language: Language) => void;
}

const serviceProfiles = {
  ambulance: {
    name: 'Jordan Lee',
    unit: serviceUnitConfig.ambulance.unit,
    role: serviceUnitConfig.ambulance.role,
    avatar: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=192&h=192&q=80'
  },
  fire: {
    name: 'Alex Morgan',
    unit: serviceUnitConfig.fire.unit,
    role: serviceUnitConfig.fire.role,
    avatar: 'https://images.unsplash.com/photo-1602417742134-45fd0d0d5208?auto=format&fit=crop&w=192&h=192&q=80'
  },
  police: {
    name: 'Raka Putra',
    unit: serviceUnitConfig.police.unit,
    role: serviceUnitConfig.police.role,
    avatar: 'https://images.unsplash.com/photo-1590999659195-e64a988eaf04?auto=format&fit=crop&w=192&h=192&q=80'
  }
};

export function ProfileScreen({
  language,
  onLogout,
  onLanguageChange,
  userRole = 'civilian',
  serviceType = 'ambulance',
  userName,
  userEmail,
  userPhone,
  userIdentityNumber
}: ProfileScreenProps) {
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);
  const serviceProfile = serviceProfiles[serviceType];
  const displayName = userName || (userRole === 'service' ? serviceProfile.name : 'Mytha Floyen');
  const displayEmail = userEmail || (userRole === 'service' ? undefined : 'mythafloyen@gmail.com');
  const displayPhone = userPhone || '+62 123 456 8912';
  const displayIdentity = userIdentityNumber || '3156789635420009';

  if (userRole === 'service') {
    return (
      <div className="app-scrollbar flex h-full flex-col overflow-y-auto bg-white pb-20 text-[#0b3850]">
        <header className="px-5 pb-4 pt-[59px]">
          <h1 className="text-[24px] font-bold leading-8 tracking-normal">{tr('nav.profile')}</h1>
          <p className="mt-1 text-[14px] leading-5 text-[#9aa3b1]">Manage your account and information</p>
        </header>

        <main className="space-y-[13px] px-4">
          <section className="relative overflow-hidden rounded-[20px] bg-[#2c6482] p-6 text-white">
            <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-xl bg-[#a6dbfe]/10" />
            <div className="relative flex min-h-[131px] items-start">
              <div className="relative h-24 w-24 shrink-0">
                <img src={serviceProfile.avatar} alt="" className="h-24 w-24 rounded-full object-cover" />
                <button className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-xl bg-white text-[#0c324a] shadow-md" aria-label="Edit profile photo">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="ml-6 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[22px] font-semibold leading-[27.5px]">{displayName}</h2>
                  <ShieldCheck className="h-[13px] w-[13px] shrink-0 text-emerald-400" />
                </div>
                <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#dcfce7] px-2 text-[8px] font-semibold uppercase leading-4 tracking-[0.6px] text-[#166534]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
                  Active / On Duty
                </span>
                <div className="mt-3 space-y-1 text-[14px] leading-5 text-white/80">
                  <p>{serviceProfile.unit}</p>
                  <p>{serviceProfile.role}</p>
                  {displayEmail && <p className="truncate">{displayEmail}</p>}
                  <p>Jakarta, Indonesia</p>
                </div>
              </div>
              <ChevronRight className="absolute right-0 top-0 h-3 w-2 text-white/40" />
            </div>
          </section>

          <section className="pt-2">
            <h2 className="mb-4 px-1 text-[12px] font-semibold uppercase leading-4 tracking-[1.2px] text-[#42474d]">Account Settings</h2>
            <div className="rounded-lg border border-[#0c324a]/10 bg-[#eef8ff]">
              <button className="flex w-full items-center gap-4 border-b border-[#0c324a]/10 p-6 text-left">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><User className="h-5 w-5 text-[#0c3249]" /></span>
                <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Personal Information</span><span className="text-[14px] leading-5 text-[#42474d]">Personal and employment information</span></span>
                <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
              </button>
              <button className="flex w-full items-center gap-4 border-b border-[#0c324a]/10 p-6 text-left">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><LockKeyhole className="h-5 w-5 text-[#0c3249]" /></span>
                <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Security</span><span className="text-[14px] leading-5 text-[#42474d]">Password, PIN, and biometric settings</span></span>
                <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
              </button>
              <button onClick={() => onLanguageChange(language === 'en' ? 'id' : 'en')} className="flex w-full items-center gap-4 border-b border-[#0c324a]/10 p-6 text-left">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><Globe2 className="h-5 w-5 text-[#0c3249]" /></span>
                <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Language</span><span className="text-[14px] leading-5 text-[#42474d]">{language === 'en' ? 'English' : 'Bahasa Indonesia'}</span></span>
                <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
              </button>
              <button className="flex w-full items-center gap-4 border-b border-[#0c324a]/10 p-6 text-left">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><Bell className="h-5 w-5 text-[#0c3249]" /></span>
                <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Notifications</span><span className="text-[14px] leading-5 text-[#42474d]">Manage notification preferences</span></span>
                <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
              </button>
              <button className="flex w-full items-center gap-4 p-6 text-left">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><CircleHelp className="h-5 w-5 text-[#0c3249]" /></span>
                <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Help & Support</span><span className="text-[14px] leading-5 text-[#42474d]">FAQs, contact support</span></span>
                <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
              </button>
            </div>
          </section>

          <button
            onClick={onLogout}
            className="flex h-[72px] w-full items-center justify-between rounded-full bg-[#c11720] px-6 py-4 text-[16px] font-bold uppercase leading-6 tracking-[0.8px] text-white"
          >
            <span className="flex items-center gap-4"><LogOut className="h-[18px] w-[18px]" /> Log out</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="app-scrollbar flex h-full flex-col overflow-y-auto bg-white pb-20 text-[#0b3850]">
      <header className="px-5 pb-4 pt-[59px]">
        <h1 className="text-[24px] font-bold leading-8 tracking-normal">{tr('nav.profile')}</h1>
        <p className="mt-1 text-[14px] leading-5 text-[#9aa3b1]">Manage your account and information</p>
      </header>

      <main className="space-y-[13px] px-4">
        <section className="relative overflow-hidden rounded-[20px] bg-[#2c6482] p-6 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -right-24 top-9 h-32 w-32 rounded-full bg-white/10" />
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#0c324a]">
              <User className="h-8 w-8 text-white" />
              <button className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0c324a] shadow-md" aria-label="Edit profile photo">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[22px] font-semibold leading-[27.5px]">{displayName}</h2>
                <ShieldCheck className="h-[13px] w-[13px] shrink-0 text-emerald-400" />
              </div>
              <p className="mt-3 max-w-full truncate rounded bg-[#215f78] px-2 py-0.5 font-mono text-[10px] leading-[15px] tracking-[0.5px]">NIK {displayIdentity}</p>
              <p className="mt-4 flex items-center gap-2 text-[14px] leading-5 text-white/90"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{displayEmail}</span></p>
              <p className="mt-2 flex items-center gap-2 text-[14px] leading-5 text-white/90"><Phone className="h-4 w-4" /> {displayPhone}</p>
              <p className="mt-2 flex items-center gap-2 text-[14px] leading-5 text-white/90"><MapPin className="h-4 w-4" /> Jakarta, Indonesia</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[12px] font-semibold uppercase leading-4 tracking-[0.1em] text-[#3f454d]">Emergency Information</h2>
          <div className="rounded-lg border border-[#cfe0ea] bg-[#eef8ff]">
            <button className="flex w-full items-center gap-4 border-b border-[#d8e6ee] p-6 text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><IdCard className="h-5 w-5 text-[#cc1420]" /></span>
              <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Emergency Contacts</span><span className="text-[14px] leading-5 text-[#3f454d]">Manage your emergency contacts</span></span>
              <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
            </button>
            <button className="flex w-full items-center gap-4 border-b border-[#d8e6ee] p-6 text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><BriefcaseMedical className="h-5 w-5 text-[#2f718d]" /></span>
              <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Medical Information</span><span className="text-[14px] leading-5 text-[#3f454d]">Allergies, blood type, medical conditions</span></span>
              <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
            </button>
            <button className="flex w-full items-center gap-4 p-6 text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><FileText className="h-5 w-5 text-[#6da5c4]" /></span>
              <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Insurance & Coverage</span><span className="text-[14px] leading-5 text-[#3f454d]">JKN, BPJS, Travel Insurance</span></span>
              <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[12px] font-semibold uppercase leading-4 tracking-[0.1em] text-[#3f454d]">Account Settings</h2>
          <div className="rounded-lg border border-[#cfe0ea] bg-[#eef8ff]">
            <button className="flex w-full items-center gap-4 border-b border-[#d8e6ee] p-6 text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><LockKeyhole className="h-5 w-5 text-[#0b3850]" /></span>
              <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Security</span><span className="text-[14px] leading-5 text-[#3f454d]">Password, PIN, and biometric settings</span></span>
              <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
            </button>
            <button onClick={() => onLanguageChange(language === 'en' ? 'id' : 'en')} className="flex w-full items-center gap-4 border-b border-[#d8e6ee] p-6 text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><Globe2 className="h-5 w-5 text-[#0b3850]" /></span>
              <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Language</span><span className="text-[14px] leading-5 text-[#3f454d]">{language === 'en' ? 'English' : 'Bahasa Indonesia'}</span></span>
              <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
            </button>
            <button className="flex w-full items-center gap-4 border-b border-[#d8e6ee] p-6 text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><Bell className="h-5 w-5 text-[#0b3850]" /></span>
              <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Notifications</span><span className="text-[14px] leading-5 text-[#3f454d]">Manage notification preferences</span></span>
              <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
            </button>
            <button className="flex w-full items-center gap-4 p-6 text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white"><CircleHelp className="h-5 w-5 text-[#0b3850]" /></span>
              <span className="flex-1"><span className="block text-[16px] font-bold leading-6">Help & Support</span><span className="text-[14px] leading-5 text-[#3f454d]">FAQs, contact support</span></span>
              <ChevronRight className="h-4 w-4 text-[#9aa3b1]" />
            </button>
          </div>
        </section>

        <button
          onClick={onLogout}
          className="flex h-[72px] w-full items-center justify-center gap-2 rounded-full bg-[#c11720] px-6 py-4 text-[16px] font-bold uppercase leading-6 text-white"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </main>
    </div>
  );
}
