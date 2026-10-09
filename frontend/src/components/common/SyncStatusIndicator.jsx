import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Feather, Gauge } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';
import { useLanguage } from '../../context/LanguageContext';

export const SyncStatusIndicator = () => {
  const { isOnline, lastSuccessfulSync, isLowBandwidthMode, toggleLowBandwidthMode } = usePwa();
  const { t } = useLanguage();
  const [timeAgoStr, setTimeAgoStr] = useState('');
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const updateRelativeTime = () => {
      if (!lastSuccessfulSync) {
        setTimeAgoStr(t('common.syncedJustNow'));
        setIsStale(false);
        return;
      }
      const diffMs = Date.now() - new Date(lastSuccessfulSync).getTime();
      const diffMins = Math.floor(diffMs / 60000);

      setIsStale(diffMins > 30);

      if (diffMins < 1) {
        setTimeAgoStr(t('common.syncedJustNow'));
      } else if (diffMins === 1) {
        setTimeAgoStr(`1 min ${t('common.ago')}`);
      } else if (diffMins < 60) {
        setTimeAgoStr(`${diffMins} mins ${t('common.ago')}`);
      } else {
        const hours = Math.floor(diffMins / 60);
        setTimeAgoStr(`${hours}h ${t('common.ago')}`);
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 30000);
    return () => clearInterval(interval);
  }, [lastSuccessfulSync, t]);

  return (
    <div className="flex items-center gap-2">
      {/* Low Bandwidth Toggle */}
      <button
        type="button"
        onClick={toggleLowBandwidthMode}
        title={
          isLowBandwidthMode
            ? `${t('common.lowBandwidthMode')}: Active (${t('common.lowBandwidthDesc')})`
            : `${t('common.lowBandwidthMode')}: Off (Click to enable data saver)`
        }
        aria-label={t('common.lowBandwidthMode')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all ${
          isLowBandwidthMode
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
            : 'bg-slate-900/60 text-slate-400 border-slate-700/50 hover:text-slate-200'
        }`}
      >
        <Feather className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">
          {isLowBandwidthMode ? 'Lite' : 'Full'}
        </span>
      </button>

      {/* Sync Status Badge */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border ${
          !isOnline
            ? 'bg-red-500/15 text-red-400 border-red-500/30'
            : isStale
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            : 'bg-slate-900/80 text-slate-300 border-slate-700/60'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {isOnline && !isStale && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              !isOnline
                ? 'bg-red-500'
                : isStale
                ? 'bg-amber-400'
                : 'bg-emerald-500'
            }`}
          ></span>
        </span>

        <span className="hidden md:inline">
          {!isOnline
            ? t('common.offline')
            : isStale
            ? `${t('common.staleData')} (${timeAgoStr})`
            : timeAgoStr}
        </span>
      </div>
    </div>
  );
};

export default SyncStatusIndicator;
