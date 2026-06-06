import { Languages } from 'lucide-react';
import { languageLabels, nextLanguage, type Language } from '../i18n';

interface LanguageToggleProps {
  language: Language;
  onChange: (language: Language) => void;
}

export function LanguageToggle({ language, onChange }: LanguageToggleProps) {
  const next = nextLanguage(language);

  return (
    <button
      onClick={() => onChange(next)}
      className="flex h-10 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/90 px-3 text-sm text-white shadow-lg backdrop-blur-sm transition hover:bg-gray-700"
      aria-label={`Switch language to ${languageLabels[next]}`}
      title={`Switch language to ${languageLabels[next]}`}
    >
      <Languages className="h-4 w-4 text-blue-300" />
      <span className="font-semibold">{language.toUpperCase()}</span>
    </button>
  );
}
