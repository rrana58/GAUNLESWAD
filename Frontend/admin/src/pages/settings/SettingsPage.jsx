import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings, uploadPopupImage } from '@/api/admin'
import { toast } from 'sonner'
import { Save, X, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Spinner from '@/components/ui/Spinner'

/**
 * SettingsPage — Design System: Phase 5.6
 *
 * Token & Component changes:
 *  - bg-white -> bg-card
 *  - bg-gray-50 / bg-gray-100 -> bg-muted
 *  - border-gray-100 / border-gray-200 -> border-border
 *  - text-gray-900 -> text-foreground
 *  - text-gray-500 / text-gray-400 -> text-muted-foreground / text-muted-foreground/60
 *  - Loader2 -> <Spinner />
 *  - Brand orange -> var(--gs-admin-accent)
 *  - rounded-xl / rounded-lg / rounded-full -> radius tokens via style
 *
 * Accessibility:
 *  - <main aria-label="Global kitchen settings">
 *  - Header landmark
 *  - Form controls with id & htmlFor
 *  - Decorative icons with aria-hidden="true"
 *  - Buttons with descriptive aria-label, focus ring, and aria-busy
 */

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setContact = (k, v) => setForm((f) => ({ ...f, contactInfo: { ...(f.contactInfo || {}), [k]: v } }))

  const [popupImageFile, setPopupImageFile] = useState(null)
  const [popupImagePreview, setPopupImagePreview] = useState(null)
  const [uploadingPopupImage, setUploadingPopupImage] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getSettings().then((r) => r.data.settings),
  })

  useEffect(() => {
    if (data && !form) setForm(data)
  }, [data, form])

  const handlePopupImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB')
    setPopupImageFile(file)
    setPopupImagePreview(URL.createObjectURL(file))
  }

  const update = useMutation({
    mutationFn: (data) => updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['settings'])
      toast.success('Settings saved')
      setPopupImageFile(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save'),
  })

  const handleSave = async () => {
    try {
      let popupData = form.popup || {}

      if (popupImageFile) {
        setUploadingPopupImage(true)
        const formData = new FormData()
        formData.append('image', popupImageFile)
        const { data } = await uploadPopupImage(formData)
        popupData = { ...popupData, image: { url: data.url, publicId: data.publicId } }
        setUploadingPopupImage(false)
      }

      update.mutate({
        globalDiscountPercent: form.globalDiscountPercent,
        globalDiscountLabel: form.globalDiscountLabel,
        freeDeliveryAbove: form.freeDeliveryAbove,
        kitchenLocation: form.kitchenLocation,
        maxDeliveryDistanceKm: form.maxDeliveryDistanceKm,
        deliveryZones: form.deliveryZones || [],
        maintenanceMode: form.maintenanceMode,
        maintenanceMessage: form.maintenanceMessage,
        popup: { ...popupData },
        contactInfo: form.contactInfo || {},
        aboutUs: form.aboutUs || '',
      })
    } catch (err) {
      toast.error('Failed to upload image')
      setUploadingPopupImage(false)
    }
  }

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" label="Loading settings..." />
      </div>
    )
  }

  return (
    <main className="space-y-6 max-w-2xl pb-10" aria-label="Global kitchen settings">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Global kitchen configuration</p>
      </header>

      {/* Global Discount */}
      <section
        aria-label="Global discount settings"
        className="bg-card border border-border p-5 space-y-4"
        style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
      >
        <div>
          <h2 className="font-semibold text-foreground">Global Discount</h2>
          <p className="text-sm text-muted-foreground/60 mt-0.5">Applied to every item. Set to 0 to disable.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="global-discount-percent">Discount %</Label>
            <Input
              id="global-discount-percent"
              type="number"
              value={form.globalDiscountPercent}
              onChange={(e) => set('globalDiscountPercent', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="global-discount-label">Label</Label>
            <Input
              id="global-discount-label"
              value={form.globalDiscountLabel}
              onChange={(e) => set('globalDiscountLabel', e.target.value)}
              placeholder="e.g. Monsoon Sale"
            />
          </div>
        </div>
      </section>

      {/* Delivery */}
      <section
        aria-label="Delivery settings"
        className="bg-card border border-border p-5 space-y-5"
        style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
      >
        <h2 className="font-semibold text-foreground">Delivery Settings</h2>

        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="free-delivery-above">Free Delivery Above (Rs.)</Label>
          <Input
            id="free-delivery-above"
            type="number"
            value={form.freeDeliveryAbove}
            onChange={(e) => set('freeDeliveryAbove', Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">Orders at or above this subtotal always get free delivery, regardless of distance.</p>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Kitchen Location</h3>
            <p className="text-xs text-muted-foreground">
              Set this to enable distance-based delivery range &amp; fees below. Leave blank to keep a flat delivery fee with no range limit.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="kitchen-lat">Latitude</Label>
              <Input
                id="kitchen-lat"
                type="number"
                step="any"
                placeholder="e.g. 28.209"
                value={form.kitchenLocation?.lat ?? ''}
                onChange={(e) =>
                  set('kitchenLocation', { ...(form.kitchenLocation || {}), lat: e.target.value === '' ? undefined : Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kitchen-lng">Longitude</Label>
              <Input
                id="kitchen-lng"
                type="number"
                step="any"
                placeholder="e.g. 83.985"
                value={form.kitchenLocation?.lng ?? ''}
                onChange={(e) =>
                  set('kitchenLocation', { ...(form.kitchenLocation || {}), lng: e.target.value === '' ? undefined : Number(e.target.value) })
                }
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) return toast.error('Location not supported on this device')
              navigator.geolocation.getCurrentPosition(
                (pos) => set('kitchenLocation', { lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => toast.error('Could not get current location')
              )
            }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Use my current location
          </button>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="max-delivery-distance">Max Delivery Distance (km)</Label>
            <Input
              id="max-delivery-distance"
              type="number"
              min="0"
              placeholder="e.g. 10"
              value={form.maxDeliveryDistanceKm ?? ''}
              onChange={(e) => set('maxDeliveryDistanceKm', e.target.value === '' ? undefined : Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Orders from further than this are rejected. Leave blank for no limit.</p>
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Delivery Fee by Distance</h3>
            <p className="text-xs text-muted-foreground">
              e.g. "up to 3 km → Rs. 30", "up to 7 km → Rs. 50". The first matching tier (by distance) sets the fee.
            </p>
          </div>
          <div className="space-y-2">
            {(form.deliveryZones || []).map((zone, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Up to</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className="w-24"
                  value={zone.upToKm}
                  onChange={(e) => {
                    const zones = [...form.deliveryZones]
                    zones[idx] = { ...zones[idx], upToKm: Number(e.target.value) }
                    set('deliveryZones', zones)
                  }}
                  aria-label={`Zone ${idx + 1} distance in km`}
                />
                <span className="text-xs text-muted-foreground shrink-0">km → Rs.</span>
                <Input
                  type="number"
                  min="0"
                  className="w-24"
                  value={zone.fee}
                  onChange={(e) => {
                    const zones = [...form.deliveryZones]
                    zones[idx] = { ...zones[idx], fee: Number(e.target.value) }
                    set('deliveryZones', zones)
                  }}
                  aria-label={`Zone ${idx + 1} fee`}
                />
                <button
                  type="button"
                  onClick={() => set('deliveryZones', form.deliveryZones.filter((_, i) => i !== idx))}
                  aria-label={`Remove zone ${idx + 1}`}
                  className="text-red-500 hover:text-red-600 text-xs font-semibold px-2"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set('deliveryZones', [...(form.deliveryZones || []), { upToKm: 0, fee: 0 }])}
              className="text-xs font-semibold text-primary hover:underline"
            >
              + Add distance tier
            </button>
          </div>
        </div>
      </section>

      {/* Maintenance Mode */}
      <section
        aria-label="Maintenance mode settings"
        className={`bg-card border p-5 space-y-4 ${form.maintenanceMode ? 'border-red-200 bg-red-50/30' : 'border-border'}`}
        style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Maintenance Mode</h2>
          <button
            type="button"
            role="switch"
            aria-checked={form.maintenanceMode}
            aria-label="Toggle maintenance mode"
            onClick={() => set('maintenanceMode', !form.maintenanceMode)}
            className={`relative w-11 h-6 rounded-full transition-colors gs-admin-focus-ring ${form.maintenanceMode ? 'bg-red-500' : 'bg-muted'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.maintenanceMode ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        {form.maintenanceMode && (
          <div className="space-y-1.5">
            <Label htmlFor="maintenance-message">Maintenance Message</Label>
            <Input
              id="maintenance-message"
              value={form.maintenanceMessage}
              onChange={(e) => set('maintenanceMessage', e.target.value)}
              placeholder="Reason for downtime..."
            />
          </div>
        )}
      </section>

      {/* Promotional Popup Section */}
      <section
        aria-label="Promotional popup settings"
        className="bg-card border border-border p-5 space-y-4"
        style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Promotional Popup</h2>
            <p className="text-sm text-muted-foreground/60 mt-0.5">Announcements or offers shown to customers.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!form.popup?.enabled}
            aria-label="Toggle promotional popup"
            onClick={() => set('popup', { ...(form.popup || {}), enabled: !form.popup?.enabled })}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer gs-admin-focus-ring ${
              form.popup?.enabled ? 'bg-orange-500' : 'bg-muted'
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              form.popup?.enabled ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {form.popup?.enabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="popup-title">Popup Title *</Label>
                <Input
                  id="popup-title"
                  value={form.popup?.title || ''}
                  onChange={(e) => set('popup', { ...form.popup, title: e.target.value })}
                  placeholder="e.g. 🎉 Special Offer!"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="popup-message">Message *</Label>
                <textarea
                  id="popup-message"
                  value={form.popup?.message || ''}
                  onChange={(e) => set('popup', { ...form.popup, message: e.target.value })}
                  className="w-full h-24 border border-border bg-card text-foreground px-3 py-2 text-sm resize-none focus:outline-none gs-admin-focus-ring"
                  style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                  placeholder="Tell your customers about the offer..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="popup-btn-text">Button Text</Label>
                <Input
                  id="popup-btn-text"
                  value={form.popup?.buttonText || ''}
                  onChange={(e) => set('popup', { ...form.popup, buttonText: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="popup-btn-link">Button Link</Label>
                <Input
                  id="popup-btn-link"
                  value={form.popup?.buttonLink || ''}
                  onChange={(e) => set('popup', { ...form.popup, buttonLink: e.target.value })}
                  placeholder="/menu"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="popup-bg-color">BG Color</Label>
                <div className="flex gap-2">
                  <input
                    id="popup-bg-color"
                    type="color"
                    aria-label="Pick popup background color"
                    value={form.popup?.bgColor || '#f97316'}
                    onChange={(e) => set('popup', { ...form.popup, bgColor: e.target.value })}
                    className="w-9 h-9 cursor-pointer border border-border rounded"
                  />
                  <Input
                    aria-label="Popup background color hex code"
                    value={form.popup?.bgColor || '#f97316'}
                    onChange={(e) => set('popup', { ...form.popup, bgColor: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="popup-until">Show Until</Label>
                <Input
                  id="popup-until"
                  type="date"
                  value={form.popup?.validUntil ? new Date(form.popup.validUntil).toISOString().split('T')[0] : ''}
                  onChange={(e) => set('popup', { ...form.popup, validUntil: e.target.value || null })}
                />
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-1.5">
              <Label>Popup Image (optional)</Label>
              <div className="flex items-center gap-4">
                {(popupImagePreview || form.popup?.image?.url) ? (
                  <div className="relative">
                    <img
                      src={popupImagePreview || form.popup?.image?.url}
                      alt="popup preview"
                      className="w-24 h-16 object-cover border border-border"
                      style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                    />
                    <button
                      type="button"
                      aria-label="Remove popup image"
                      onClick={() => {
                        setPopupImagePreview(null)
                        setPopupImageFile(null)
                        set('popup', { ...form.popup, image: null })
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      <X size={10} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="w-24 h-16 border-2 border-dashed border-border flex items-center justify-center"
                    style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                  >
                    <ImageIcon size={20} className="text-muted-foreground/60" aria-hidden="true" />
                  </div>
                )}
                <label className="cursor-pointer gs-admin-focus-ring" tabIndex={0}>
                  <span className="text-sm font-medium" style={{ color: 'var(--gs-admin-accent)' }}>Upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Upload popup image"
                    onChange={handlePopupImageChange}
                  />
                </label>
                {uploadingPopupImage && <Spinner size="sm" label="Uploading popup image..." />}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-1.5">
              <Label>Preview</Label>
              <div
                className="border border-border overflow-hidden max-w-xs shadow-sm"
                style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
              >
                <div className="p-4 text-white" style={{ backgroundColor: form.popup?.bgColor || '#f97316' }}>
                  {(popupImagePreview || form.popup?.image?.url) && (
                    <img
                      src={popupImagePreview || form.popup?.image?.url}
                      alt=""
                      className="w-full h-24 object-cover mb-3"
                      style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                    />
                  )}
                  <h3 className="font-bold">{form.popup?.title || 'Title'}</h3>
                  <p className="text-xs opacity-90">{form.popup?.message || 'Message text...'}</p>
                  <div
                    className="mt-3 w-full bg-white text-gray-900 py-1.5 text-center text-xs font-bold"
                    style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                  >
                    {form.popup?.buttonText || 'Order Now'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Contact Us */}
      <section
        aria-label="Contact information settings"
        className="bg-card border border-border p-5 space-y-4"
        style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
      >
        <div>
          <h2 className="font-semibold text-foreground">Contact Us</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Shown to customers in the app's More tab</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              value={form.contactInfo?.phone || ''}
              onChange={(e) => setContact('phone', e.target.value)}
              placeholder="98XXXXXXXX"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-whatsapp">WhatsApp</Label>
            <Input
              id="contact-whatsapp"
              value={form.contactInfo?.whatsapp || ''}
              onChange={(e) => setContact('whatsapp', e.target.value)}
              placeholder="98XXXXXXXX"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={form.contactInfo?.email || ''}
              onChange={(e) => setContact('email', e.target.value)}
              placeholder="hello@gharkoswad.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-address">Address</Label>
            <Input
              id="contact-address"
              value={form.contactInfo?.address || ''}
              onChange={(e) => setContact('address', e.target.value)}
              placeholder="Waling-4, Syangja"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-maplink">Google Maps link</Label>
            <Input
              id="contact-maplink"
              value={form.contactInfo?.mapLink || ''}
              onChange={(e) => setContact('mapLink', e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-facebook">Facebook URL</Label>
            <Input
              id="contact-facebook"
              value={form.contactInfo?.facebook || ''}
              onChange={(e) => setContact('facebook', e.target.value)}
              placeholder="https://facebook.com/..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-instagram">Instagram URL</Label>
            <Input
              id="contact-instagram"
              value={form.contactInfo?.instagram || ''}
              onChange={(e) => setContact('instagram', e.target.value)}
              placeholder="https://instagram.com/..."
            />
          </div>
        </div>
      </section>

      {/* About Us */}
      <section
        aria-label="About us page settings"
        className="bg-card border border-border p-5 space-y-4"
        style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
      >
        <div>
          <h2 className="font-semibold text-foreground">About Us</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Shown on the app's About Us page</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="about-us">Body</Label>
          <textarea
            id="about-us"
            value={form.aboutUs || ''}
            onChange={(e) => set('aboutUs', e.target.value)}
            maxLength={3000}
            rows={6}
            className="w-full border border-border bg-card text-foreground px-3 py-2 text-sm resize-none focus:outline-none gs-admin-focus-ring"
            style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
          />
          <p className="text-xs text-muted-foreground/60 text-right">{(form.aboutUs || '').length}/3000</p>
        </div>
      </section>

      {/* Save button */}
      <Button
        className="w-full md:w-auto gs-admin-focus-ring"
        style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
        onClick={handleSave}
        disabled={update.isPending || uploadingPopupImage}
        aria-busy={update.isPending || uploadingPopupImage}
      >
        {(update.isPending || uploadingPopupImage) ? (
          <Spinner size="sm" label="Saving settings..." className="mr-2" />
        ) : (
          <Save size={14} className="mr-2" aria-hidden="true" />
        )}
        Save Settings
      </Button>
    </main>
  )
}