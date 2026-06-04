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
  },
  {
    id: '316087',
    name: 'Jalan Raya Dayeuhkolot',
    location: 'Bandung, Jawa Barat',
    lat: -6.9566,
    lng: 107.6121,
    feedType: 'IMAGE',
    embedUrl: 'https://opencctv.org/cameras/indonesia/west-java/bandung/bandung-jalan-raya-dayeuhkolot-316087'
  },
  {
    id: '282284',
    name: 'Pasar Lembang',
    location: 'Bandung Barat, Jawa Barat',
    lat: -6.8174,
    lng: 107.6224,
    feedType: 'HLS',
    embedUrl: 'https://opencctv.org/cameras/indonesia/jawa-barat/bandung-barat/lembang-pasar-lembang-282284'
  },
  {
    id: '309862',
    name: 'Jagorawi Toll Road - Jalan Nasional 2',
    location: 'Depok, Jawa Barat',
    lat: -6.3895,
    lng: 106.8952,
    feedType: 'IMAGE',
    embedUrl: 'https://opencctv.org/cameras/indonesia/west-java/depok/depok-jagorawi-toll-road-jalan-nasional-2-309862'
  },
  {
    id: '105312',
    name: 'Jakarta Toll Camera 27+100',
    location: 'Jakarta, DKI Jakarta',
    lat: -6.161,
    lng: 106.931,
    feedType: 'HLS',
    embedUrl: 'https://opencctv.org/cameras/indonesia/dki-jakarta/jakarta/27100-105312'
  },
  {
    id: '313775',
    name: 'Bunder Gresik Toll Plaza',
    location: 'Gresik, Jawa Timur',
    lat: -7.1718,
    lng: 112.5955,
    feedType: 'IMAGE',
    embedUrl: 'https://opencctv.org/cameras/indonesia/east-java/gresik/gresik-bunder-gresik-toll-plaza-313775'
  },
  {
    id: '314945',
    name: 'Taman Exit Tol Bunder',
    location: 'Gresik, Jawa Timur',
    lat: -7.1685,
    lng: 112.5954,
    feedType: 'IMAGE',
    embedUrl: 'https://opencctv.org/cameras/indonesia/east-java/gresik/gresik-taman-exit-tol-bunder-314945'
  }
];
