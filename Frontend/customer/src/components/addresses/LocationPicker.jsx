import { useEffect, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'

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

export default function LocationPicker({ initialPosition, onConfirm }) {
  const [position, setPosition] = useState(initialPosition || null)
  const [locating, setLocating] = useState(!initialPosition)
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

  useEffect(() => {
    if (!initialPosition) {
      getCurrentLocation()
    }
  }, [initialPosition])

  if (locating || !position) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        {locationError
          ? 'Unable to get your location.'
          : 'Getting your current location...'}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-xl border border-border"
        style={{ height: '280px' }}
      >
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={16}
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
        </MapContainer>

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-full"
          aria-hidden="true"
        >
          <span className="text-4xl drop-shadow-md">📍</span>
        </div>

        <button
          type="button"
          onClick={getCurrentLocation}
          disabled={locating}
          className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground shadow-md gs-focus-ring disabled:opacity-60"
        >
          <LocateFixed size={16} />
          {locating ? 'Locating...' : 'Use my current location'}
        </button>
      </div>

      {locationError && (
        <p className="text-sm text-destructive">
          Location permission was denied or your location could not be detected.
        </p>
      )}

      <button
        type="button"
        onClick={() => onConfirm(position)}
        className="w-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground gs-focus-ring"
        style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
      >
        Use this location
      </button>
    </div>
  )
}