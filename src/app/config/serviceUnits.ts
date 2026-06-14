import type { ServiceType } from '../types/emergency';

export const serviceUnitConfig: Record<ServiceType, {
  unit: string;
  prefix: string;
  baseNumber: number;
  role: string;
}> = {
  ambulance: {
    unit: 'EMT-42',
    prefix: 'EMT',
    baseNumber: 42,
    role: 'Senior Paramedic'
  },
  fire: {
    unit: 'FIRE-15',
    prefix: 'FIRE',
    baseNumber: 15,
    role: 'Fire Fighter'
  },
  police: {
    unit: 'PD-89',
    prefix: 'PD',
    baseNumber: 89,
    role: 'Police Officer'
  }
};
