import { useEffect, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Marker,
} from 'react-leaflet'
import L from 'leaflet'

const DEFAULT_POSITION = {
  lat: 28.2096,
  lng: 83.9856,
}

const kitchenIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:32px; transform:translate(-50%,-100%);">📍</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

function MapCenterUpdater({ position, onPositionChange }) {
  const map = useMap()

  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], map.getZoom())
    }
  }, [map, position])

  useMapEvents({
    moveend(event) {
      const center = event.target.getCenter()

      onPositionChange({
        lat: center.lat,
        lng: center.lng,
      })
    },
  })

  return null
}

export default function KitchenLocationPicker({
  initialPosition,
  onConfirm,
}) {
  const [position, setPosition] = useState(
    initialPosition?.lat != null && initialPosition?.lng != null
      ? initialPosition
      : DEFAULT_POSITION
  )
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState(false)

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(true)
      return
    }

    setLocating(true)
    setLocationError(false)

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({
          lat: coords.latitude,
          lng: coords.longitude,
        })
        setLocating(false)
      },
      () => {
        setLocating(false)
        setLocationError(true)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-xl border border-border"
        style={{ height: '320px' }}
      >
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={15}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapCenterUpdater
            position={position}
            onPositionChange={setPosition}
          />

          <Marker
            position={[position.lat, position.lng]}
            icon={kitchenIcon}
          />
        </MapContainer>

        <button
          type="button"
          onClick={getCurrentLocation}
          disabled={locating}
          className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground shadow-md disabled:opacity-60"
        >
          <LocateFixed size={16} />
          {locating ? 'Locating...' : 'Use my current location'}
        </button>
      </div>

      {locationError && (
        <p className="text-sm text-destructive">
          Location permission was denied or the location could not be detected.
        </p>
      )}

      <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        Move the map until the pin is exactly at your kitchen/restaurant
        location.
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Latitude
          </span>
          <div className="text-sm text-foreground">
            {position.lat.toFixed(6)}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Longitude
          </span>
          <div className="text-sm text-foreground">
            {position.lng.toFixed(6)}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onConfirm(position)}
        className="w-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
        style={{ borderRadius: 'var(--gs-admin-radius-lg, 0.75rem)' }}
      >
        Use this kitchen location
      </button>
    </div>
  )
}
