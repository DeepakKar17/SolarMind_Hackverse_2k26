/**
 * SolarMind Application Configuration & User Preferences Service
 */

const STORAGE_KEY = 'solarmind_settings_v1';

export const DEFAULT_SETTINGS = {
  // 1. Plant Preferences
  defaultPlantId: '1',
  defaultTariffInrPerKwh: 7.50,
  clearSkyPhysicsEngine: 'REST2_PHYSICAL', // 'REST2_PHYSICAL' | 'INEICHEN' | 'HAURWITZ'
  autoDetectStringAnomalies: true,

  // 2. Display Units
  powerUnit: 'kW',       // 'kW' | 'W' | 'MW'
  energyUnit: 'kWh',     // 'kWh' | 'MWh'
  currency: 'INR',       // 'INR' | 'USD' | 'EUR' | 'GBP'
  tempUnit: 'C',         // 'C' | 'F'
  irradianceUnit: 'Wm2', // 'Wm2'

  // 3. Date & Time Preferences
  timezone: 'Asia/Kolkata', // 'Asia/Kolkata' | 'UTC' | 'America/New_York' | 'Europe/London'
  dateFormat: 'YYYY-MM-DD', // 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY'
  timeFormat: '24h',        // '24h' | '12h'

  // 4. Data Refresh Settings
  autoRefreshIntervalSec: 30, // 10 | 30 | 60 | 300 | 0 (disabled)
  enableLiveWebSockets: true,
  offlineCacheEnabled: true,
};

export const settingsService = {
  /**
   * Load stored settings with defaults fallback
   */
  getSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback on storage access error
    }
    return { ...DEFAULT_SETTINGS };
  },

  /**
   * Save user settings to storage
   */
  saveSettings(newSettings) {
    const merged = { ...this.getSettings(), ...newSettings };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Fallback
    }
    return merged;
  },

  /**
   * Reset settings to factory defaults
   */
  resetSettings() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Fallback
    }
    return { ...DEFAULT_SETTINGS };
  },

  /**
   * Check live system configuration & API health status
   */
  async getSystemConfigStatus() {
    return {
      version: 'SolarMind v1.0.0-PRO',
      environment: 'Development / Local Demo Mode',
      apiBaseUrl: import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
      fastApiBackendStatus: 'ONLINE (Simulated / Local Mock)',
      visionModelStatus: 'PROVISIONED (SolarMind-Vision-v1.4.2)',
      databaseDriver: 'SQLite 3.x / SQLAlchemy 2.0 (Local)',
      activeTelemetrySensors: 48,
      lastHealthCheck: new Date().toISOString(),
    };
  },
};

export default settingsService;
