import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getReportServices, type StoredEmergencyReport } from '../types/emergency';

interface FireMapViewProps {
  userLocation: { lat: number; lng: number };
  reports: StoredEmergencyReport[];
}

export function FireMapView({
  userLocation,
  reports,
}: FireMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);

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

    const markerColors = {
      ambulance: '#3b82f6',
      fire: '#f97316',
      police: '#6366f1'
    };
    const bounds = new maplibregl.LngLatBounds()
      .extend([userLocation.lng, userLocation.lat]);

    reports.forEach((report, index) => {
      const services = getReportServices(report);
      const primaryService = services[0];
      const fallbackOffset = ((index % 7) + 1) * 0.006;
      const coords = report.coords ?? {
        lat: userLocation.lat + (index % 2 === 0 ? fallbackOffset : -fallbackOffset),
        lng: userLocation.lng + (index % 3 === 0 ? fallbackOffset : -fallbackOffset)
      };
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = report.emergencyType ?? 'Emergency Report';
      popup.append(title, document.createElement('br'));
      popup.append(report.location, document.createElement('br'));
      popup.append(`Priority: ${report.injuryScale}/10`, document.createElement('br'));
      popup.append(`Services: ${services.join(', ')}`);

      new maplibregl.Marker({ color: markerColors[primaryService] })
        .setLngLat([coords.lng, coords.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setDOMContent(popup)
        )
        .addTo(map);
      bounds.extend([coords.lng, coords.lat]);
    });

    if (reports.length) map.fitBounds(bounds, { padding: 60, maxZoom: 14 });

    return () => map.remove();
  }, [reports, userLocation]);

  return (
  <div
    ref={mapContainer}
    className="w-full h-full"
  />
);
}
