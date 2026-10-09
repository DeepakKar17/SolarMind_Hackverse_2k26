import { useState, useMemo } from 'react';
import { SolarContext } from './solarContextDef';
import {
  DEMO_PLANTS,
  DEMO_TELEMETRY_SERIES,
  DEMO_FAULT_CATEGORIES_DISTRIBUTION,
  DEMO_DAILY_LOSS_SERIES,
  DEMO_PLANT_COMPARISONS,
  DEMO_ALERTS,
  DEMO_DIAGNOSES,
  DEMO_WORK_ORDERS,
} from '../data/demoFixtures';

export const SolarProvider = ({ children }) => {
  const [plants] = useState(DEMO_PLANTS);
  const [selectedPlantId, setSelectedPlantId] = useState(1);
  const [telemetrySeries] = useState(DEMO_TELEMETRY_SERIES);
  const [faultDistribution] = useState(DEMO_FAULT_CATEGORIES_DISTRIBUTION);
  const [dailyLossSeries] = useState(DEMO_DAILY_LOSS_SERIES);
  const [plantComparisons] = useState(DEMO_PLANT_COMPARISONS);
  const [alerts, setAlerts] = useState(DEMO_ALERTS);
  const [diagnoses] = useState(DEMO_DIAGNOSES);
  const [workOrders, setWorkOrders] = useState(DEMO_WORK_ORDERS);
  const [datePreset, setDatePreset] = useState('TODAY');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isLiveConnected] = useState(true);
  const [systemConfig, setSystemConfig] = useState({
    systemName: 'Rooftop Array Alpha (5.4 kWp)',
    ratedPowerKw: 5.4,
    panelCount: 12,
    panelWattage: 450,
    tariffPerKwh: 7.50,
    tiltAngle: 18,
    azimuthAngle: 180,
  });

  // Computed active plant
  const selectedPlant = useMemo(() => {
    return plants.find((p) => p.id === selectedPlantId) || plants[0];
  }, [plants, selectedPlantId]);

  // Current live snapshot (last reading from series)
  const latestTelemetry = useMemo(() => {
    if (!telemetrySeries || telemetrySeries.length === 0) return null;
    return telemetrySeries[telemetrySeries.length - 1];
  }, [telemetrySeries]);

  // Dynamic KPI Aggregations
  const summaryKpis = useMemo(() => {
    if (!telemetrySeries || telemetrySeries.length === 0) {
      return {
        currentKw: null,
        todayYieldKwh: null,
        expectedTodayKwh: null,
        performanceRatio: null,
        estimatedLossKwh: null,
        financialLossInr: null,
        activeFaultsCount: 0,
        openWorkOrdersCount: 0,
      };
    }

    // Current Generation
    const currentKw = latestTelemetry ? latestTelemetry.actualKw : null;

    // Daily Sums
    const todayYieldKwh = Number(telemetrySeries.reduce((sum, item) => sum + (item.actualKw || 0), 0).toFixed(1));
    const expectedTodayKwh = Number(telemetrySeries.reduce((sum, item) => sum + (item.expectedKw || 0), 0).toFixed(1));

    // Performance ratio calculation (Guard against missing expected yield)
    let performanceRatio = null;
    if (expectedTodayKwh > 0) {
      performanceRatio = Number(((todayYieldKwh / expectedTodayKwh) * 100).toFixed(1));
    }

    // Energy & Financial loss
    const estimatedLossKwh = Number(Math.max(0, expectedTodayKwh - todayYieldKwh).toFixed(1));
    const tariff = selectedPlant?.tariffPerKwh || 7.50;
    const financialLossInr = Number((estimatedLossKwh * tariff).toFixed(2));

    // Active Counts
    const activeFaultsCount = alerts.filter(
      (a) => a.status === 'ACTIVE' && (!a.plantId || a.plantId === selectedPlantId)
    ).length;

    const openWorkOrdersCount = workOrders.filter(
      (w) => (w.status === 'OPEN' || w.status === 'SCHEDULED' || w.status === 'IN_PROGRESS') &&
             (!w.plantId || w.plantId === selectedPlantId)
    ).length;

    return {
      currentKw,
      todayYieldKwh,
      expectedTodayKwh,
      performanceRatio,
      estimatedLossKwh,
      financialLossInr,
      activeFaultsCount,
      openWorkOrdersCount,
    };
  }, [telemetrySeries, latestTelemetry, selectedPlant, alerts, workOrders, selectedPlantId]);

  // Action: Mark Alert as Resolved
  const resolveAlert = (alertId) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: 'RESOLVED' } : a))
    );
  };

  // Action: Add new Work Order
  const addWorkOrder = (newOrder) => {
    const orderWithId = {
      ...newOrder,
      id: `WO-${Math.floor(100 + Math.random() * 900)}`,
      plantId: selectedPlantId,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };
    setWorkOrders((prev) => [orderWithId, ...prev]);
    return orderWithId;
  };

  return (
    <SolarContext.Provider
      value={{
        plants,
        selectedPlant,
        selectedPlantId,
        setSelectedPlantId,
        telemetrySeries,
        faultDistribution,
        dailyLossSeries,
        plantComparisons,
        alerts,
        diagnoses,
        workOrders,
        summaryKpis,
        latestTelemetry,
        datePreset,
        setDatePreset,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        isLiveConnected,
        systemConfig,
        setSystemConfig,
        resolveAlert,
        addWorkOrder,
      }}
    >
      {children}
    </SolarContext.Provider>
  );
};

export default SolarProvider;
