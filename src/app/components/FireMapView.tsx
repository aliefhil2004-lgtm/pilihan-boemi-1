import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getReportServices, getServiceStatus, type ServiceType, type StoredEmergencyReport } from '../types/emergency';
import type { PublicCctvCamera } from '../config/cctv';
import type { LiveGpsLocation } from '../services/liveGps';
import { getVisibleDangerZones } from '../config/dangerZones';
import { getReportMarkerMeta } from '../utils/mapMarkers';

interface FireMapViewProps {
  userLocation: { lat: number; lng: number };
  reports: StoredEmergencyReport[];
  cameras: PublicCctvCamera[];
  onCameraSelect: (camera: PublicCctvCamera) => void;
  liveGpsByService: Partial<Record<ServiceType, LiveGpsLocation | null>>;
}

const serviceMarkerConfig = {
  ambulance: { symbol: '🚑', label: 'Ambulance Unit', background: '#6da5c4', fontSize: '19px' },
  fire: { symbol: '🚒', label: 'Fire Truck Unit', background: '#ea580c', fontSize: '19px' },
  police: { symbol: '🚓', label: 'Police Car Unit', background: '#2563eb', fontSize: '19px' }
};

function getPrimaryService(services: ServiceType[]): ServiceType {
  if (services.includes('fire')) return 'fire';
  if (services.includes('police')) return 'police';
  return 'ambulance';
}

function createServiceMarkerElement(service: keyof typeof serviceMarkerConfig) {
  const config = serviceMarkerConfig[service];
  return createMarkerElement(config);
}

function createMarkerElement(config: { symbol: string; label: string; background: string; fontSize?: string | number }) {
  const markerElement = document.createElement('div');
  markerElement.title = config.label;
  markerElement.setAttribute('aria-label', `${config.label} marker`);
  markerElement.style.width = '38px';
  markerElement.style.height = '38px';
  markerElement.style.display = 'flex';
  markerElement.style.alignItems = 'center';
  markerElement.style.justifyContent = 'center';
  markerElement.style.border = '3px solid white';
  markerElement.style.borderRadius = '9999px';
  markerElement.style.background = config.background;
  markerElement.style.color = 'white';
  markerElement.style.fontSize = typeof config.fontSize === 'number' ? `${config.fontSize}px` : config.fontSize ?? '20px';
  markerElement.style.fontWeight = '900';
  markerElement.style.boxShadow = '0 8px 18px rgba(0,0,0,.35)';
  markerElement.style.lineHeight = '1';
  markerElement.textContent = config.symbol;
  return markerElement;
}

function createStackedMarkerElement(
  config: { symbol: string; label: string; background: string; fontSize?: string | number },
  count: number
) {
  const markerElement = createMarkerElement(config);
  if (count <= 1) return markerElement;

  const badge = document.createElement('span');
  badge.textContent = `+${count}`;
  badge.style.position = 'absolute';
  badge.style.right = '-10px';
  badge.style.top = '-10px';
  badge.style.minWidth = '23px';
  badge.style.height = '23px';
  badge.style.padding = '0 5px';
  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.border = '2px solid white';
  badge.style.borderRadius = '9999px';
  badge.style.background = '#0c3249';
  badge.style.color = 'white';
  badge.style.fontSize = '10px';
  badge.style.fontWeight = '900';
  badge.style.lineHeight = '1';
  badge.style.boxShadow = '0 4px 10px rgba(0,0,0,.28)';
  markerElement.style.position = 'relative';
  markerElement.appendChild(badge);
  return markerElement;
}

