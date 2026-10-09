import { RefreshCw, Sparkles } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';
import { useLanguage } from '../../context/LanguageContext';

export const PwaUpdateToast = () => {
  const { hasUpdate, applyUpdate } = usePwa();
  const { t } = useLanguage();

  if (!hasUpdate) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label={t('common.updateAvailable')}
      className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl rounded-2xl p-4 max-w-sm text-slate-100 flex items-center gap-3.5 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
        <Sparkles className="w-5 h-5 text-emerald-400" />
      </div>

      <div className="flex-1 min-w-0">
        <h5 className="font-semibold text-white text-xs leading-tight">
          {t('common.updateAvailable')}
        </h5>
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
          {t('common.updatePrompt')}
        </p>
      </div>

      <button
        onClick={applyUpdate}
        className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs py-2 px-3 rounded-lg shadow transition-all shrink-0 active:scale-95"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {t('common.reloadApp')}
      </button>
    </aside>
  );
};

export default PwaUpdateToast;
