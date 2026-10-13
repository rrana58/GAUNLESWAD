import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { watchRiderLocation, stopWatchingRiderLocation } from "../utils/riderLocation";

const riderIcon = L.divIcon({
  className: "",
  html: '<div style="background:#2563eb;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const deliveryIcon = L.divIcon({
  className: "",
  html: '<div style="background:#e11d48;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitRouteBounds({ route, riderPosition, deliveryPosition }) {
  const map = useMap();

  useEffect(() => {
    const points = route?.length
      ? route
      : [riderPosition, deliveryPosition].filter(Boolean);

    if (points.length < 2) return;

    map.fitBounds(L.latLngBounds(points), {
      padding: [40, 40],
    });
  }, [map, route, riderPosition, deliveryPosition]);

  return null;
}

export default function RiderRouteMap({ order }) {
  const [riderPosition, setRiderPosition] = useState(null);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);
  const [route, setRoute] = useState([]);
  const [locationError, setLocationError] = useState("");
  const [routeError, setRouteError] = useState("");

  const deliveryCoordinates = order?.deliveryAddress?.coordinates;

  const deliveryPosition = useMemo(() => {
    if (!deliveryCoordinates) return null;

    return [Number(deliveryCoordinates.lat), Number(deliveryCoordinates.lng)];
  }, [deliveryCoordinates]);

  useEffect(() => {
    const watchId = watchRiderLocation(
      (position) => {
        setRiderPosition([position.lat, position.lng]);
        setLastLocationUpdate(new Date());
        setLocationError("");
      },
      () => {
        setLocationError("Unable to get your current location.");
      }
    );

    return () => {
      stopWatchingRiderLocation(watchId);
    };
  }, []);

  useEffect(() => {
    if (!riderPosition || !deliveryPosition) return;

    const [riderLat, riderLng] = riderPosition;
    const [deliveryLat, deliveryLng] = deliveryPosition;

    if (
      !Number.isFinite(riderLat) ||
      !Number.isFinite(riderLng) ||
      !Number.isFinite(deliveryLat) ||
      !Number.isFinite(deliveryLng)
    ) {
      return;
    }

    let cancelled = false;

    const fetchRoute = async () => {
      try {
        setRouteError("");

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${riderLng},${riderLat};${deliveryLng},${deliveryLat}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Routing request failed.");
        }

        const data = await response.json();

        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error("No route found.");
        }

        const coordinates = data.routes[0].geometry.coordinates.map(
          ([lng, lat]) => [lat, lng]
        );

        if (!cancelled) {
          setRoute(coordinates);
        }
      } catch {
        if (!cancelled) {
          setRoute([]);
          setRouteError("Unable to calculate road route.");
        }
      }
    };

    fetchRoute();

    return () => {
      cancelled = true;
    };
  }, [riderPosition, deliveryPosition]);

  if (!deliveryPosition || deliveryPosition.some((value) => !Number.isFinite(value))) {
    return (
      <div className="mt-3 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
        Delivery location is not available for this order.
      </div>
    );
  }

  if (!riderPosition) {
    return (
      <div className="mt-3 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
        {locationError || "Getting your current location..."}
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
      <MapContainer
        center={riderPosition}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: "280px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={riderPosition} icon={riderIcon}>
          <Popup>Your current location</Popup>
        </Marker>

        <Marker position={deliveryPosition} icon={deliveryIcon}>
          <Popup>Delivery location</Popup>
        </Marker>

        {route.length > 1 && (
          <Polyline
            positions={route}
            pathOptions={{ weight: 5, opacity: 0.8 }}
          />
        )}

        <FitRouteBounds
          route={route}
          riderPosition={riderPosition}
          deliveryPosition={deliveryPosition}
        />
      </MapContainer>

      {routeError && (
        <div className="bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {routeError}
        </div>
      )}

      {riderPosition && (
        <div className="bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <div>
            Live GPS: {riderPosition[0].toFixed(6)}, {riderPosition[1].toFixed(6)}
          </div>
          <div>
            Last update: {lastLocationUpdate?.toLocaleTimeString() || "Waiting..."}
          </div>
        </div>
      )}
    </div>
  );
}
