import type { ServiceType } from '../types/emergency';

export const citizenContactNumber = '+6212345678912';

export const serviceContactNumbers: Record<ServiceType, string> = {
  ambulance: '+628111400014',
  fire: '+628111500015',
  police: '+628111800089'
};

export function getServiceContactNumber(serviceType: ServiceType) {
  return serviceContactNumbers[serviceType];
}
