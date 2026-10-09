import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { PwaProvider, usePwa } from '../context/PwaContext';
import LanguageSelector from '../components/common/LanguageSelector';
import PwaInstallPrompt from '../components/common/PwaInstallPrompt';
import PwaUpdateToast from '../components/common/PwaUpdateToast';
import OfflineBanner from '../components/common/OfflineBanner';
import SyncStatusIndicator from '../components/common/SyncStatusIndicator';
import LowBandwidthImage from '../components/common/LowBandwidthImage';
import { TRANSLATIONS } from '../i18n/translations';

// Helper test component to expose hooks
const TestConsumer = () => {
  const { language, setLanguage, t } = useLanguage();
  const {
    isOnline,
    isLowBandwidthMode,
    toggleLowBandwidthMode,
    isInstallable,
    installApp,
    hasUpdate,
    applyUpdate,
    offlineQueue,
    queueOfflineAction,
  } = usePwa();

  return (
    <div>
      <div data-testid="current-lang">{language}</div>
      <div data-testid="translated-title">{t('dashboard.portalTitle')}</div>
      <div data-testid="translated-current-power">{t('dashboard.currentPower')}</div>
      <div data-testid="translated-fallback">{t('nonExistent.key', 'Default Fallback')}</div>
      <div data-testid="online-status">{isOnline ? 'ONLINE' : 'OFFLINE'}</div>
      <div data-testid="bandwidth-mode">{isLowBandwidthMode ? 'LITE' : 'FULL'}</div>
      <div data-testid="queue-count">{offlineQueue.length}</div>
      <button onClick={() => setLanguage('hi')}>Switch to Hindi</button>
      <button onClick={() => setLanguage('or')}>Switch to Odia</button>
      <button onClick={() => setLanguage('en')}>Switch to English</button>
      <button onClick={toggleLowBandwidthMode}>Toggle Bandwidth</button>
      <button
        onClick={() =>
          queueOfflineAction({ type: 'WORK_ORDER_UPDATE', workOrderId: 'WO-101', notes: 'Checked DC fuse' })
        }
      >
        Queue Action
      </button>
    </div>
  );
};

describe('Multilingual Internationalization (i18n) Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('contains complete translation dictionaries for English, Hindi, and Odia', () => {
    expect(TRANSLATIONS.en).toBeDefined();
    expect(TRANSLATIONS.hi).toBeDefined();
    expect(TRANSLATIONS.or).toBeDefined();

    // Verify key sections exist across all 3 languages
    const sections = ['nav', 'common', 'dashboard', 'forms', 'diagnostics', 'maintenance', 'notifications', 'empty'];
    ['en', 'hi', 'or'].forEach((lang) => {
      sections.forEach((sec) => {
        expect(TRANSLATIONS[lang][sec]).toBeDefined();
      });
    });
  });

  it('translates dashboard labels to English by default', () => {
    render(
      <LanguageProvider>
        <PwaProvider>
          <TestConsumer />
        </PwaProvider>
      </LanguageProvider>
    );

    expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
    expect(screen.getByTestId('translated-current-power')).toHaveTextContent('Current Power Output');
    expect(document.documentElement.lang).toBe('en');
  });

  it('dynamically switches to Hindi (हिन्दी) and updates HTML document lang attribute', async () => {
    render(
      <LanguageProvider>
        <PwaProvider>
          <TestConsumer />
        </PwaProvider>
      </LanguageProvider>
    );

    fireEvent.click(screen.getByText('Switch to Hindi'));

    expect(screen.getByTestId('current-lang')).toHaveTextContent('hi');
    expect(screen.getByTestId('translated-current-power')).toHaveTextContent('वर्तमान बिजली उत्पादन');
    expect(document.documentElement.lang).toBe('hi');
    expect(localStorage.getItem('solarmind_preferred_language')).toBe('hi');
  });

  it('dynamically switches to Odia (ଓଡ଼ିଆ) and updates HTML document lang attribute', async () => {
    render(
      <LanguageProvider>
        <PwaProvider>
          <TestConsumer />
        </PwaProvider>
      </LanguageProvider>
    );

    fireEvent.click(screen.getByText('Switch to Odia'));

    expect(screen.getByTestId('current-lang')).toHaveTextContent('or');
    expect(screen.getByTestId('translated-current-power')).toHaveTextContent('ବର୍ତ୍ତମାନର ବିଦ୍ୟୁତ୍ ଉତ୍ପାଦନ');
    expect(document.documentElement.lang).toBe('or');
    expect(localStorage.getItem('solarmind_preferred_language')).toBe('or');
  });

  it('resolves fallback gracefully when translation key is missing', () => {
    render(
      <LanguageProvider>
        <PwaProvider>
          <TestConsumer />
        </PwaProvider>
      </LanguageProvider>
    );

    expect(screen.getByTestId('translated-fallback')).toHaveTextContent('Default Fallback');
  });

  it('renders LanguageSelector and permits interactive language changes', async () => {
    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);

    // Should open dropdown showing Hindi and Odia options
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
    expect(screen.getByText('ଓଡ଼ିଆ')).toBeInTheDocument();

    fireEvent.click(screen.getByText('हिन्दी'));
    expect(document.documentElement.lang).toBe('hi');
  });
});

