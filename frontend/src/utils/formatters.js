/**
 * SolarMind Robust Number & Date Formatters
 * Handles missing inputs, undefined values, and edge cases gracefully.
 */

/**
 * Formats power in kW
 */
export const formatPower = (kw, decimals = 2, fallback = '-- kW') => {
  if (kw === undefined || kw === null || isNaN(kw)) return fallback;
  return `${Number(kw).toFixed(decimals)} kW`;
};

/**
 * Formats energy in kWh
 */
export const formatEnergy = (kwh, decimals = 1, fallback = '-- kWh') => {
  if (kwh === undefined || kwh === null || isNaN(kwh)) return fallback;
  return `${Number(kwh).toFixed(decimals)} kWh`;
};

/**
 * Formats nominal plant capacity in kWp
 */
export const formatCapacity = (kwp, decimals = 1, fallback = '-- kWp') => {
  if (kwp === undefined || kwp === null || isNaN(kwp)) return fallback;
  return `${Number(kwp).toFixed(decimals)} kWp`;
};

/**
 * Formats currency (default INR ₹, or specified ISO code)
 */
export const formatCurrency = (amount, currency = 'INR', fallback = '₹ 0.00') => {
  if (amount === undefined || amount === null || isNaN(amount)) return fallback;
  const num = Number(amount);
  
  if (currency === 'INR') {
    return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
};

/**
 * Formats percentage
 */
export const formatPercent = (val, decimals = 1, fallback = 'N/A') => {
  if (val === undefined || val === null || isNaN(val)) return fallback;
  return `${Number(val).toFixed(decimals)}%`;
};

/**
 * Formats ISO timestamp to human-readable date & time
 */
export const formatDateTime = (isoString, fallback = 'Unknown Date') => {
  if (!isoString) return fallback;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback;
  }
};

/**
 * Formats relative time (e.g., 'Just now', '5 mins ago', '2 hours ago')
 */
export const formatRelativeTime = (isoString, fallback = 'Recently') => {
  if (!isoString) return fallback;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return fallback;
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    return `${Math.floor(diffSec / 86400)} days ago`;
  } catch {
    return fallback;
  }
};

/**
 * Formats electrical voltage in Volts (V)
 */
export const formatVoltage = (v, decimals = 1, fallback = '-- V') => {
  if (v === undefined || v === null || isNaN(v)) return fallback;
  return `${Number(v).toFixed(decimals)} V`;
};

/**
 * Formats electrical current in Amperes (A)
 */
export const formatCurrent = (a, decimals = 2, fallback = '-- A') => {
  if (a === undefined || a === null || isNaN(a)) return fallback;
  return `${Number(a).toFixed(decimals)} A`;
};

/**
 * Formats solar POA irradiance in W/m²
 */
export const formatIrradiance = (wm2, decimals = 0, fallback = '-- W/m²') => {
  if (wm2 === undefined || wm2 === null || isNaN(wm2)) return fallback;
  return `${Number(wm2).toFixed(decimals)} W/m²`;
};
