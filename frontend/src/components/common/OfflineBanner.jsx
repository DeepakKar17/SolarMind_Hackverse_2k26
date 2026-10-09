import { WifiOff, Clock, Database } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';
import { useLanguage } from '../../context/LanguageContext';

export const OfflineBanner = () => {
  const { isOnline, offlineQueue } = usePwa();
  const { t } = useLanguage();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="alert"
      className="bg-gradient-to-r from-amber-600/90 via-amber-500/90 to-amber-600/90 text-slate-950 px-4 py-2 text-xs font-medium shadow-md flex items-center justify-between gap-3 border-b border-amber-400/40 animate-in fade-in"
    >
      <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1">
        <div className="w-5 h-5 rounded-full bg-slate-950/20 flex items-center justify-center shrink-0">
          <WifiOff className="w-3.5 h-3.5 text-slate-950" />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-bold">{t('common.offlineBanner')}</span>
          <span className="text-slate-900/90">{t('common.offlineBannerSub')}</span>
        </div>
      </div>

      {offlineQueue.length > 0 && (
        <div className="flex items-center gap-1.5 bg-slate-950/20 px-2.5 py-1 rounded-full text-[11px] font-semibold">
          <Database className="w-3 h-3" />
          <span>
            {offlineQueue.length} {t('common.queuedBadge')}
          </span>
        </div>
      )}
    </div>
  );
};

export default OfflineBanner;
