import type { ServiceType } from '../types/emergency';

export function getServiceDisplayLabel(
  service: ServiceType,
  context = ''
) {
  const normalized = context.toLowerCase();

  if (service === 'ambulance') return 'Medic';

  if (service === 'fire') {
    if (/animal rescue|firefighter - animal rescue|small dangerous animal|hewan kecil|ular|snake|musang|civet|anjing galak|aggressive dog|sarang tawon|wasp nest/i.test(normalized)) {
      return 'Fire-Animal Rescue';
    }
    return 'Fire Fighter';
  }

  if (/police ranger|large dangerous animal|hewan buas besar|hewan liar besar|predator besar|buaya|crocodile|harimau|tiger|beruang|bear|komodo/i.test(normalized)) {
    return 'Police-Ranger';
  }

  return 'Police';
}
