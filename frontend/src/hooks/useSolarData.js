import { useContext } from 'react';
import { SolarContext } from '../context/solarContextDef';

export const useSolarData = () => {
  const context = useContext(SolarContext);
  if (!context) {
    throw new Error('useSolarData must be used within a SolarProvider');
  }
  return context;
};

export default useSolarData;