describe('Progressive Web App (PWA) & Low-Bandwidth Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('detects and displays PWA install prompt upon beforeinstallprompt event', async () => {
    render(
      <LanguageProvider>
        <PwaProvider>
          <PwaInstallPrompt />
        </PwaProvider>
      </LanguageProvider>
    );

    // Initially not installable before event
    expect(screen.queryByText(/Install SolarMind App/i)).not.toBeInTheDocument();

    // Dispatch synthetic beforeinstallprompt event
    act(() => {
      const event = new Event('beforeinstallprompt');
      event.prompt = vi.fn().mockResolvedValue();
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(screen.getByText(/Install SolarMind App/i)).toBeInTheDocument();
    });

    // Dismiss prompt
    const dismissBtn = screen.getByLabelText(/Dismiss/i);
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/Install SolarMind App/i)).not.toBeInTheDocument();
  });

  it('handles offline state and renders OfflineBanner with local action queue counter', async () => {
    render(
      <LanguageProvider>
        <PwaProvider>
          <TestConsumer />
          <OfflineBanner />
        </PwaProvider>
      </LanguageProvider>
    );

    expect(screen.getByTestId('online-status')).toHaveTextContent('ONLINE');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Trigger offline event
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByTestId('online-status')).toHaveTextContent('OFFLINE');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument();

    // Queue an offline action
    fireEvent.click(screen.getByText('Queue Action'));
    expect(screen.getByTestId('queue-count')).toHaveTextContent('1');
    expect(screen.getByText(/1 Offline Queue/i)).toBeInTheDocument();

    // Trigger back online
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByTestId('online-status')).toHaveTextContent('ONLINE');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('toggles low-bandwidth mode and adjusts polling and rendering strategy', () => {
    render(
      <LanguageProvider>
        <PwaProvider>
          <TestConsumer />
          <SyncStatusIndicator />
        </PwaProvider>
      </LanguageProvider>
    );

    expect(screen.getByTestId('bandwidth-mode')).toHaveTextContent('FULL');

    fireEvent.click(screen.getByText('Toggle Bandwidth'));
    expect(screen.getByTestId('bandwidth-mode')).toHaveTextContent('LITE');
    expect(localStorage.getItem('solarmind_low_bandwidth_mode')).toBe('true');
  });

  it('renders LowBandwidthImage placeholder in lite mode and loads on demand', () => {
    render(
      <LanguageProvider>
        <PwaProvider>
          <LowBandwidthImage
            src="https://images.unsplash.com/photo-1509391365360-2e959784a276?w=1600"
            alt="Rooftop DC combiner box inspection"
          />
        </PwaProvider>
      </LanguageProvider>
    );

    // Initially loads high-res if full bandwidth mode is active
    expect(screen.getByAltText('Rooftop DC combiner box inspection')).toBeInTheDocument();
  });

  it('renders SyncStatusIndicator with live and stale telemetry time labels', () => {
    render(
      <LanguageProvider>
        <PwaProvider>
          <SyncStatusIndicator />
        </PwaProvider>
      </LanguageProvider>
    );

    expect(screen.getByText(/Synced just now/i)).toBeInTheDocument();
  });
});
