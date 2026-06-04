import type { ServiceType } from '../types/emergency';

export type AseanCountryCode = 'BN' | 'KH' | 'ID' | 'LA' | 'MY' | 'MM' | 'PH' | 'SG' | 'TH' | 'TL' | 'VN';

export interface AseanCountry {
  code: AseanCountryCode;
  name: string;
  flag: string;
  phonePlaceholder: string;
  center: { address: string; lat: number; lng: number };
  emergency: Record<ServiceType, string>;
  cities: Array<{ name: string; region: string; lat: number; lng: number }>;
}

export const ASEAN_COUNTRIES: AseanCountry[] = [
  { code: 'BN', name: 'Brunei Darussalam', flag: '🇧🇳', phonePlaceholder: '+673 8XX XXXX', center: { address: 'Bandar Seri Begawan, Brunei-Muara, Brunei Darussalam', lat: 4.9031, lng: 114.9398 }, emergency: { ambulance: '991', fire: '995', police: '993' }, cities: [{ name: 'Bandar Seri Begawan', region: 'Brunei-Muara', lat: 4.9031, lng: 114.9398 }, { name: 'Kuala Belait', region: 'Belait', lat: 4.5836, lng: 114.1815 }] },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭', phonePlaceholder: '+855 XX XXX XXX', center: { address: 'Phnom Penh, Phnom Penh, Cambodia', lat: 11.5564, lng: 104.9282 }, emergency: { ambulance: '119', fire: '118', police: '117' }, cities: [{ name: 'Phnom Penh', region: 'Phnom Penh', lat: 11.5564, lng: 104.9282 }, { name: 'Siem Reap', region: 'Siem Reap', lat: 13.3633, lng: 103.8564 }] },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', phonePlaceholder: '+62 812-3456-7890', center: { address: 'Jakarta, DKI Jakarta, Indonesia', lat: -6.2088, lng: 106.8456 }, emergency: { ambulance: '112', fire: '112', police: '112' }, cities: [{ name: 'Jakarta', region: 'DKI Jakarta', lat: -6.2088, lng: 106.8456 }, { name: 'Surabaya', region: 'East Java', lat: -7.2575, lng: 112.7521 }, { name: 'Bandung', region: 'West Java', lat: -6.9175, lng: 107.6191 }, { name: 'Medan', region: 'North Sumatra', lat: 3.5952, lng: 98.6722 }, { name: 'Denpasar', region: 'Bali', lat: -8.6705, lng: 115.2126 }] },
  { code: 'LA', name: 'Lao PDR', flag: '🇱🇦', phonePlaceholder: '+856 20 XXXX XXXX', center: { address: 'Vientiane, Vientiane Prefecture, Lao PDR', lat: 17.9757, lng: 102.6331 }, emergency: { ambulance: '1623', fire: '1191', police: '1191' }, cities: [{ name: 'Vientiane', region: 'Vientiane Prefecture', lat: 17.9757, lng: 102.6331 }, { name: 'Luang Prabang', region: 'Luang Prabang', lat: 19.8834, lng: 102.1347 }] },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', phonePlaceholder: '+60 1X-XXX XXXX', center: { address: 'Kuala Lumpur, Federal Territory, Malaysia', lat: 3.139, lng: 101.6869 }, emergency: { ambulance: '999', fire: '999', police: '999' }, cities: [{ name: 'Kuala Lumpur', region: 'Federal Territory', lat: 3.139, lng: 101.6869 }, { name: 'George Town', region: 'Penang', lat: 5.4141, lng: 100.3288 }, { name: 'Johor Bahru', region: 'Johor', lat: 1.4927, lng: 103.7414 }] },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲', phonePlaceholder: '+95 9 XXX XXX XXX', center: { address: 'Yangon, Yangon Region, Myanmar', lat: 16.8409, lng: 96.1735 }, emergency: { ambulance: '192', fire: '191', police: '199' }, cities: [{ name: 'Yangon', region: 'Yangon Region', lat: 16.8409, lng: 96.1735 }, { name: 'Mandalay', region: 'Mandalay Region', lat: 21.9588, lng: 96.0891 }] },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', phonePlaceholder: '+63 9XX XXX XXXX', center: { address: 'Manila, Metro Manila, Philippines', lat: 14.5995, lng: 120.9842 }, emergency: { ambulance: '911', fire: '911', police: '911' }, cities: [{ name: 'Manila', region: 'Metro Manila', lat: 14.5995, lng: 120.9842 }, { name: 'Cebu City', region: 'Central Visayas', lat: 10.3157, lng: 123.8854 }, { name: 'Davao City', region: 'Davao Region', lat: 7.1907, lng: 125.4553 }] },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', phonePlaceholder: '+65 XXXX XXXX', center: { address: 'Singapore, Singapore', lat: 1.3521, lng: 103.8198 }, emergency: { ambulance: '995', fire: '995', police: '999' }, cities: [{ name: 'Singapore', region: 'Central Region', lat: 1.3521, lng: 103.8198 }] },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', phonePlaceholder: '+66 XX XXX XXXX', center: { address: 'Bangkok, Bangkok, Thailand', lat: 13.7563, lng: 100.5018 }, emergency: { ambulance: '1669', fire: '199', police: '191' }, cities: [{ name: 'Bangkok', region: 'Bangkok', lat: 13.7563, lng: 100.5018 }, { name: 'Chiang Mai', region: 'Chiang Mai', lat: 18.7883, lng: 98.9853 }, { name: 'Phuket', region: 'Phuket', lat: 7.8804, lng: 98.3923 }] },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱', phonePlaceholder: '+670 XXX XXXX', center: { address: 'Dili, Dili Municipality, Timor-Leste', lat: -8.5569, lng: 125.5603 }, emergency: { ambulance: '110', fire: '115', police: '112' }, cities: [{ name: 'Dili', region: 'Dili Municipality', lat: -8.5569, lng: 125.5603 }, { name: 'Baucau', region: 'Baucau Municipality', lat: -8.4711, lng: 126.4583 }] },
  { code: 'VN', name: 'Viet Nam', flag: '🇻🇳', phonePlaceholder: '+84 XX XXX XXXX', center: { address: 'Ha Noi, Ha Noi, Viet Nam', lat: 21.0278, lng: 105.8342 }, emergency: { ambulance: '115', fire: '114', police: '113' }, cities: [{ name: 'Ha Noi', region: 'Ha Noi', lat: 21.0278, lng: 105.8342 }, { name: 'Ho Chi Minh City', region: 'Ho Chi Minh City', lat: 10.8231, lng: 106.6297 }, { name: 'Da Nang', region: 'Da Nang', lat: 16.0544, lng: 108.2022 }] }
];

export function getAseanCountry(code: AseanCountryCode) {
  return ASEAN_COUNTRIES.find(country => country.code === code) ?? ASEAN_COUNTRIES[2];
}
