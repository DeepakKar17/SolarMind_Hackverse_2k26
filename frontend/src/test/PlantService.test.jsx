import { describe, it, expect, beforeEach } from 'vitest';
import { plantService, validatePlantInput, PLANT_SYSTEM_TYPES } from '../services/plantService';

describe('PlantService & Validation Unit Tests', () => {
  beforeEach(() => {
    plantService.resetStore();
  });

  describe('validatePlantInput', () => {
    it('rejects empty or missing plant name', () => {
      const res = validatePlantInput({ name: '' });
      expect(res.isValid).toBe(false);
      expect(res.errors.name).toBeDefined();
    });

    it('rejects short plant name (< 3 chars)', () => {
      const res = validatePlantInput({ name: 'AB' });
      expect(res.isValid).toBe(false);
      expect(res.errors.name).toMatch(/at least 3 characters/i);
    });

    it('rejects non-positive installed capacity', () => {
      const res = validatePlantInput({
        name: 'Test Array',
        location: 'Bengaluru',
        systemType: PLANT_SYSTEM_TYPES[0],
        installedCapacityKwp: 0,
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.installedCapacityKwp).toMatch(/greater than 0/i);
    });

    it('rejects invalid panel count (0 or negative or non-integer)', () => {
      const res = validatePlantInput({
        name: 'Test Array',
        location: 'Bengaluru',
        systemType: PLANT_SYSTEM_TYPES[0],
        installedCapacityKwp: 5.0,
        panelCount: -2,
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.panelCount).toBeDefined();
    });

    it('rejects out-of-range panel wattage (<50W or >800W)', () => {
      const resLow = validatePlantInput({
        name: 'Test Array',
        location: 'Bengaluru',
        systemType: PLANT_SYSTEM_TYPES[0],
        installedCapacityKwp: 5.0,
        panelCount: 10,
        panelWattage: 20,
      });
      expect(resLow.isValid).toBe(false);
      expect(resLow.errors.panelWattage).toMatch(/between 50W and 800W/i);
    });

    it('rejects negative tariff rate', () => {
      const res = validatePlantInput({
        name: 'Test Array',
        location: 'Bengaluru',
        systemType: PLANT_SYSTEM_TYPES[0],
        installedCapacityKwp: 5.0,
        panelCount: 10,
        panelWattage: 500,
        inverterModel: 'SolarMind 5kW',
        tariffPerKwh: -5,
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.tariffPerKwh).toMatch(/cannot be negative/i);
    });

    it('rejects out-of-range latitude (> 90 or < -90)', () => {
      const res = validatePlantInput({
        name: 'Test Array',
        location: 'Bengaluru',
        systemType: PLANT_SYSTEM_TYPES[0],
        installedCapacityKwp: 5.0,
        panelCount: 10,
        panelWattage: 500,
        inverterModel: 'SolarMind 5kW',
        tariffPerKwh: 7.50,
        latitude: 105.5,
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.latitude).toBeDefined();
    });

    it('accepts completely valid plant payload', () => {
      const res = validatePlantInput({
        name: 'Valid Rooftop Plant Alpha',
        location: 'Bengaluru, Karnataka',
        systemType: PLANT_SYSTEM_TYPES[0],
        installedCapacityKwp: 5.4,
        panelCount: 12,
        panelWattage: 450,
        inverterModel: 'SolarMind 5kW Single-Phase',
        inverterCount: 1,
        tariffPerKwh: 7.50,
        tiltAngle: 18,
        azimuthAngle: 180,
        latitude: 12.9716,
        longitude: 77.5946,
      });
      expect(res.isValid).toBe(true);
      expect(Object.keys(res.errors)).toHaveLength(0);
    });
  });

  describe('plantService CRUD and Queries', () => {
    it('retrieves default plants list', async () => {
      const res = await plantService.getPlants();
      expect(res.items.length).toBeGreaterThan(0);
      expect(res.totalCount).toBeGreaterThan(0);
    });

    it('filters plants by operational status', async () => {
      const resOnline = await plantService.getPlants({ status: 'ONLINE' });
      expect(resOnline.items.every((p) => p.status === 'ONLINE')).toBe(true);

      const resWarning = await plantService.getPlants({ status: 'WARNING' });
      expect(resWarning.items.every((p) => p.status === 'WARNING')).toBe(true);
    });

    it('searches plants by name or identifier code', async () => {
      const resByName = await plantService.getPlants({ search: 'Residential' });
      expect(resByName.items.length).toBeGreaterThan(0);
      expect(resByName.items[0].name).toMatch(/Residential/i);

      const resByCode = await plantService.getPlants({ search: 'PLANT-102' });
      expect(resByCode.items.length).toBe(1);
      expect(resByCode.items[0].id).toBe(2);
    });

    it('sorts plants by capacity descending', async () => {
      const res = await plantService.getPlants({ sortBy: 'installedCapacityKwp', sortOrder: 'desc' });
      for (let i = 0; i < res.items.length - 1; i++) {
        expect(Number(res.items[i].installedCapacityKwp)).toBeGreaterThanOrEqual(
          Number(res.items[i + 1].installedCapacityKwp)
        );
      }
    });

    it('retrieves detailed plant by ID including inverters, telemetry, alerts', async () => {
      const plant = await plantService.getPlantById(1);
      expect(plant.id).toBe(1);
      expect(plant.inverters).toBeDefined();
      expect(plant.inverters.length).toBeGreaterThan(0);
      expect(plant.telemetrySeries).toBeDefined();
      expect(plant.alerts).toBeDefined();
    });

    it('throws error when querying non-existent plant ID', async () => {
      await expect(plantService.getPlantById(99999)).rejects.toThrow(/not found/i);
    });

    it('creates a new plant and retrieves it in the list', async () => {
      const newPlant = await plantService.createPlant({
        name: 'New Greenfield Array X',
        location: 'Jaipur, Rajasthan',
        systemType: PLANT_SYSTEM_TYPES[0],
        installedCapacityKwp: 7.2,
        panelCount: 16,
        panelWattage: 450,
        inverterModel: 'SolarMind 7.5kW Inverter',
        inverterCount: 1,
        tariffPerKwh: 6.50,
      });

      expect(newPlant.id).toBeDefined();
      expect(newPlant.name).toBe('New Greenfield Array X');

      const found = await plantService.getPlantById(newPlant.id);
      expect(found.name).toBe('New Greenfield Array X');
    });

    it('updates an existing plant', async () => {
      const updated = await plantService.updatePlant(1, {
        name: 'Updated Residential Alpha',
        location: 'Bengaluru Urban',
        systemType: PLANT_SYSTEM_TYPES[0],
        installedCapacityKwp: 5.8,
        panelCount: 13,
        panelWattage: 450,
        inverterModel: 'SolarMind 6kW Inverter',
        tariffPerKwh: 8.00,
      });

      expect(updated.name).toBe('Updated Residential Alpha');
      expect(updated.installedCapacityKwp).toBe(5.8);

      const verified = await plantService.getPlantById(1);
      expect(verified.name).toBe('Updated Residential Alpha');
    });
  });
});
