import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getReportServices, type StoredEmergencyReport } from '../types/emergency';
import type { PublicCctvCamera } from '../config/cctv';

interface FireMapViewProps {
  userLocation: { lat: number; lng: number };
  reports: StoredEmergencyReport[];
  cameras: PublicCctvCamera[];
  onCameraSelect: (camera: PublicCctvCamera) => void;
}

const serviceMarkerConfig = {
  ambulance: { symbol: '+', label: 'Medical', background: '#dc2626' },
  fire: { symbol: '🔥', label: 'Fire', background: '#ea580c' },
  police: { symbol: '🦹', label: 'Crime', background: '#4f46e5' }
};

function createServiceMarkerElement(service: keyof typeof serviceMarkerConfig) {
  const config = serviceMarkerConfig[service];
  const markerElement = document.createElement('div');
  markerElement.title = `${config.label} emergency`;
  markerElement.setAttribute('aria-label', `${config.label} emergency marker`);
  markerElement.style.width = '38px';
  markerElement.style.height = '38px';
  markerElement.style.display = 'flex';
  markerElement.style.alignItems = 'center';
  markerElement.style.justifyContent = 'center';
  markerElement.style.border = '3px solid white';
  markerElement.style.borderRadius = '9999px';
  markerElement.style.background = config.background;
  markerElement.style.color = 'white';
  markerElement.style.fontSize = service === 'ambulance' ? '26px' : '20px';
  markerElement.style.fontWeight = '900';
  markerElement.style.boxShadow = '0 8px 18px rgba(0,0,0,.35)';
  markerElement.style.lineHeight = '1';
  markerElement.textContent = config.symbol;
  return markerElement;
}

