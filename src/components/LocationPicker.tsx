import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Loader2 } from 'lucide-react';

const DefaultIcon = L.icon({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const DEBOUNCE_MS = 500;

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationPickerProps {
  value: string;
  onLocationChange: (address: string, lat?: number, lng?: number) => void;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng); }
  });
  return null;
}

function DraggableMarker({ position, onMove }: { position: [number, number]; onMove: (lat: number, lng: number) => void }) {
  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = {
    dragend() {
      const m = markerRef.current;
      if (m) onMove(m.getLatLng().lat, m.getLatLng().lng);
    }
  };
  return <Marker ref={markerRef} position={position} draggable eventHandlers={eventHandlers} />;
}

function MapFlyer({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], map.getZoom() >= 10 ? map.getZoom() : 12); }, [lat, lng]);
  return null;
}

async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(
      `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'User-Agent': 'MarketaMarketplace/1.0' }, signal }
    );
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ value, onLocationChange }) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    if (q.trim().length < 3) { setSuggestions([]); setShowSuggestions(false); setSearching(false); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    try {
      const res = await fetch(
        `${NOMINATIM}/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=PH`,
        { headers: { 'User-Agent': 'MarketaMarketplace/1.0' }, signal: controller.signal }
      );
      if (!res.ok) { setSuggestions([]); setShowSuggestions(false); return; }
      const data = await res.json();
      setSuggestions(data || []);
      setShowSuggestions((data || []).length > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    onLocationChange(val, coords?.[0], coords?.[1]);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(val), DEBOUNCE_MS);
  };

  const selectSuggestion = (s: Suggestion) => {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setQuery(s.display_name);
    setCoords([lat, lng]);
    setShowSuggestions(false);
    setSuggestions([]);
    onLocationChange(s.display_name, lat, lng);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setCoords([lat, lng]);
    const addr = await reverseGeocode(lat, lng);
    const display = addr || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    setQuery(display);
    onLocationChange(display, lat, lng);
  };

  const handleMarkerDrag = async (lat: number, lng: number) => {
    setCoords([lat, lng]);
    const addr = await reverseGeocode(lat, lng);
    const display = addr || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    setQuery(display);
    onLocationChange(display, lat, lng);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search a location or click the map..."
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary transition"
        />
        {searching && <Loader2 className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />}
        {showSuggestions && suggestions.length > 0 && (
          <div ref={suggestionRef} className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button key={i} type="button" onClick={() => selectSuggestion(s)}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition cursor-pointer"
              >
                {s.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg overflow-hidden border border-slate-200 h-[200px]">
          <MapContainer
            center={coords || [14.5547, 121.0244]}
            zoom={coords ? 12 : 5}
            className="h-full w-full"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />
            {coords && (
              <>
                <DraggableMarker position={coords} onMove={handleMarkerDrag} />
                <MapFlyer lat={coords[0]} lng={coords[1]} />
              </>
            )}
          </MapContainer>
        </div>
      </div>
    );
  };
