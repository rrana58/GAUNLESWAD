import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, addDays, addHours, isBefore } from 'date-fns'
import { getCelebrationPackages, placeCelebrationOrder } from '@/api/celebrations'
import { ordersApi } from '@/api/orders'
import { useAuthStore } from '@/store/authStore'
import { ChevronLeft, Calendar, Clock, MapPin, Loader2, Plus, Minus, Info, Gift, CheckCircle2, ChevronRight } from 'lucide-react'

export default function CelebrationsPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  
  const [step, setStep] = useState(1) // 1: Packages, 2: Menus, 3: Configure, 4: Checkout
  
  // Data State
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['celebration-packages'],
    queryFn: () => getCelebrationPackages().then(r => r.data.packages),
  })

  const { data: closedDatesRes } = useQuery({
    queryKey: ['closed-dates'],
    queryFn: () => ordersApi.getClosedDates().then(r => r.data),
  })
  const closedDatesList = closedDatesRes?.closedDates || []
  const closedDateStrings = closedDatesList.map(d => d.date)

  const celebrationTypes = useMemo(() => {
    const types = new Set(packages.map(p => p.celebrationType))
    return Array.from(types)
  }, [packages])

  const [selectedType, setSelectedType] = useState('')
  useEffect(() => {
    if (celebrationTypes.length > 0 && !selectedType) {
      setSelectedType(celebrationTypes[0])
    }
  }, [celebrationTypes, selectedType])

  // Form State
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [selectedMenu, setSelectedMenu] = useState(null)
  const [dietaryPreference, setDietaryPreference] = useState('veg') // veg | non-veg
  const [pax, setPax] = useState(4)
  const [paymentMethod, setPaymentMethod] = useState('esewa')
  const [fullPayment, setFullPayment] = useState(false)
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [address, setAddress] = useState({
    street: '', area: '', city: 'Kathmandu', landmark: ''
  })
  
  const minDate = format(new Date(), 'yyyy-MM-dd')
  const maxDate = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg)
    if (pkg.menus?.length === 1) {
      handleSelectMenu(pkg.menus[0])
    } else {
      setStep(2)
    }
  }

  const handleSelectMenu = (menu) => {
    setSelectedMenu(menu)
    if (!menu.vegDetails?.price) setDietaryPreference('non-veg')
    else if (!menu.nonVegDetails?.price) setDietaryPreference('veg')
    else setDietaryPreference('veg')
    
    setPax(menu.minPax || 4)
    setStep(3)
  }

  const pricePerPerson = useMemo(() => {
    if (!selectedMenu) return 0
    return dietaryPreference === 'veg' ? selectedMenu.vegDetails.price : selectedMenu.nonVegDetails.price
  }, [selectedMenu, dietaryPreference])

  const displaySubtotal = pricePerPerson * pax
  const preTaxSubtotal = displaySubtotal / 1.13
  const vatAmount = displaySubtotal - preTaxSubtotal
  
  // Celebration orders over Rs. 1000 get free delivery, otherwise Rs. 100
  const deliveryFee = displaySubtotal > 0 ? (displaySubtotal >= 1000 ? 0 : 100) : 0
  const totalAmount = displaySubtotal + deliveryFee
  const advanceAmount = fullPayment ? totalAmount : Math.round(totalAmount / 2)
  const balanceAmount = totalAmount - advanceAmount

  const placeOrder = useMutation({
    mutationFn: (data) => placeCelebrationOrder(data),
    onSuccess: (res) => {
      toast.success('Celebration booked successfully!')
      navigate(`/track/${res.data.order._id}`)
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to place order')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!isAuthenticated) {
      toast.error('Please login to book a celebration')
      navigate('/login?redirect=/celebrations')
      return
    }

    if (!address.street) {
      toast.error('Delivery street address is required.')
      return
    }
    
    if (!eventDate || !eventTime) {
      toast.error('Please select both date and time for your celebration.')
      return
    }

    placeOrder.mutate({
      packageId: selectedPackage._id,
      menuId: selectedMenu._id,
      dietaryPreference,
      pax,
      deliveryType: 'delivery',
      deliveryAddress: { ...address, type: 'manual' },
      paymentMethod,
      fullPayment,
      celebrationDetails: {
        celebrationType: selectedPackage.celebrationType,
        eventDate,
        eventTime
      },
    })
  }

  const handleProceedToCheckout = () => {
    setStep(4)
  }

  const renderStep1 = () => (
    <div className="space-y-5 animate-in slide-in-from-right-4 pb-10">
      {/* Types Tabs */}
      {celebrationTypes.length > 0 && (
        <div className="overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
          <div className="flex gap-2 w-max">
            {celebrationTypes.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedType === type 
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-200' 
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Packages List */}
      {isLoading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-purple-500" /></div>
      ) : packages.length === 0 ? (
        <div className="text-center text-gray-500 py-10 bg-white rounded-2xl border border-gray-100">
          <Gift size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No celebration packages available right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {packages.filter(p => p.celebrationType === selectedType).map(pkg => (
            <div key={pkg._id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-display font-semibold text-gray-900 text-lg">{pkg.name}</h3>
                  {pkg.description && <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>}
                </div>
              </div>
              
              <div className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100 inline-block">
                {pkg.menus?.length || 0} Menu Option(s) Available
              </div>

              <button 
                onClick={() => handleSelectPackage(pkg)}
                className="w-full bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 border border-purple-200 rounded-md py-2 font-medium"
              >
                View Menu Options
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderStep2 = () => {
    if (!selectedPackage) return null
    return (
      <div className="space-y-5 animate-in slide-in-from-right-4 pb-24">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="font-display font-semibold text-gray-900 text-lg">{selectedPackage.name}</h3>
          <p className="text-sm text-purple-600 font-medium">{selectedPackage.celebrationType}</p>
          
          {selectedPackage.description && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-700 leading-relaxed italic">
                "{selectedPackage.description}"
              </p>
            </div>
          )}
        </div>

        <h3 className="font-display font-semibold text-gray-900 mb-2 px-1">Select a Menu</h3>
        
        <div className="space-y-4">
          {selectedPackage.menus?.map(menu => (
            <div key={menu._id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:border-purple-200 transition-colors cursor-pointer" onClick={() => handleSelectMenu(menu)}>
              <div className="p-4 border-b border-gray-50">
                <div className="flex justify-between items-center">
                  <h4 className="font-display font-semibold text-gray-900">{menu.name}</h4>
                  <ChevronRight size={18} className="text-gray-400" />
                </div>
                {menu.description && <p className="text-sm text-gray-500 mt-1">{menu.description}</p>}
              </div>
              
              <div className="p-3 bg-gray-50 flex flex-wrap gap-2">
                {menu.vegDetails?.price > 0 && (
                  <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium border border-green-100">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Veg: Rs. {menu.vegDetails.price}/pax
                  </span>
                )}
                {menu.nonVegDetails?.price > 0 && (
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-medium border border-red-100">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    Non-Veg: Rs. {menu.nonVegDetails.price}/pax
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderStep3 = () => {
    if (!selectedPackage || !selectedMenu) return null
    return (
      <div className="space-y-5 animate-in slide-in-from-right-4 pb-24">
        {/* Menu Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-gray-900 text-lg">{selectedMenu.name}</h3>
            <button onClick={() => setStep(2)} className="text-xs text-purple-600 font-medium">Change Menu</button>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-3">{selectedPackage.name}</p>
          
          {/* Dietary Preference */}
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-gray-700">Select Preference</label>
            <div className="grid grid-cols-2 gap-3">
              {selectedMenu.vegDetails?.price > 0 && (
                <button
                  onClick={() => setDietaryPreference('veg')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    dietaryPreference === 'veg' 
                      ? 'border-green-500 bg-green-50/50 ring-1 ring-green-500' 
                      : 'border-gray-200 bg-white hover:border-green-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-green-700 flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> Veg
                    </span>
                    {dietaryPreference === 'veg' && <CheckCircle2 size={16} className="text-green-600" />}
                  </div>
                  <p className="text-sm font-bold text-gray-900">Rs. {selectedMenu.vegDetails.price} <span className="text-xs font-normal text-gray-500">/pax</span></p>
                </button>
              )}
              {selectedMenu.nonVegDetails?.price > 0 && (
                <button
                  onClick={() => setDietaryPreference('non-veg')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    dietaryPreference === 'non-veg' 
                      ? 'border-red-500 bg-red-50/50 ring-1 ring-red-500' 
                      : 'border-gray-200 bg-white hover:border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-red-700 flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> Non-Veg
                    </span>
                    {dietaryPreference === 'non-veg' && <CheckCircle2 size={16} className="text-red-600" />}
                  </div>
                  <p className="text-sm font-bold text-gray-900">Rs. {selectedMenu.nonVegDetails.price} <span className="text-xs font-normal text-gray-500">/pax</span></p>
                </button>
              )}
            </div>
          </div>

          {/* Included Items */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Menu Included</label>
            <ul className="text-sm text-gray-700 space-y-1 pl-4 list-disc marker:text-purple-400">
              {(dietaryPreference === 'veg' ? selectedMenu.vegDetails.items : selectedMenu.nonVegDetails.items).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Configuration */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900 block">Number of Guests (Pax)</label>
              <span className="text-xs text-gray-500">Minimum {selectedMenu.minPax || 4} people required</span>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-1">
              <button 
                onClick={() => setPax(p => Math.max(selectedMenu.minPax || 4, p - 1))}
                disabled={pax <= (selectedMenu.minPax || 4)}
                className="w-8 h-8 flex items-center justify-center bg-white rounded-md text-gray-700 shadow-sm disabled:opacity-50"
              >
                <Minus size={16} />
              </button>
              <span className="font-bold w-6 text-center text-gray-900">{pax}</span>
              <button 
                onClick={() => setPax(p => p + 1)}
                className="w-8 h-8 flex items-center justify-center bg-white rounded-md text-gray-700 shadow-sm"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Event Date & Time</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Date</label>
                <input 
                  type="date" 
                  min={minDate} 
                  max={maxDate} 
                  value={eventDate} 
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (closedDateStrings.includes(selected)) {
                      const reason = closedDatesList.find(c => c.date === selected)?.reason || 'Kitchen closed';
                      toast.error(`We are closed on ${selected} (${reason}). Please select another date.`);
                      setEventDate('');
                    } else {
                      setEventDate(selected);
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Time</label>
                <input 
                  type="time" 
                  value={eventTime} 
                  onChange={e => setEventTime(e.target.value)} 
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500" 
                />
              </div>
            </div>
          </div>

        </div>

        <div 
          className="bg-white border-t border-gray-100 flex gap-3 mt-6 pt-4"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <button 
            className="h-12 w-12 shrink-0 rounded-xl border border-gray-300 flex items-center justify-center bg-white hover:bg-gray-50 text-gray-700"
            onClick={() => setStep(selectedPackage.menus?.length === 1 ? 1 : 2)}
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            type="button"
            className="flex-1 h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-base shadow-lg shadow-purple-600/20 disabled:opacity-50 flex items-center justify-center"
            onClick={handleProceedToCheckout}
          >
            Checkout (Rs. {totalAmount.toLocaleString()})
          </button>
        </div>
      </div>
    )
  }

  const renderStep4 = () => (
    <form onSubmit={handleSubmit} className="space-y-5 pb-28 animate-in slide-in-from-right-4">
      {/* Delivery Address */}
      <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2 text-gray-900">
          <MapPin size={18} className="text-purple-500" /> Delivery Location
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Street Address *</label>
            <input value={address.street} onChange={e => setAddress({...address, street: e.target.value})} placeholder="House number and street" required className="flex h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mt-1.5 transition-shadow" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Area / Tole</label>
              <input value={address.area} onChange={e => setAddress({...address, area: e.target.value})} placeholder="Area" className="flex h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mt-1.5 transition-shadow" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">City *</label>
              <input value={address.city} onChange={e => setAddress({...address, city: e.target.value})} placeholder="City name" required className="flex h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mt-1.5 transition-shadow" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Landmark (Optional)</label>
            <input value={address.landmark} onChange={e => setAddress({...address, landmark: e.target.value})} placeholder="Any nearby landmark" className="flex h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mt-1.5 transition-shadow" />
          </div>
        </div>
      </section>

      {/* Payment Selection */}
      <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <h3 className="font-display font-semibold mb-3 text-gray-900">Deposit & Payment</h3>
        <div className="bg-blue-50/80 text-blue-800 text-sm p-3 rounded-xl mb-4 flex gap-2 border border-blue-100">
          <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
          <p>Celebration orders require at least a 50% advance deposit to confirm your booking.</p>
        </div>
        
        <div className="space-y-2.5 mb-5">
          <label className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-all ${!fullPayment ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-500' : 'border-gray-200 hover:border-purple-300'}`}>
            <div>
              <span className="font-semibold text-gray-900 block">Pay 50% Deposit</span>
              <span className="text-sm text-gray-500">Balance on delivery</span>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!fullPayment ? 'border-purple-600' : 'border-gray-300'}`}>
              {!fullPayment && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
            </div>
          </label>
          <label className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-all ${fullPayment ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-500' : 'border-gray-200 hover:border-purple-300'}`}>
            <div>
              <span className="font-semibold text-gray-900 block">Pay Full Amount</span>
              <span className="text-sm text-gray-500">Nothing to pay later</span>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${fullPayment ? 'border-purple-600' : 'border-gray-300'}`}>
              {fullPayment && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
            </div>
          </label>
        </div>

        <label className="block mb-2.5 text-sm font-semibold text-gray-900">Select Payment Method</label>
        <div className="grid grid-cols-2 gap-3">
          <label className={`flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer transition-all h-20 ${paymentMethod === 'esewa' ? 'border-green-500 bg-green-50/30 ring-1 ring-green-500' : 'border-gray-200 hover:border-green-300'}`}>
            <img src="/esewa.png" alt="eSewa" className="h-8 object-contain" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block' }} />
            <span className="font-bold text-green-600 hidden">eSewa</span>
          </label>
          <label className={`flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer transition-all h-20 ${paymentMethod === 'khalti' ? 'border-purple-500 bg-purple-50/30 ring-1 ring-purple-500' : 'border-gray-200 hover:border-purple-300'}`}>
            <img src="/khalti.png" alt="Khalti" className="h-8 object-contain" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block' }} />
            <span className="font-bold text-purple-700 hidden">Khalti</span>
          </label>
        </div>
      </section>

      {/* Bill Summary */}
      <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-display font-semibold mb-4 text-gray-900">Bill Summary</h3>
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal ({pax} Pax)</span>
            <span className="font-medium text-gray-900">Rs. {Math.round(preTaxSubtotal).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>13% VAT</span>
            <span className="font-medium text-gray-900">Rs. {Math.round(vatAmount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Delivery Fee</span>
            <span className="font-medium text-gray-900">{deliveryFee === 0 ? <span className="text-green-600 font-semibold">Free</span> : `Rs. ${deliveryFee}`}</span>
          </div>
          <div className="border-t border-dashed border-gray-200 pt-3 mt-3 flex justify-between font-bold text-gray-900 text-base">
            <span>Total Amount</span>
            <span>Rs. {totalAmount.toLocaleString()}</span>
          </div>
          <div className="border-t border-gray-100 pt-3 mt-3 flex justify-between font-bold text-purple-700">
            <span>To Pay Now (Advance)</span>
            <span className="text-lg">Rs. {advanceAmount.toLocaleString()}</span>
          </div>
          {!fullPayment && (
            <div className="flex justify-between font-medium text-gray-500 text-xs mt-1">
              <span>Balance Due on Delivery</span>
              <span>Rs. {balanceAmount.toLocaleString()}</span>
            </div>
          )}
        </div>
      </section>

      <div 
        className="bg-white border-t border-gray-100 flex gap-3 mt-6 pt-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <button 
          type="button"
          className="h-12 w-12 shrink-0 rounded-xl border border-gray-300 flex items-center justify-center bg-white hover:bg-gray-50 text-gray-700"
          onClick={() => setStep(3)}
        >
          <ChevronLeft size={20} />
        </button>
        <button 
          type="submit"
          className="flex-1 h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-base shadow-lg shadow-purple-600/20 disabled:opacity-50 flex items-center justify-center"
          disabled={placeOrder.isPending}
        >
          {placeOrder.isPending ? <Loader2 className="animate-spin mr-2" /> : `Pay Rs. ${advanceAmount.toLocaleString()}`}
        </button>
      </div>
    </form>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-safe font-sans">
      <header className="bg-white sticky top-0 z-30 border-b border-gray-100">
        <div className="h-14 px-4 flex items-center gap-3">
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
            className="w-8 h-8 flex items-center justify-center -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="font-display font-semibold text-lg text-gray-900">Book Celebration</h1>
        </div>
        
        {/* Progress bar */}
        <div className="flex px-4 py-3 gap-2 bg-white text-[10px] font-semibold text-gray-400 border-t border-gray-50 text-center">
          <div className={`flex-1 flex flex-col gap-1.5 ${step >= 1 ? 'text-purple-700' : ''}`}>
            <span className="uppercase tracking-wider">Packages</span>
            <div className={`h-1 rounded-full w-full ${step >= 1 ? 'bg-purple-600' : 'bg-gray-200'}`} />
          </div>
          <div className={`flex-1 flex flex-col gap-1.5 ${step >= 2 ? 'text-purple-700' : ''}`}>
            <span className="uppercase tracking-wider">Menu</span>
            <div className={`h-1 rounded-full w-full ${step >= 2 ? 'bg-purple-600' : 'bg-gray-200'}`} />
          </div>
          <div className={`flex-1 flex flex-col gap-1.5 ${step >= 3 ? 'text-purple-700' : ''}`}>
            <span className="uppercase tracking-wider">Details</span>
            <div className={`h-1 rounded-full w-full ${step >= 3 ? 'bg-purple-600' : 'bg-gray-200'}`} />
          </div>
          <div className={`flex-1 flex flex-col gap-1.5 ${step >= 4 ? 'text-purple-700' : ''}`}>
            <span className="uppercase tracking-wider">Checkout</span>
            <div className={`h-1 rounded-full w-full ${step >= 4 ? 'bg-purple-600' : 'bg-gray-200'}`} />
          </div>
        </div>
      </header>

      <main className="p-4">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </main>
    </div>
  )
}
