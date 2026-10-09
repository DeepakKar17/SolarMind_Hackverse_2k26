import { useState } from 'react';
import { Image as ImageIcon, Download, Loader2, AlertCircle } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';
import { useLanguage } from '../../context/LanguageContext';

export const LowBandwidthImage = ({
  src,
  alt = 'Solar inspection photo',
  className = '',
  thumbnailSrc = null,
  aspectRatio = 'aspect-video',
}) => {
  const { isLowBandwidthMode, isOnline } = usePwa();
  const { t } = useLanguage();
  const [isLoadedHighRes, setIsLoadedHighRes] = useState(!isLowBandwidthMode);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoadHighRes = () => {
    setIsLoading(true);
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setIsLoadedHighRes(true);
      setIsLoading(false);
    };
    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
    };
  };

  if (isLoadedHighRes && !hasError) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setHasError(true)}
        className={`${className} transition-opacity duration-300`}
      />
    );
  }

  return (
    <div
      className={`relative ${aspectRatio} w-full rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group`}
    >
      {thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover filter blur-sm opacity-40 scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900" />
      )}

      <div className="relative z-10 flex flex-col items-center text-center max-w-xs">
        {hasError ? (
          <>
            <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
            <p className="text-xs text-rose-300 font-medium">Failed to load photo</p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-2 shadow-inner">
              <ImageIcon className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-xs text-slate-300 font-medium line-clamp-1 mb-1">{alt}</p>
            <p className="text-[11px] text-slate-400 mb-3">{t('common.lowResPreview')}</p>

            <button
              type="button"
              onClick={handleLoadHighRes}
              disabled={isLoading || !isOnline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('common.loading')}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('common.loadHighRes')}</span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LowBandwidthImage;
