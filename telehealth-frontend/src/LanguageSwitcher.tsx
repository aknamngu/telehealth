import { Languages } from 'lucide-react';
import { useLanguage } from './i18n';

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="fixed right-4 top-4 z-[10000] flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 p-1.5 text-slate-700 shadow-lg backdrop-blur" aria-label={t('language')}>
      <Languages className="ml-2 h-4 w-4 text-sky-600" />
      {(['vi', 'en'] as const).map((item) => (
        <button key={item} type="button" onClick={() => setLanguage(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${language === item ? 'bg-slate-950 text-white' : 'hover:bg-slate-100'}`} aria-pressed={language === item}>
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
