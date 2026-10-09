import { useState } from 'react';
import { Download, X, Smartphone, Zap, WifiOff } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';
import { useLanguage } from '../../context/LanguageContext';

export const PwaInstallPrompt = () => {
  const { isInstallable, installApp } = usePwa();
  const { t } = useLanguage();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isInstallable || isDismissed) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    await installApp();
    setIsInstalling(false);
  };

  return (
    <aside
      aria-label={t('common.installApp')}
      className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:max-w-md z-50 bg-slate-900/95 backdrop-blur-xl border border-amber-500/30 shadow-2xl rounded-2xl p-5 text-slate-100 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white text-base leading-tight">
              {t('common.installApp')}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('common.installAppDesc')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label={t('common.dismiss')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 my-3.5 py-2.5 px-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Offline telemetry</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Fast field access</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md shadow-amber-500/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          {isInstalling ? t('common.loading') : t('common.installButton')}
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="text-xs font-medium text-slate-400 hover:text-slate-200 py-2.5 px-3 rounded-xl hover:bg-slate-800/60 transition-colors"
        >
          {t('common.dismiss')}
        </button>
      </div>
    </aside>
  );
};

export default PwaInstallPrompt;
