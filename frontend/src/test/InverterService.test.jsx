import { describe, it, expect } from 'vitest';
import { inverterService, INVERTER_STATUS_TYPES, DEMO_INVERTERS } from '../services/inverterService';

describe('InverterService Unit Tests', () => {
  it('retrieves default inverters list', async () => {
    const res = await inverterService.getInverters();
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.totalCount).toBe(DEMO_INVERTERS.length);
  });

  it('filters inverters by diagnostic status', async () => {
    const normalRes = await inverterService.getInverters({ status: INVERTER_STATUS_TYPES.NORMAL });
    expect(normalRes.items.every((inv) => inv.status === INVERTER_STATUS_TYPES.NORMAL)).toBe(true);

    const offlineRes = await inverterService.getInverters({ status: INVERTER_STATUS_TYPES.OFFLINE });
    expect(offlineRes.items.every((inv) => inv.status === INVERTER_STATUS_TYPES.OFFLINE)).toBe(true);
  });

  it('filters inverters by plant ID', async () => {
    const res = await inverterService.getInverters({ plantId: 4 });
    expect(res.items.length).toBe(2);
    expect(res.items.every((inv) => inv.plantId === 4)).toBe(true);
  });

  it('searches inverters by serial number, ID, or model', async () => {
    const resById = await inverterService.getInverters({ search: 'INV-104A' });
    expect(resById.items.length).toBe(1);
    expect(resById.items[0].id).toBe('INV-104A');

    const resByModel = await inverterService.getInverters({ search: 'Sungrow' });
    expect(resByModel.items.length).toBe(2);
  });

  it('sorts inverters by rated AC power descending', async () => {
    const res = await inverterService.getInverters({ sortBy: 'power', sortOrder: 'desc' });
    for (let i = 0; i < res.items.length - 1; i++) {
      expect(Number(res.items[i].ratedAcPowerKw)).toBeGreaterThanOrEqual(
        Number(res.items[i + 1].ratedAcPowerKw)
      );
    }
  });

  it('retrieves single inverter by ID with MPPTs, strings, and telemetry history', async () => {
    const inv = await inverterService.getInverterById('INV-104A');
    expect(inv.id).toBe('INV-104A');
    expect(inv.mpptConfiguration.length).toBe(2); // Dual MPPT
    expect(inv.telemetryHistory.length).toBeGreaterThan(0);
  });

  it('preserves null values for missing readings without replacing with zero (INV-105)', async () => {
    const inv = await inverterService.getInverterById('INV-105');
    expect(inv.temperatureC).toBeNull();
    // Verify telemetry history thermal readings are also null
    expect(inv.telemetryHistory.every((t) => t.temperatureC === null)).toBe(true);
  });

  it('throws descriptive error when querying non-existent inverter', async () => {
    await expect(inverterService.getInverterById('INV-NON-EXISTENT-999')).rejects.toThrow(/not found/i);
  });
});