function seededNoise(seed: string, index: number) {
  let hash = 0;
  const input = `${seed}-${index}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(i) | 0;
  }
  return ((Math.sin(hash) + 1) / 2);
}

function createAreaPolygon(lng: number, lat: number, radiusMeters: number, seed: string, steps = 18) {
  const earthRadiusMeters = 6371008.8;
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180;
  const coordinates: [number, number][] = [];
  const stretch = 1.18 + seededNoise(seed, 99) * 0.34;
  const rotation = seededNoise(seed, 77) * Math.PI;

  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    const wobble =
      0.78 +
      seededNoise(seed, i) * 0.24 +
      Math.sin(angle * 3 + seededNoise(seed, 5) * Math.PI) * 0.06;
    const xScale = 1 + (stretch - 1) * Math.cos(angle - rotation);
    const distance = (radiusMeters * wobble * xScale) / earthRadiusMeters;
    const bearing = angle + rotation * 0.12;
    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(distance) +
      Math.cos(latRad) * Math.sin(distance) * Math.cos(bearing)
    );
    const pointLng = lngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(distance) * Math.cos(latRad),
      Math.cos(distance) - Math.sin(latRad) * Math.sin(pointLat)
    );
    coordinates.push([pointLng * 180 / Math.PI, pointLat * 180 / Math.PI]);
  }

  return coordinates;
}

export function FireMapView({
  userLocation,
  reports,
  cameras,
  onCameraSelect,
}: FireMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const tomtomApiKey = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm'
    }
  ]
},
      center: [userLocation.lng, userLocation.lat],
      zoom: 10,
    });

    new maplibregl.Marker({ color: '#2563eb' })
      .setLngLat([
        userLocation.lng,
        userLocation.lat,
      ])
      .setPopup(
        new maplibregl.Popup().setText(
          'Command Center Location'
        )
      )
      .addTo(map);

    const getDangerZones = (scale: number) => {
      if (scale >= 8) return [
        { level: 'Yellow Caution Perimeter', color: '#eab308', stroke: '#a16207', radiusMeters: 230 },
        { level: 'Critical Zone', color: '#dc2626', stroke: '#991b1b', radiusMeters: 115 }
      ];
      if (scale >= 6) return [
        { level: 'Yellow Caution Perimeter', color: '#eab308', stroke: '#a16207', radiusMeters: 190 },
        { level: 'High Risk Zone', color: '#f97316', stroke: '#c2410c', radiusMeters: 95 }
      ];
      if (scale >= 3) return [
        { level: 'Yellow Caution Zone', color: '#eab308', stroke: '#a16207', radiusMeters: 130 }
      ];
      return [
        { level: 'Watch Zone', color: '#22c55e', stroke: '#15803d', radiusMeters: 70 }
      ];
    };
    const bounds = new maplibregl.LngLatBounds()
      .extend([userLocation.lng, userLocation.lat]);
    const reportPoints = reports.map((report, index) => {
      const fallbackOffset = ((index % 7) + 1) * 0.006;
      const coords = report.coords ?? {
        lat: userLocation.lat + (index % 2 === 0 ? fallbackOffset : -fallbackOffset),
        lng: userLocation.lng + (index % 3 === 0 ? fallbackOffset : -fallbackOffset)
      };
      const services = getReportServices(report);
      const zones = getDangerZones(report.injuryScale);
      return { report, coords, services, zones };
    });

    map.on('load', () => {
      if (tomtomApiKey) {
        map.addSource('traffic-flow', {
          type: 'raster',
          tiles: [
            `https://api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key=${tomtomApiKey}`
          ],
          tileSize: 256
        });

        map.addLayer({
          id: 'traffic-flow',
          type: 'raster',
          source: 'traffic-flow',
          paint: {
            'raster-opacity': 0.78
          }
        });
      }

      const dangerZones = {
        type: 'FeatureCollection' as const,
        features: reportPoints.flatMap(({ report, coords, services, zones }) => zones.map((zone, zoneIndex) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [createAreaPolygon(coords.lng, coords.lat, zone.radiusMeters, `${report.id}-${zone.level}`)]
          },
          properties: {
            id: `${report.id}-${zoneIndex}`,
            reportId: report.id,
            title: report.emergencyType ?? 'Emergency Report',
            location: report.location,
            priority: report.injuryScale,
            services: services.join(', '),
            level: zone.level,
            color: zone.color,
            stroke: zone.stroke,
            radiusMeters: zone.radiusMeters
          }
        })))
      };

      map.addSource('danger-zones', {
        type: 'geojson',
        data: dangerZones
      });

      map.addLayer({
        id: 'danger-zone-fill',
        type: 'fill',
        source: 'danger-zones',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.18
        }
      });

      map.addLayer({
        id: 'danger-zone-outline',
        type: 'line',
        source: 'danger-zones',
        paint: {
          'line-color': ['get', 'stroke'],
          'line-width': 2.5,
          'line-opacity': 0.78
        }
      });

      map.on('click', 'danger-zone-fill', (event) => {
        const feature = event.features?.[0];
        if (!feature?.properties) return;

        const popup = document.createElement('div');
        const level = document.createElement('strong');
        level.textContent = feature.properties.level;
        popup.append(level, document.createElement('br'));
        popup.append(feature.properties.title, document.createElement('br'));
        popup.append(feature.properties.location, document.createElement('br'));
        popup.append(`Priority: ${feature.properties.priority}/10`, document.createElement('br'));
        popup.append(`Radius: ${feature.properties.radiusMeters}m`, document.createElement('br'));
        popup.append(`Services: ${feature.properties.services}`);

        new maplibregl.Popup({ offset: 14 })
          .setLngLat(event.lngLat)
          .setDOMContent(popup)
          .addTo(map);
      });

      map.on('mouseenter', 'danger-zone-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'danger-zone-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    reportPoints.forEach(({ report, coords, services, zones }) => {
      const primaryService = services[0];
      const primaryZone = zones[zones.length - 1];
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = report.emergencyType ?? 'Emergency Report';
      popup.append(title, document.createElement('br'));
      popup.append(report.location, document.createElement('br'));
      popup.append(`Priority: ${report.injuryScale}/10`, document.createElement('br'));
      popup.append(`Main zone: ${primaryZone.level} (${primaryZone.radiusMeters}m)`, document.createElement('br'));
      if (zones.length > 1) {
        popup.append(`Caution perimeter: ${zones[0].radiusMeters}m`, document.createElement('br'));
      }
      popup.append(`Services: ${services.join(', ')}`);

      new maplibregl.Marker({ element: createServiceMarkerElement(primaryService) })
        .setLngLat([coords.lng, coords.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setDOMContent(popup)
        )
        .addTo(map);
      bounds.extend([coords.lng, coords.lat]);
    });

    cameras.forEach(camera => {
      const markerElement = document.createElement('button');
      markerElement.type = 'button';
      markerElement.title = `Open CCTV: ${camera.name}`;
      markerElement.className = 'flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-sm shadow-lg';
      markerElement.textContent = 'C';
      markerElement.addEventListener('click', () => onCameraSelect(camera));

      new maplibregl.Marker({ element: markerElement })
        .setLngLat([camera.lng, camera.lat])
        .setPopup(new maplibregl.Popup({ offset: 20 }).setText(`${camera.name} - OpenCCTV ${camera.feedType}`))
        .addTo(map);
      bounds.extend([camera.lng, camera.lat]);
    });

    if (reports.length || cameras.length) map.fitBounds(bounds, { padding: 60, maxZoom: 14 });

    return () => map.remove();
  }, [cameras, onCameraSelect, reports, tomtomApiKey, userLocation]);

  return (
  <div
    ref={mapContainer}
    className="w-full h-full"
  />
);
}
