import { Home, FileText, History } from 'lucide-react';
import { t, type Language } from '../i18n';

interface NavigationProps {
  currentScreen: string;
  onNavigate: (screen: 'home' | 'report' | 'history') => void;
  language: Language;
}

export function Navigation({ currentScreen, onNavigate, language }: NavigationProps) {
  const menuItems = [
    { id: 'home', label: t(language, 'nav.home'), icon: Home },
    { id: 'report', label: t(language, 'nav.report'), icon: FileText },
    { id: 'history', label: t(language, 'nav.history'), icon: History },
  ] as const;

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-gray-950/95 backdrop-blur-xl">
      <div className="grid grid-cols-3 items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 transition-all ${
                isActive
                  ? 'bg-blue-500/15 text-blue-300'
                  : 'text-gray-500 hover:bg-gray-800/60 hover:text-gray-300'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