function coordinateKey(coords: { lat: number; lng: number }) {
  return `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
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
    const wobble = 0.78 + seededNoise(seed, i) * 0.24 + Math.sin(angle * 3 + seededNoise(seed, 5) * Math.PI) * 0.06;
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

export function FireMapView({ userLocation, reports, cameras, onCameraSelect, liveGpsByService }: FireMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const tomtomApiKey = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
  const liveServiceLocations = useMemo(
    () => (Object.values(liveGpsByService).filter(Boolean) as LiveGpsLocation[]),
    [liveGpsByService]
  );

  useEffect(() => {
    if (!mapContainer.current) return;

    setMapReady(false);

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: [userLocation.lng, userLocation.lat],
      zoom: 10,
      preserveDrawingBuffer: true,
    });

    const bounds = new maplibregl.LngLatBounds().extend([userLocation.lng, userLocation.lat]);
    const reportPoints = reports.map((report, index) => {
      const fallbackOffset = ((index % 7) + 1) * 0.006;
      const coords = report.coords ?? {
        lat: userLocation.lat + (index % 2 === 0 ? fallbackOffset : -fallbackOffset),
        lng: userLocation.lng + (index % 3 === 0 ? fallbackOffset : -fallbackOffset)
      };
      const services = getReportServices(report);
      const hasDangerZoneService = services.some(service =>
        (service === 'fire' || service === 'police') &&
        !['resolved', 'done', 'declined'].includes(getServiceStatus(report, service))
      );
      const zones = hasDangerZoneService ? getVisibleDangerZones(report.injuryScale) : [];
      return { report, coords, services, zones };
    });
    const reportGroups = [...reportPoints.reduce((groups, point) => {
      const key = coordinateKey(point.coords);
      const existing = groups.get(key);
      if (existing) {
        existing.points.push(point);
      } else {
        groups.set(key, { coords: point.coords, points: [point] });
      }
      return groups;
    }, new Map<string, { coords: { lat: number; lng: number }; points: typeof reportPoints }>()).values()];

    const failSafe = window.setTimeout(() => setMapReady(true), 5000);

    map.once('load', () => {
      map.resize();

      if (tomtomApiKey) {
        map.addSource('traffic-flow', {
          type: 'raster',
          tiles: [`https://api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key=${tomtomApiKey}`],
          tileSize: 256
        });

        map.addLayer({
          id: 'traffic-flow',
          type: 'raster',
          source: 'traffic-flow',
          paint: { 'raster-opacity': 0.78 }
        });
      }

      const dangerZones = {
        type: 'FeatureCollection' as const,
        features: reportPoints.flatMap(({ report, coords, services, zones }) => zones.map((zone, zoneIndex) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [createAreaPolygon(coords.lng, coords.lat, zone.radiusMeters, `${report.id}-${zone.label}`)]
          },
          properties: {
            id: `${report.id}-${zoneIndex}`,
            reportId: report.id,
            title: report.emergencyType ?? 'Emergency Report',
            location: report.location,
            priority: report.injuryScale,
            services: services.join(', '),
            level: zone.label,
            color: zone.color,
            stroke: zone.stroke,
            radiusMeters: zone.radiusMeters
          }
        })))
      };

      map.addSource('danger-zones', { type: 'geojson', data: dangerZones });
      map.addLayer({
        id: 'danger-zone-fill',
        type: 'fill',
        source: 'danger-zones',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 }
      });
      map.addLayer({
        id: 'danger-zone-outline',
        type: 'line',
        source: 'danger-zones',
        paint: { 'line-color': ['get', 'stroke'], 'line-width': 2.5, 'line-opacity': 0.78 }
      });

      if (liveServiceLocations.length) {
        liveServiceLocations.forEach(location => {
          new maplibregl.Marker({ element: createServiceMarkerElement(location.service) })
            .setLngLat([location.lng, location.lat])
            .setPopup(new maplibregl.Popup({ offset: 18 }).setText(`${location.service.toUpperCase()} ${location.unit} live GPS`))
            .addTo(map);
          bounds.extend([location.lng, location.lat]);
        });
      }

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

        new maplibregl.Popup({ offset: 14 }).setLngLat(event.lngLat).setDOMContent(popup).addTo(map);
      });

      map.on('mouseenter', 'danger-zone-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'danger-zone-fill', () => { map.getCanvas().style.cursor = ''; });

      reportGroups.forEach(({ coords, points }) => {
        const firstPoint = points[0];
        const primaryService = getPrimaryService(firstPoint.services);
        const popup = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = points.length > 1 ? `${points.length} reports at this location` : firstPoint.report.emergencyType ?? 'Emergency Report';
        popup.append(title, document.createElement('br'));
        points.forEach((point, index) => {
          if (points.length > 1) {
            popup.append(`${index + 1}. ${point.report.emergencyType ?? 'Emergency Report'}`, document.createElement('br'));
          }
          popup.append(point.report.location, document.createElement('br'));
          popup.append(`Priority: ${point.report.injuryScale}/10`, document.createElement('br'));
          if (point.zones.length) {
            const zone = point.zones[point.zones.length - 1];
            popup.append(`Main zone: ${zone.label} (${zone.radiusMeters}m)`, document.createElement('br'));
            if (point.zones.length > 1) popup.append(`Caution perimeter: ${point.zones[0].radiusMeters}m`, document.createElement('br'));
          } else {
            popup.append('Danger zone: none for medical-only reports', document.createElement('br'));
          }
          popup.append(`Services: ${point.services.join(', ')}`);
          if (index < points.length - 1) popup.append(document.createElement('hr'));
        });

        new maplibregl.Marker({ element: createStackedMarkerElement(getReportMarkerMeta(firstPoint.report, primaryService), points.length) })
          .setLngLat([coords.lng, coords.lat])
          .setPopup(new maplibregl.Popup({ offset: 20 }).setDOMContent(popup))
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
      setMapReady(true);
    });

    map.once('error', () => setMapReady(true));

    return () => {
      window.clearTimeout(failSafe);
      map.remove();
    };
  }, [cameras, liveServiceLocations, onCameraSelect, reports, tomtomApiKey, userLocation]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.18),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.16),transparent_24%),linear-gradient(180deg,#0f172a_0%,#111827_100%)]" />
      <div ref={mapContainer} className="h-full w-full" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 text-white">
          <div className="rounded-lg bg-slate-900/90 px-4 py-3 text-sm font-medium shadow-lg">
            Loading danger map...
          </div>
        </div>
      )}
    </div>
  );
}
