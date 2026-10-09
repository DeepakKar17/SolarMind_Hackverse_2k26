import { describe, it, expect, beforeEach } from 'vitest';
import { diagnosisService, DIAGNOSIS_ENGINE_TYPES } from '../services/diagnosisService';

describe('DiagnosisService Unit Tests', () => {
  beforeEach(() => {
    diagnosisService.resetStore();
  });

  it('retrieves default fixture diagnoses list with pagination metadata', async () => {
    const result = await diagnosisService.getDiagnoses();
    expect(result.items).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.page).toBe(1);
  });

  it('filters diagnoses by plant ID', async () => {
    const result = await diagnosisService.getDiagnoses({ plantId: '1' });
    expect(result.items.every((d) => d.plantId === 1)).toBe(true);
  });

  it('filters diagnoses by category and severity', async () => {
    const result = await diagnosisService.getDiagnoses({
      category: 'GRID_OVERVOLTAGE',
      severity: 'CRITICAL',
    });
    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe('DIAG-403');
    expect(result.items[0].severity).toBe('CRITICAL');
  });

  it('searches diagnoses across title, plant, and probable cause', async () => {
    const result = await diagnosisService.getDiagnoses({ search: 'soiling' });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].faultClass).toBe('SURFACE_SOILING');
  });

  it('correctly retrieves individual diagnosis detail by ID', async () => {
    const diag = await diagnosisService.getDiagnosisById('DIAG-401');
    expect(diag.id).toBe('DIAG-401');
    expect(diag.engineType).toBe(DIAGNOSIS_ENGINE_TYPES.ML_CLASSIFIER);
    expect(diag.confidenceScore).toBe(92.4);
    expect(diag.comparisonMetrics.length).toBeGreaterThan(0);
  });

  it('throws error when non-existent diagnosis ID is requested', async () => {
    await expect(diagnosisService.getDiagnosisById('DIAG-NONEXISTENT')).rejects.toThrow(
      'Diagnosis record with ID "DIAG-NONEXISTENT" was not found.'
    );
  });

  it('verifies deterministic rule has no probabilistic confidence score', async () => {
    const diag = await diagnosisService.getDiagnosisById('DIAG-403');
    expect(diag.engineType).toBe(DIAGNOSIS_ENGINE_TYPES.DETERMINISTIC_RULE);
    expect(diag.confidenceScore).toBeNull();
  });

  it('verifies insufficient evidence fixture preserves null and does not coerce to zero', async () => {
    const diag = await diagnosisService.getDiagnosisById('DIAG-405');
    expect(diag.hasInsufficientEvidence).toBe(true);
    expect(diag.isSuspicionOnly).toBe(true);
    expect(diag.confidenceScore).toBeNull();
    expect(diag.estimatedLostEnergyKwh).toBeNull();
    expect(diag.financialDeficitInr).toBeNull();
  });

  it('executes simulated AI analysis and appends new diagnosis', async () => {
    const result = await diagnosisService.runAnalysis({ plantId: 2 });
    expect(result.id).toMatch(/^DIAG-/);
    expect(result.plantId).toBe(2);

    const list = await diagnosisService.getDiagnoses();
    expect(list.items.some((d) => d.id === result.id)).toBe(true);
  });

  it('updates diagnosis status and records audit history', async () => {
    const updated = await diagnosisService.updateDiagnosisStatus('DIAG-401', 'RESOLVED', {
      actor: 'Test Engineer',
      note: 'Tree trimmed successfully.',
    });
    expect(updated.status).toBe('RESOLVED');
    expect(updated.history[0].action).toBe('Status changed to RESOLVED');
    expect(updated.history[0].actor).toBe('Test Engineer');
  });

  it('links work order to diagnosis and updates history', async () => {
    const updated = await diagnosisService.linkWorkOrder('DIAG-404', 'WO-999');
    expect(updated.workOrderId).toBe('WO-999');
    expect(updated.history[0].action).toBe('Work Order Linked');
  });
});
