import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet'
import { ordersApi } from '@/api/orders'
import { getSocket } from '@/lib/socket'

function FitMap({ riderPosition, destinationPosition }) {
  const map = useMap()

  useEffect(() => {
    const points = [riderPosition, destinationPosition].filter(Boolean)

    if (points.length === 0) return

    if (points.length === 1) {
      map.setView(points[0], 15)
      return
    }

    map.fitBounds(points, {
      padding: [40, 40],
      maxZoom: 15,
    })
  }, [map, riderPosition, destinationPosition])

  return null
}

function formatUpdatedAt(updatedAt) {
  if (!updatedAt) return 'Waiting for rider location'

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000)
  )

  if (seconds < 60) return `Updated ${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  return `Updated ${minutes}m ago`
}

export default function CustomerRiderMap({ order }) {
  const [location, setLocation] = useState(null)
  const [, setClock] = useState(0)

  const destinationPosition = useMemo(() => {
    const coordinates = order?.deliveryAddress?.coordinates

    if (
      !Number.isFinite(Number(coordinates?.lat)) ||
      !Number.isFinite(Number(coordinates?.lng))
    ) {
      return null
    }

    return [Number(coordinates.lat), Number(coordinates.lng)]
  }, [order?.deliveryAddress?.coordinates])

  const riderPosition = useMemo(() => {
    if (
      !Number.isFinite(Number(location?.latitude)) ||
      !Number.isFinite(Number(location?.longitude))
    ) {
      return null
    }

    return [Number(location.latitude), Number(location.longitude)]
  }, [location])

  useEffect(() => {
    if (order?.status !== 'out_for_delivery' || !order?._id) {
      return undefined
    }

    let cancelled = false

    ordersApi
      .getRiderLocation(order._id)
      .then(({ data }) => {
        if (!cancelled) {
          setLocation(data.location || null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocation(null)
        }
      })

    const socket = getSocket()

    const handleLocationUpdate = (payload) => {
      if (payload?.orderId !== order._id) return

      setLocation({
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        heading: payload.heading,
        speed: payload.speed,
        updatedAt: payload.updatedAt,
      })
    }

    socket.on('rider:location:update', handleLocationUpdate)

    return () => {
      cancelled = true
      socket.off('rider:location:update', handleLocationUpdate)
    }
  }, [order?._id, order?.status])

  useEffect(() => {
    if (!location?.updatedAt) return undefined

    const interval = window.setInterval(() => {
      setClock(Date.now())
    }, 10000)

    return () => window.clearInterval(interval)
  }, [location?.updatedAt])

  if (order?.status !== 'out_for_delivery') {
    return null
  }

  if (!destinationPosition && !riderPosition) {
    return (
      <section className="border border-border bg-card p-4 rounded-xl">
        <h2 className="font-display text-base text-foreground">
          Live delivery tracking
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Live location is temporarily unavailable.
        </p>
      </section>
    )
  }

  const mapCenter = riderPosition || destinationPosition

  return (
    <section
      className="overflow-hidden border border-border bg-card"
      style={{ borderRadius: 'var(--gs-radius-xl, 1rem)' }}
      aria-labelledby="live-delivery-tracking"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="live-delivery-tracking"
              className="font-display text-base text-foreground"
            >
              Live delivery tracking
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatUpdatedAt(location?.updatedAt)}
            </p>
          </div>

          {location?.accuracy != null && (
            <span className="text-xs text-muted-foreground">
              {Number.isFinite(Number(location.accuracy)) && <>±{Math.round(location.accuracy)}m</>}
            </span>
          )}
        </div>
      </div>

      <div className="h-72 w-full">
        <MapContainer
          center={mapCenter}
          zoom={15}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitMap
            riderPosition={riderPosition}
            destinationPosition={destinationPosition}
          />

          {riderPosition && (
            <CircleMarker
              center={riderPosition}
              radius={10}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#2563eb',
                fillOpacity: 0.9,
              }}
            />
          )}

          {destinationPosition && (
            <CircleMarker
              center={destinationPosition}
              radius={9}
              pathOptions={{
                color: '#dc2626',
                fillColor: '#dc2626',
                fillOpacity: 0.9,
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-4 p-3 text-xs text-muted-foreground">
        {riderPosition && (
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            Rider
          </span>
        )}

        {destinationPosition && (
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
            Delivery location
          </span>
        )}

        {!riderPosition && (
          <span>Waiting for the rider's live location...</span>
        )}
      </div>
    </section>
  )
}
