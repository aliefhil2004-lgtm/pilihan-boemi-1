export interface PublicCctvCamera {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  feedType: 'HLS' | 'IMAGE';
  embedUrl: string;
}

export const indonesiaPublicCctv: PublicCctvCamera[] = [
  {
    id: '332891',
    name: 'Dalam Kaum Pedestrian 02',
    location: 'Bandung, Jawa Barat',
    lat: -6.9225,
    lng: 107.6065,
    feedType: 'HLS',
    embedUrl: 'https://opencctv.org/cameras/indonesia/jawa-barat/bandung/cctv-dalam-kaum-pedestrian-02-332891'
  },
  {
    id: '316359',
    name: 'Jalan Soekarno Hatta',
    location: 'Bandung, Jawa Barat',
    lat: -6.9471,
    lng: 107.593,
    feedType: 'IMAGE',
    embedUrl: 'https://opencctv.org/cameras/indonesia/west-java/bandung/bandung-jalan-soekarno-hatta-316359'
  },
  {
    id: '317236',
    name: 'Jalan Lemahnendeut - Surya Sumantri',
    location: 'Cimahi, Jawa Barat',
    lat: -6.8828,
    lng: 107.5816,
    feedType: 'IMAGE',
    embedUrl: 'https://opencctv.org/cameras/indonesia/west-java/cimahi/cimahi-jalan-lemahnendeut-jalan-surya-sumantri-317236'
  }
];
