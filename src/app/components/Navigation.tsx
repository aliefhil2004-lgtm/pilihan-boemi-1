import { Home, History, User } from 'lucide-react';
import { t, type Language } from '../i18n';

interface NavigationProps {
  currentScreen: string;
  onNavigate: (screen: 'home' | 'history' | 'profile') => void;
  language: Language;
  userRole?: 'civilian' | 'service' | null;
}

export function Navigation({ currentScreen, onNavigate, language, userRole = 'civilian' }: NavigationProps) {
  const menuItems = userRole === 'service'
    ? [
      { id: 'home', label: t(language, 'nav.home'), icon: Home },
      { id: 'profile', label: t(language, 'nav.profile'), icon: User },
    ] as const
    : [
      { id: 'home', label: t(language, 'nav.home'), icon: Home },
      { id: 'history', label: t(language, 'nav.history'), icon: History },
      { id: 'profile', label: t(language, 'nav.profile'), icon: User },
    ] as const;

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-40 h-20 rounded-t-[24px] bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div className={`mx-auto grid h-full max-w-[390px] items-center justify-between gap-2 px-[27px] ${userRole === 'service' ? 'grid-cols-2 px-20' : 'grid-cols-3'}`}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-1 transition-all ${
                isActive
                  ? 'text-[#ff454b]'
                  : 'text-[#9aa3b1] hover:bg-slate-50 hover:text-[#0b3850]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-6 w-6" />
              <span className={`text-[10px] leading-[15px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
