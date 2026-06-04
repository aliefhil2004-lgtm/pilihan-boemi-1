import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface FireMapViewProps {
  userLocation: { lat: number; lng: number };
}

export function FireMapView({
  userLocation,
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

    // User marker
    new maplibregl.Marker({ color: 'blue' })
      .setLngLat([
        userLocation.lng,
        userLocation.lat,
      ])
      .setPopup(
        new maplibregl.Popup().setText(
          'Victim Location'
        )
      )
      .addTo(map);

    // Mock fire hotspots
    const hotspots = [
      [-6.3, 107.0],
      [-6.5, 106.9],
      [-6.1, 107.2],
    ];

    hotspots.forEach(([lat, lng]) => {
      new maplibregl.Marker({ color: 'red' })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup().setText(
            'Fire Hotspot'
          )
        )
        .addTo(map);
    });

    return () => map.remove();
  }, [userLocation]);

  return (
  <div
    ref={mapContainer}
    className="w-full h-full"
  />
);
}