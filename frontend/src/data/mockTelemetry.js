export const mockSystemConfig = {
  systemId: 1,
  systemName: 'Residential Rooftop String-1',
  ratedPowerKw: 5.0,
  stringCount: 1,
  panelCount: 12,
  panelWattage: 415,
  tiltAngle: 25.0,
  azimuthAngle: 180.0,
  tariffPerKwh: 0.18,
  currency: 'USD',
  status: 'ONLINE',
};

export const mockLiveTelemetry = {
  timestamp: new Date().toISOString(),
  dcVoltage: 382.4,
  dcCurrent: 9.85,
  dcPower: 3.766, // kW
  acPower: 3.642, // kW
  acVoltage: 232.8,
  acFrequency: 50.01,
  dailyYieldKwh: 21.4,
  totalYieldKwh: 4380.2,
  inverterTempC: 41.5,
  irradiancePoa: 840, // W/m2
  ambientTempC: 27.2,
  performanceRatio: 88.4,
};

export const mockPowerCurves = [
  { time: '06:00', actualKw: 0.05, expectedKw: 0.1, irradiance: 60 },
  { time: '07:00', actualKw: 0.42, expectedKw: 0.45, irradiance: 180 },
  { time: '08:00', actualKw: 1.15, expectedKw: 1.2, irradiance: 340 },
  { time: '09:00', actualKw: 2.3, expectedKw: 2.4, irradiance: 550 },
  { time: '10:00', actualKw: 3.45, expectedKw: 3.6, irradiance: 750 },
  { time: '11:00', actualKw: 4.3, expectedKw: 4.45, irradiance: 900 },
  { time: '12:00', actualKw: 4.65, expectedKw: 4.8, irradiance: 970 },
  { time: '13:00', actualKw: 3.1, expectedKw: 4.75, irradiance: 950 }, // Shading deficit
  { time: '14:00', actualKw: 3.3, expectedKw: 4.3, irradiance: 880 }, // Shading deficit
  { time: '15:00', actualKw: 3.4, expectedKw: 3.55, irradiance: 720 },
  { time: '16:00', actualKw: 2.1, expectedKw: 2.2, irradiance: 480 },
  { time: '17:00', actualKw: 0.95, expectedKw: 1.0, irradiance: 260 },
  { time: '18:00', actualKw: 0.18, expectedKw: 0.2, irradiance: 80 },
];

export const mockAlerts = [
  {
    id: 101,
    faultCategory: 'PARTIAL_SHADING',
    severity: 'WARNING',
    confidence: 0.92,
    detectedAt: 'Today, 13:15',
    estimatedPowerLossKw: 1.65,
    estimatedDailyLossKwh: 2.8,
    estimatedFinancialLoss: 0.50,
    explanation: '35% drop in DC current between 13:00 and 14:30 while POA irradiance remained high (>900 W/m²).',
    recommendedAction: 'Inspect south-west rooftop perimeter for tree branch growth or chimney obstruction.',
    status: 'ACTIVE',
  },
  {
    id: 102,
    faultCategory: 'SOILING',
    severity: 'INFO',
    confidence: 0.78,
    detectedAt: 'Yesterday, 17:00',
    estimatedPowerLossKw: 0.35,
    estimatedDailyLossKwh: 1.9,
    estimatedFinancialLoss: 0.34,
    explanation: 'Gradual ~7% baseline offset observed consistently over last 4 sunny days.',
    recommendedAction: 'Schedule a surface wash with demineralized water if dry conditions persist.',
    status: 'ACTIVE',
  },
];

export const mockLossSummary = {
  period: 'Last 30 Days',
  expectedKwh: 580.0,
  actualKwh: 512.4,
  lostKwh: 67.6,
  lossPercentage: 11.6,
  financialLoss: 12.17,
  currency: 'USD',
  savingsTotal: 92.23,
};
