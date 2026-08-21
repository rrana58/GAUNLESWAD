import { useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { toast } from 'sonner'
import { addressApi } from '@/api/orders'
import { getErrorMessage } from '@/lib/errorMessage'


const LABELS = ['Home', 'Work', 'Other']

export default function AddressForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState({
    label: initial?.label || 'Home',
    street: initial?.street || '',
    area: initial?.area || '',
    city: initial?.city || 'Kathmandu',
    landmark: initial?.landmark || '',
    isDefault: initial?.isDefault || false,
    coordinates: initial?.coordinates,
  })
  const [locating, setLocating] = useState(false)

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available in this browser")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords
          const { data } = await addressApi.reverseGeocode(lat, lng)
          setForm((f) => ({
            ...f,
            street: data.address.street || f.street,
            area: data.address.area || f.area,
            city: data.address.city || f.city,
            landmark: data.address.landmark || f.landmark,
            coordinates: { lat, lng },
          }))
          toast.success('Location detected')
        } catch (err) {
          toast.error(getErrorMessage(err, 'Could not detect address from your location'))
        } finally {
          setLocating(false)
        }
      },
      () => {
        toast.error('Location permission denied')
        setLocating(false)
      }
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.street.trim()) {
      toast.error('Street address is required')
      return
    }
    onSubmit({ ...form, type: form.coordinates ? 'gps' : 'manual' })
  }

  const inputClass = 'w-full border border-border bg-card px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20'
  const inputStyle = { borderRadius: 'var(--gs-radius-lg, 0.75rem)' }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      aria-label="Add new delivery address"
      noValidate
    >
      {/* Detect location */}
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        aria-busy={locating}
        aria-label={locating ? 'Detecting your location...' : 'Use my current location'}
        className="flex items-center justify-center gap-1.5 border border-primary text-primary py-2 text-sm font-medium disabled:opacity-50 gs-focus-ring"
        style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
      >
        <LocateFixed size={15} aria-hidden="true" />
        {locating ? 'Detecting location...' : 'Use my current location'}
      </button>

      {/* Label picker */}
      <div
        className="flex gap-2"
        role="radiogroup"
        aria-label="Address label"
      >
        {LABELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setForm((f) => ({ ...f, label: l }))}
            aria-pressed={form.label === l}
            aria-label={l}
            className={`flex-1 border py-2 text-sm font-medium gs-focus-ring ${
              form.label === l
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground'
            }`}
            style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Street — required */}
      <input
        name="street"
        id="addrStreet"
        value={form.street}
        onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
        placeholder="Street address *"
        aria-label="Street address"
        aria-required="true"
        className={inputClass}
        style={inputStyle}
      />

      {/* Area */}
      <input
        name="area"
        id="addrArea"
        value={form.area}
        onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
        placeholder="Area / neighborhood"
        aria-label="Area or neighborhood"
        className={inputClass}
        style={inputStyle}
      />

      {/* Landmark */}
      <input
        name="landmark"
        id="addrLandmark"
        value={form.landmark}
        onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
        placeholder="Landmark (optional)"
        aria-label="Nearby landmark (optional)"
        className={inputClass}
        style={inputStyle}
      />

      {/* Set as default */}
      <label htmlFor="addrIsDefault" className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
        <input
          id="addrIsDefault"
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
          className="accent-primary w-4 h-4"
        />
        Set as default address
      </label>

      {/* Save button */}
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        aria-disabled={submitting}
        className="bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform gs-focus-ring"
        style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
      >
        {submitting ? 'Saving...' : 'Save address'}
      </button>

      {/* Cancel */}
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-muted-foreground underline self-center gs-focus-ring rounded-sm py-1 px-2"
      >
        Cancel
      </button>
    </form>
  )
}