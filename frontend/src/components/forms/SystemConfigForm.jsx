import { useState } from 'react';
import { Settings, Save, Check } from 'lucide-react';
import { useSolarData } from '../../hooks/useSolarData';

export const SystemConfigForm = () => {
  const { systemConfig } = useSolarData();
  const [formData, setFormData] = useState({
    systemName: systemConfig?.systemName || 'Single-String Array #1',
    ratedPowerKw: systemConfig?.ratedPowerKw || 5.4,
    panelCount: systemConfig?.panelCount || 12,
    panelWattage: systemConfig?.panelWattage || 450,
    tariffPerKwh: systemConfig?.tariffPerKwh || 7.50,
    tiltAngle: systemConfig?.tiltAngle || 18,
    azimuthAngle: systemConfig?.azimuthAngle || 180,
  });
  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: Number(value) || value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-6)' }}>
        <Settings size={20} color="var(--color-solar-primary)" />
        <h3 style={{ fontSize: 'var(--font-size-xl)' }}>Single-String Installation Parameters</h3>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              System Name
            </label>
            <input
              type="text"
              name="systemName"
              value={formData.systemName}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Rated Power (kW)
            </label>
            <input
              type="number"
              step="0.1"
              name="ratedPowerKw"
              value={formData.ratedPowerKw}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Panel Count
            </label>
            <input
              type="number"
              name="panelCount"
              value={formData.panelCount}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Electricity Tariff ($ / kWh)
            </label>
            <input
              type="number"
              step="0.01"
              name="tariffPerKwh"
              value={formData.tariffPerKwh}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
          <button type="submit" className="btn btn-primary">
            {saved ? <Check size={16} /> : <Save size={16} />}
            <span>{saved ? 'Saved Successfully' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default SystemConfigForm;
