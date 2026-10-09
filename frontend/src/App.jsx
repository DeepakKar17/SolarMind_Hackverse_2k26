import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SolarProvider } from './context/SolarContext';
import { LanguageProvider } from './context/LanguageContext';
import { PwaProvider } from './context/PwaContext';
import { ToastProvider } from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import OfflineBanner from './components/common/OfflineBanner';
import PwaInstallPrompt from './components/common/PwaInstallPrompt';
import PwaUpdateToast from './components/common/PwaUpdateToast';
import AppRoutes from './routes/AppRoutes';

export function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <PwaProvider>
          <AuthProvider>
            <SolarProvider>
              <ToastProvider>
                <BrowserRouter>
                  <OfflineBanner />
                  <AppRoutes />
                  <PwaInstallPrompt />
                  <PwaUpdateToast />
                </BrowserRouter>
              </ToastProvider>
            </SolarProvider>
          </AuthProvider>
        </PwaProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
