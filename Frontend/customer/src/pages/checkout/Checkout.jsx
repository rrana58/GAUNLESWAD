import { useState, useMemo, useEffect, useId } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Lock, LocateFixed, CheckCircle2, XCircle } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useActiveOrderStore } from '@/store/activeOrderStore'
import { useSettingsStore } from '@/store/settingsStore'
import { ordersApi } from '@/api/orders'
import { getErrorMessage } from '@/lib/errorMessage'
import { formatNpr, cn } from '@/lib/utils'
import { authApi } from '@/api/auth'
import PageHeader from '@/components/layout/PageHeader'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addressApi, subscriptionApi } from '@/api/orders'
import { promoApi } from '@/api/orders'
import AddressCard from '@/components/addresses/AddressCard'
import AddressForm from '@/components/addresses/AddressForm'


export default function Checkout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.getSubtotal())
  const clearCart = useCartStore((s) => s.clear)
  const { user, isAuthenticated, updateUser } = useAuthStore()
  const setActiveOrder = useActiveOrderStore((s) => s.setActiveOrder)

  useEffect(() => {
    if (isAuthenticated && user) {
      authApi.getMe().then(({ data }) => updateUser(data.user)).catch(() => {})
    }
  }, [isAuthenticated, user?._id])

  const [deliveryType, setDeliveryType] = useState('delivery')
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null) // { code, discount, coupon }
  const [couponError, setCouponError] = useState('')
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [useWallet, setUseWallet] = useState(false)
  const [address, setAddress] = useState({ street: '', area: '', city: 'Pokhara', landmark: '' })
  const [guestInfo, setGuestInfo] = useState({ name: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)

  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [addingNewAddress, setAddingNewAddress] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)
  const [locatingGuestAddress, setLocatingGuestAddress] = useState(false)

  // Stable IDs for aria associations
  const deliveryHeadingId = useId()
  const addrHeadingId = useId()
  const guestHeadingId = useId()
  const paymentHeadingId = useId()
  const walletHeadingId = useId()
  const couponHeadingId = useId()
  const instHeadingId = useId()
  const summaryHeadingId = useId()
  const walletToggleId = useId()
  const couponNoteId = useId()

  const useGuestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available in this browser")
      return
    }
    setLocatingGuestAddress(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords
          const { data } = await addressApi.reverseGeocode(lat, lng)
          setAddress((a) => ({
            ...a,
            street: data.address.street || a.street,
            area: data.address.area || a.area,
            city: data.address.city || a.city,
            landmark: data.address.landmark || a.landmark,
            coordinates: { lat, lng },
          }))
          toast.success('Location detected')
        } catch (err) {
          toast.error(getErrorMessage(err, 'Could not detect address from your location'))
        } finally {
          setLocatingGuestAddress(false)
        }
      },
      () => {
        toast.error('Location permission denied')
        setLocatingGuestAddress(false)
      }
    )
  }

  const { data: savedAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressApi.list().then((r) => r.data.addresses),
    enabled: isAuthenticated,
  })

  const orderItemsPayload = useMemo(
    () =>
      items.map((i) => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        variantId: i.variantId || undefined,
        addonIds: i.addonIds?.length ? i.addonIds : undefined,
        specialInstructions: i.specialInstructions || undefined,
      })),
    [items]
  )

  const { data: mySubData } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => subscriptionApi.getMySubscription().then((r) => r.data),
    enabled: isAuthenticated,
  })

  const subscriptionDiscount = useMemo(() => {
    if (!mySubData?.subscription || !mySubData?.summary?.canUseMeals) return 0
    const planItems = mySubData.subscription.plan.items.map((i) => i._id || i)
    let remaining = mySubData.summary.mealsRemaining
    let discount = 0

    // Sort items by price descending so highest priced eligible items get discounted first
    const sortedCart = [...items].sort((a, b) => b.price - a.price)

    for (const item of sortedCart) {
      if (planItems.includes(item.menuItemId) && remaining > 0) {
        const freeQty = Math.min(item.quantity, remaining)
        discount += item.price * freeQty
        remaining -= freeQty
      }
    }
    return discount
  }, [items, mySubData])

  const displaySubtotal = Math.max(0, subtotal - subscriptionDiscount)

  const maintenanceMode = useSettingsStore((s) => s.maintenanceMode)
  const maintenanceMessage = useSettingsStore((s) => s.maintenanceMessage)
  const globalDiscountPercent = useSettingsStore((s) => s.globalDiscountPercent)
  const globalDiscountLabel = useSettingsStore((s) => s.globalDiscountLabel)
  const freeDeliveryAbove = useSettingsStore((s) => s.freeDeliveryAbove)
  const settingsDeliveryFee = useSettingsStore((s) => s.deliveryFee)
  const kitchenLocation = useSettingsStore((s) => s.kitchenLocation)
  const maxDeliveryDistanceKm = useSettingsStore((s) => s.maxDeliveryDistanceKm)
  const deliveryZones = useSettingsStore((s) => s.deliveryZones)

  
  const selectedCoordinates = useMemo(() => {
    if (deliveryType === 'pickup') return null
    if (isAuthenticated) {
      return savedAddresses?.find((a) => a._id === selectedAddressId)?.coordinates || null
    }
    return address.coordinates || null
  }, [deliveryType, isAuthenticated, savedAddresses, selectedAddressId, address.coordinates])

  
  const distanceKm = useMemo(() => {
    if (!kitchenLocation?.lat || !selectedCoordinates?.lat) return null
    const toRad = (d) => (d * Math.PI) / 180
    const R = 6371
    const dLat = toRad(selectedCoordinates.lat - kitchenLocation.lat)
    const dLng = toRad(selectedCoordinates.lng - kitchenLocation.lng)
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(kitchenLocation.lat)) * Math.cos(toRad(selectedCoordinates.lat)) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }, [kitchenLocation, selectedCoordinates])

  const outOfDeliveryRange = deliveryType !== 'pickup' &&
    !!maxDeliveryDistanceKm && distanceKm != null && distanceKm > maxDeliveryDistanceKm

  const zoneDeliveryFee = useMemo(() => {
    if (distanceKm == null || !deliveryZones?.length) return settingsDeliveryFee
    const zone = deliveryZones.find((z) => distanceKm <= z.upToKm)
    return zone ? zone.fee : deliveryZones[deliveryZones.length - 1].fee
  }, [distanceKm, deliveryZones, settingsDeliveryFee])

  
  const globalDiscountValue = globalDiscountPercent > 0
    ? Math.round(displaySubtotal * (globalDiscountPercent / 100))
    : 0
  const discountedSubtotal = Math.max(0, displaySubtotal - globalDiscountValue)

  const preTaxSubtotal = discountedSubtotal / 1.13
  const vatAmount = discountedSubtotal - preTaxSubtotal

  const deliveryFee = (deliveryType === 'pickup' || discountedSubtotal >= freeDeliveryAbove || subscriptionDiscount > 0) ? 0 : zoneDeliveryFee
  const couponDiscountValue = appliedCoupon?.discount || 0
  const walletDiscountValue = (useWallet && user?.loyaltyPoints)
    ? Math.min(user.loyaltyPoints, Math.max(0, discountedSubtotal + deliveryFee - couponDiscountValue))
    : 0
  const finalTotal = Math.max(0, discountedSubtotal + deliveryFee - couponDiscountValue - walletDiscountValue)

  const handleApplyCoupon = async () => {
    const code = couponCode.trim()
    if (!code) return
    setValidatingCoupon(true)
    setCouponError('')
    try {
      const { data } = await promoApi.validate(code, discountedSubtotal)
      setAppliedCoupon({ code: data.coupon.code, discount: data.discount, coupon: data.coupon })
      setCouponCode(data.coupon.code)
    } catch (err) {
      setAppliedCoupon(null)
      setCouponError(getErrorMessage(err))
    } finally {
      setValidatingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponError('')
    setCouponCode('')
  }

  const { data: closedDatesRes } = useQuery({
    queryKey: ['closed-dates'],
    queryFn: () => ordersApi.getClosedDates().then(r => r.data),
  })

  const closedTodayInfo = useMemo(() => {
    const today = new Date()
    // Offset for Nepal time (+5:45)
    const nepalTime = new Date(today.getTime() + (5 * 60 + 45) * 60000)
    const todayString = nepalTime.toISOString().slice(0, 10)
    return closedDatesRes?.closedDates?.find(d => d.date === todayString)
  }, [closedDatesRes])

  // Auto-select default or first address when savedAddresses loads
  useEffect(() => {
    if (isAuthenticated && savedAddresses?.length > 0 && !selectedAddressId) {
      const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0]
      if (defaultAddr?._id) setSelectedAddressId(defaultAddr._id)
    }
  }, [isAuthenticated, savedAddresses, selectedAddressId])

  const selectedAddressExists = useMemo(() => {
    if (!isAuthenticated) return address.street.trim().length > 0
    return !!savedAddresses?.some((a) => a._id === selectedAddressId)
  }, [isAuthenticated, savedAddresses, selectedAddressId, address.street])

  const canSubmit =
    items.length > 0 &&
    !closedTodayInfo &&
    !maintenanceMode &&
    !outOfDeliveryRange &&
    (deliveryType === 'pickup' || selectedAddressExists) &&
    (isAuthenticated || (guestInfo.name.trim().length > 0 && /^9[678]\d{8}$/.test(guestInfo.phone)))

  const handlePlaceOrder = async () => {
    setSubmitting(true)
    try {
      const payload = {
        items: orderItemsPayload,
        deliveryType,
        paymentMethod,
        specialInstructions: specialInstructions.trim() || undefined,
        couponCode: appliedCoupon?.code || undefined,
        useWallet,
      }
      if (deliveryType !== 'pickup') {
        if (isAuthenticated) {
          const selected = savedAddresses?.find((a) => a._id === selectedAddressId)
          if (!selected) {
            toast.error('Please select a delivery address')
            setSubmitting(false)
            return
          }
          payload.deliveryAddress = {
            type: selected.coordinates ? 'gps' : 'manual',
            street: selected.street,
            area: selected.area,
            city: selected.city,
            landmark: selected.landmark,
            coordinates: selected.coordinates,
          }
        } else {
          payload.deliveryAddress = {
            type: address.coordinates ? 'gps' : 'manual',
            ...address,
          }
        }
      }
      if (!isAuthenticated) {
        payload.guestInfo = guestInfo
      }

      const { data } = await ordersApi.placeOrder(payload)
      clearCart()

      
      const ref = isAuthenticated ? data.order._id : data.order.trackingToken
      setActiveOrder(ref)
      navigate(`/track/${ref}`, {
        replace: true,
        state: {
          justPlaced: true,
          isGuest: !isAuthenticated,
          trackingToken: data.order.trackingToken,
        },
      })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not place your order. Please try again.'))
      setSubmitting(false)
    }
  }

  // ── Empty cart guard ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col">
        <PageHeader title="Checkout" />
        <main className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Your cart is empty.
        </main>
      </div>
    )
  }

  const inputClass = 'w-full border border-border bg-card px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20'
  const inputStyle = { borderRadius: 'var(--gs-radius-lg, 0.75rem)' }

  return (
    <div className="min-h-dvh flex flex-col">
      <PageHeader title="Checkout" />

      {/* Kitchen closed alert */}
      {closedTodayInfo && (
        <div
          role="alert"
          className="mx-4 mt-4 bg-destructive/10 border border-destructive/30 text-destructive p-4 text-sm"
          style={{ borderRadius: 'var(--gs-radius-xl, 1rem)' }}
        >
          <p className="font-bold mb-1">Kitchen is Closed Today</p>
          <p>{closedTodayInfo.reason || 'We are not accepting orders today.'}</p>
        </div>
      )}

      {/* Maintenance mode alert */}
      {!closedTodayInfo && maintenanceMode && (
        <div
          role="alert"
          className="mx-4 mt-4 bg-destructive/10 border border-destructive/30 text-destructive p-4 text-sm"
          style={{ borderRadius: 'var(--gs-radius-xl, 1rem)' }}
        >
          <p className="font-bold mb-1">Ordering Temporarily Unavailable</p>
          <p>{maintenanceMessage || 'We are temporarily unable to accept orders. Please try again shortly.'}</p>
        </div>
      )}

      {/* Out of delivery range alert */}
      {!closedTodayInfo && !maintenanceMode && outOfDeliveryRange && (
        <div
          role="alert"
          className="mx-4 mt-4 bg-destructive/10 border border-destructive/30 text-destructive p-4 text-sm"
          style={{ borderRadius: 'var(--gs-radius-xl, 1rem)' }}
        >
          <p className="font-bold mb-1">Outside Our Delivery Area</p>
          <p>
            That address is about {distanceKm.toFixed(1)} km away — we currently deliver up to {maxDeliveryDistanceKm} km.
            Try pickup, or choose a closer address.
          </p>
        </div>
      )}

      <main className="flex-1 px-4 py-4 flex flex-col gap-6">

        {/* ── Delivery or pickup ── */}
        <section aria-labelledby={deliveryHeadingId}>
          <h2
            id={deliveryHeadingId}
            className="font-display text-sm text-foreground mb-2"
          >
            Delivery or pickup?
          </h2>
          <div
            className="flex gap-2"
            role="radiogroup"
            aria-labelledby={deliveryHeadingId}
          >
            {['delivery', 'pickup'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDeliveryType(type)}
                aria-pressed={deliveryType === type}
                aria-label={type === 'delivery' ? 'Delivery to your address' : 'Pick up from kitchen'}
                className={cn(
                  'flex-1 border py-2.5 text-sm font-medium capitalize active:scale-[0.98] transition-transform gs-focus-ring',
                  'rounded-[var(--gs-radius-lg,0.75rem)]',
                  deliveryType === type
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground'
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </section>

        {/* ── Delivery address — authenticated ── */}
        {deliveryType === 'delivery' && isAuthenticated && (
          <section aria-labelledby={addrHeadingId}>
            <h2
              id={addrHeadingId}
              className="font-display text-sm text-foreground mb-2"
            >
              Delivery address
            </h2>

            {addingNewAddress ? (
              <AddressForm
                submitting={savingAddress}
                onCancel={() => setAddingNewAddress(false)}
                onSubmit={async (form) => {
                  setSavingAddress(true)
                  try {
                    const { data } = await addressApi.create(form)
                    queryClient.setQueryData(['addresses'], data.addresses)
                    queryClient.invalidateQueries({ queryKey: ['addresses'] })
                    const newest = data.addresses[data.addresses.length - 1]
                    if (newest?._id) setSelectedAddressId(newest._id)
                    setAddingNewAddress(false)
                    toast.success('Address saved & selected')
                  } catch (err) {
                    toast.error(getErrorMessage(err))
                  } finally {
                    setSavingAddress(false)
                  }
                }}
              />
            ) : (
              <div
                className="flex flex-col gap-2"
                role="radiogroup"
                aria-labelledby={addrHeadingId}
                aria-label="Select delivery address"
              >
                {savedAddresses?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
                )}
                {savedAddresses?.map((addr) => (
                  <AddressCard
                    key={addr._id}
                    address={addr}
                    selectable
                    selected={selectedAddressId === addr._id}
                    onSelect={(a) => setSelectedAddressId(a._id)}
                    onDelete={async (a) => {
                      try {
                        const { data } = await addressApi.remove(a._id)
                        queryClient.setQueryData(['addresses'], data.addresses)
                        queryClient.invalidateQueries({ queryKey: ['addresses'] })
                        if (selectedAddressId === a._id) {
                          const remaining = data.addresses || []
                          setSelectedAddressId(remaining[0]?._id || null)
                        }
                        toast.success('Address deleted')
                      } catch (err) {
                        toast.error(getErrorMessage(err))
                      }
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setAddingNewAddress(true)}
                  aria-label="Add a new delivery address"
                  className="border border-dashed border-primary text-primary py-2.5 text-sm font-medium gs-focus-ring"
                  style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
                >
                  + Add new address
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Delivery address — guest ── */}
        {deliveryType === 'delivery' && !isAuthenticated && (
          <section aria-labelledby={addrHeadingId}>
            <h2
              id={addrHeadingId}
              className="font-display text-sm text-foreground mb-2"
            >
              Delivery address
            </h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={useGuestLocation}
                disabled={locatingGuestAddress}
                aria-busy={locatingGuestAddress}
                aria-label={locatingGuestAddress ? 'Detecting your location...' : 'Use my current location'}
                className="flex items-center justify-center gap-1.5 border border-primary text-primary py-2 text-sm font-medium disabled:opacity-50 mb-1 gs-focus-ring"
                style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
              >
                <LocateFixed size={15} aria-hidden="true" />
                {locatingGuestAddress ? 'Detecting location...' : 'Use my current location'}
              </button>
              <input
                name="street"
                id="street"
                value={address.street}
                onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
                placeholder="Street address *"
                aria-label="Street address"
                aria-required="true"
                className={inputClass}
                style={inputStyle}
              />
              <input
                name="area"
                id="area"
                value={address.area}
                onChange={(e) => setAddress((a) => ({ ...a, area: e.target.value }))}
                placeholder="Area / neighborhood"
                aria-label="Area or neighborhood"
                className={inputClass}
                style={inputStyle}
              />
              <input
                name="landmark"
                id="landmark"
                value={address.landmark}
                onChange={(e) => setAddress((a) => ({ ...a, landmark: e.target.value }))}
                placeholder="Landmark (optional)"
                aria-label="Nearby landmark (optional)"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </section>
        )}

        {/* ── Guest contact details ── */}
        {!isAuthenticated && (
          <section aria-labelledby={guestHeadingId}>
            <h2
              id={guestHeadingId}
              className="font-display text-sm text-foreground mb-2"
            >
              Your details
            </h2>
            <p className="text-xs text-muted-foreground mb-2">
              Checking out as a guest.{' '}
              <Link to="/login" className="text-primary underline gs-focus-ring rounded-sm">
                Log in
              </Link>{' '}
              to save your order history.
            </p>
            <div className="flex flex-col gap-2">
              <input
                name="guestName"
                id="guestName"
                value={guestInfo.name}
                onChange={(e) => setGuestInfo((g) => ({ ...g, name: e.target.value }))}
                placeholder="Full name *"
                aria-label="Your full name"
                aria-required="true"
                className={inputClass}
                style={inputStyle}
              />
              <input
                name="guestPhone"
                id="guestPhone"
                inputMode="numeric"
                value={guestInfo.phone}
                onChange={(e) =>
                  setGuestInfo((g) => ({ ...g, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))
                }
                placeholder="98XXXXXXXX *"
                aria-label="Your phone number (10 digits starting with 98)"
                aria-required="true"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </section>
        )}

        {/* ── Payment method ── */}
        <section aria-labelledby={paymentHeadingId}>
          <h2
            id={paymentHeadingId}
            className="font-display text-sm text-foreground mb-2"
          >
            Payment method
          </h2>
          <div
            className="flex flex-col gap-2"
            role="radiogroup"
            aria-labelledby={paymentHeadingId}
          >
            {[
              { id: 'cod', label: 'Cash on delivery', enabled: true },
              { id: 'khalti', label: 'Khalti', enabled: false },
              { id: 'esewa', label: 'eSewa', enabled: false },
            ].map((method) => (
              <label
                key={method.id}
                className={cn(
                  'flex items-center justify-between border px-3 py-2.5 text-sm',
                  'rounded-[var(--gs-radius-lg,0.75rem)]',
                  !method.enabled && 'opacity-40 pointer-events-none',
                  paymentMethod === method.id ? 'border-primary bg-primary/5' : 'border-border'
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === method.id}
                    onChange={() => setPaymentMethod(method.id)}
                    disabled={!method.enabled}
                    className="accent-primary"
                    aria-label={method.label}
                  />
                  {method.label}
                </span>
                {!method.enabled && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Lock size={11} aria-hidden="true" />
                    Coming soon
                  </span>
                )}
              </label>
            ))}
          </div>
        </section>

        {/* ── Loyalty wallet ── */}
        {isAuthenticated && (user?.loyaltyPoints || 0) >= 1 && (
          <section aria-labelledby={walletHeadingId}>
            <h2
              id={walletHeadingId}
              className="font-display text-sm text-foreground mb-2"
            >
              Loyalty Wallet
            </h2>
            <label
              htmlFor={walletToggleId}
              className="flex items-center justify-between border border-primary/20 bg-primary/5 px-3 py-3 text-sm cursor-pointer"
              style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
            >
              <div className="flex flex-col">
                <span className="font-medium text-primary">Use Wallet Balance</span>
                <span
                  className="text-[11px] text-muted-foreground"
                  aria-label={`Available wallet balance: ${formatNpr(user.loyaltyPoints)}`}
                >
                  Available: {formatNpr(user.loyaltyPoints)}
                </span>
              </div>
              <input
                id={walletToggleId}
                type="checkbox"
                checked={useWallet}
                onChange={(e) => setUseWallet(e.target.checked)}
                className="accent-primary w-4 h-4"
                aria-label={`Use wallet balance of ${formatNpr(user?.loyaltyPoints || 0)}`}
              />
            </label>
          </section>
        )}

        {/* ── Coupon code ── */}
        <section aria-labelledby={couponHeadingId}>
          <h2
            id={couponHeadingId}
            className="font-display text-sm text-foreground mb-2"
          >
            Coupon code (optional)
          </h2>
          {appliedCoupon ? (
            <div
              className="flex items-center justify-between gap-3 border border-primary/30 bg-primary/5 px-3 py-2.5"
              style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={16} className="text-primary shrink-0" aria-hidden="true" />
                <span className="text-sm font-mono font-semibold text-foreground truncate">{appliedCoupon.code}</span>
                <span className="text-xs text-primary font-semibold shrink-0">- {formatNpr(appliedCoupon.discount)}</span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-xs font-semibold text-muted-foreground hover:text-destructive shrink-0"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                name="couponCode"
                id="couponCode"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError('') }}
                placeholder="E.g. WELCOME10"
                aria-label="Coupon code (optional)"
                aria-describedby={couponError ? couponNoteId : undefined}
                className={`${inputClass} font-mono uppercase flex-1`}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={!couponCode.trim() || validatingCoupon}
                className="px-4 text-sm font-semibold border border-border disabled:opacity-40 shrink-0"
                style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
              >
                {validatingCoupon ? 'Checking…' : 'Apply'}
              </button>
            </div>
          )}
          {couponError && (
            <p
              id={couponNoteId}
              className="text-xs text-destructive mt-1.5 flex items-center gap-1"
              role="alert"
            >
              <XCircle size={12} aria-hidden="true" />
              {couponError}
            </p>
          )}
        </section>

        {/* ── Special instructions ── */}
        <section aria-labelledby={instHeadingId}>
          <h2
            id={instHeadingId}
            className="font-display text-sm text-foreground mb-2"
          >
            Special instructions
          </h2>
          <textarea
            name="specialInstructions"
            id="checkoutInstructions"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder="E.g. call on arrival, gate code..."
            rows={2}
            aria-label="Special instructions for your order (optional)"
            aria-labelledby={instHeadingId}
            className="w-full border border-border bg-card px-3 py-2 text-sm outline-none resize-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
          />
        </section>
      </main>

      {/* ── Order summary + Place Order ── */}
      <section
        role="region"
        aria-labelledby={summaryHeadingId}
        className="border-t border-border bg-card px-4 py-4 flex flex-col gap-3"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <h2 id={summaryHeadingId} className="sr-only">Order summary</h2>

        {/* Subtotal */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span
            className="font-mono font-semibold text-foreground"
            aria-label={`Subtotal: ${formatNpr(preTaxSubtotal)}`}
          >
            {formatNpr(preTaxSubtotal)}
          </span>
        </div>

        {/* VAT */}
        <div className="flex items-center justify-between text-sm -mt-2">
          <span className="text-muted-foreground">13% VAT</span>
          <span
            className="font-mono font-semibold text-foreground"
            aria-label={`VAT: ${formatNpr(vatAmount)}`}
          >
            {formatNpr(vatAmount)}
          </span>
        </div>

        {/* Coupon discount */}
        {couponDiscountValue > 0 && (
          <div
            className="flex items-center justify-between text-sm text-primary -mt-2"
            role="status"
            aria-label={`Coupon ${appliedCoupon.code} applied: ${formatNpr(couponDiscountValue)}`}
          >
            <span>Coupon ({appliedCoupon.code})</span>
            <span className="font-mono font-semibold">- {formatNpr(couponDiscountValue)}</span>
          </div>
        )}

        {/* Global discount */}
        {globalDiscountValue > 0 && (
          <div
            className="flex items-center justify-between text-sm text-primary -mt-2"
            role="status"
            aria-label={`${globalDiscountLabel} applied: ${formatNpr(globalDiscountValue)}`}
          >
            <span>{globalDiscountLabel}</span>
            <span className="font-mono font-semibold">- {formatNpr(globalDiscountValue)}</span>
          </div>
        )}

        {/* Subscription discount */}
        {subscriptionDiscount > 0 && (
          <div
            className="flex items-center justify-between text-sm text-primary -mt-2"
            role="status"
            aria-label={`Meal plan discount applied: ${formatNpr(subscriptionDiscount)}`}
          >
            <span>Meal Plan Applied</span>
            <span className="font-mono font-semibold">- {formatNpr(subscriptionDiscount)}</span>
          </div>
        )}

        {/* Delivery fee */}
        {deliveryType === 'delivery' && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Delivery Fee</span>
            <span
              className="font-mono font-semibold text-foreground"
              aria-label={`Delivery fee: ${deliveryFee === 0 ? 'Free' : formatNpr(deliveryFee)}`}
            >
              {deliveryFee === 0 ? 'Free' : formatNpr(deliveryFee)}
            </span>
          </div>
        )}

        {/* Wallet discount */}
        {walletDiscountValue > 0 && (
          <div
            className="flex items-center justify-between text-sm text-primary"
            role="status"
            aria-label={`Wallet discount applied: ${formatNpr(walletDiscountValue)}`}
          >
            <span>Wallet Discount</span>
            <span className="font-mono font-semibold">- {formatNpr(walletDiscountValue)}</span>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between font-display text-lg mt-2 pt-2 border-t border-border">
          <span className="text-foreground">Total</span>
          <span
            className="font-mono text-primary"
            aria-label={`Order total: ${formatNpr(finalTotal)}`}
          >
            {formatNpr(finalTotal)}
          </span>
        </div>

        {/* Submitting SR announcement */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {submitting ? 'Placing your order, please wait...' : ''}
        </div>

        {/* Place Order CTA */}
        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={!canSubmit || submitting || !!closedTodayInfo}
          aria-disabled={!canSubmit || submitting || !!closedTodayInfo}
          aria-busy={submitting}
          aria-label={
            closedTodayInfo
              ? 'Kitchen is closed today'
              : maintenanceMode
              ? 'Ordering is temporarily unavailable'
              : outOfDeliveryRange
              ? 'Address is outside our delivery area'
              : submitting
              ? 'Placing your order...'
              : `Place order — Total: ${formatNpr(finalTotal)}`
          }
          className="py-3 text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-40 active:scale-[0.98] transition-transform gs-focus-ring"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        >
          {closedTodayInfo
            ? 'Closed Today'
            : maintenanceMode
            ? 'Unavailable'
            : outOfDeliveryRange
            ? 'Outside Delivery Area'
            : submitting
            ? 'Placing order...'
            : 'Place order'}
        </button>
      </section>
    </div>
  )
}