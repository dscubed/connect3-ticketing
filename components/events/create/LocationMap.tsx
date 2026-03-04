"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationMapProps {
  lat: number;
  lon: number;
  /** Height of the map container (default: 200px) */
  height?: number;
  className?: string;
}

/**
 * Lightweight Leaflet map that renders a single marker pin.
 * Rendered client-side only — import this via next/dynamic with ssr:false.
 */
export function LocationMap({
  lat,
  lon,
  height = 200,
  className,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create map
    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom: 18,
      zoomControl: true,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Custom pin icon using a simple SVG (avoids missing default marker images)
    const pinIcon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 24 30" fill="none">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 10.5 17.25 11.25 18a1.125 1.125 0 001.5 0C13.5 29.25 24 20.25 24 12 24 5.373 18.627 0 12 0z" fill="#ef4444"/>
        <circle cx="12" cy="12" r="5" fill="white"/>
      </svg>`,
      className: "",
      iconSize: [28, 36],
      iconAnchor: [14, 36],
    });

    L.marker([lat, lon], { icon: pinIcon }).addTo(map);

    // Attribution as small text
    L.control
      .attribution({ position: "bottomright", prefix: false })
      .addTo(map);
    map.attributionControl.addAttribution(
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    );

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lon]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height,
        width: "100%",
        borderRadius: "0.5rem",
        overflow: "hidden",
      }}
    />
  );
}
