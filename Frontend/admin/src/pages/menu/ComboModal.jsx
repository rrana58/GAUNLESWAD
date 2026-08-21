import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { uploadMenuImage } from '@/api/menu'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

/**
 * ComboModal — Design System: Phase 5.4
 *
 * Token changes:
 *  - Custom fixed inset-0 dialog shell → <Modal size="lg">
 *    (Escape/backdrop/focus trap come from Modal)
 *  - bg-white rounded-2xl sticky header → handled by Modal component
 *  - text-gray-900 → text-foreground (title via Modal)
 *  - text-gray-400 (X icon) → handled by Modal close button
 *  - Combo image placeholder border-gray-200 text-gray-300 → border-border text-muted-foreground/30
 *  - border-gray-200 bg-white (selects) → border-border bg-card
 *  - Combo items empty state border-dashed border-gray-100 text-gray-400 → border-border text-muted-foreground
 *  - text-orange-500 hover:text-orange-600 (upload trigger) → var(--gs-admin-accent)
 *  - Loader2 animate-spin text-orange-500 → <Spinner size="sm">
 *  - bg-orange-500 hover:bg-orange-600 (submit button) → var(--gs-admin-accent) style
 *  - border-gray-100 (footer divider) → border-border
 *  - rounded-lg / rounded-2xl / rounded-full → radius tokens via style
 *  - Plus icon: aria-hidden (was missing)
 *  - Trash2 icon: aria-hidden + aria-label on button (was missing)
 *  - Image remove button X: aria-label preserved; X icon aria-hidden
 *
 * Accessibility (new):
 *  - <Modal> provides role="dialog" aria-modal aria-labelledby Escape focus trap
 *  - <form aria-label> for combo form
 *  - <fieldset><legend> for Image, Core fields, and Combo Items groups
 *  - Combo Name, Category, Price inputs: htmlFor + id (were missing ids in original)
 *  - Description input: id + htmlFor
 *  - Category select: id + aria-required
 *  - Combo items select: aria-label per row (row index)
 *  - Quantity input: aria-label per row
 *  - Remove item button: aria-label="Remove item {idx}"
 *  - Plus icon in Add Item button: aria-hidden
 *  - Upload trigger: cursor-pointer with aria-label on file input
 *  - Uploading spinner: label prop
 *  - Submit button: aria-busy={loading}
 *  - Available checkbox: existing htmlFor preserved
 *
 * No business logic, mutation, state, or prop interface changes.
 */

const selectCls = `w-full h-9 px-3 text-sm border border-border bg-card text-foreground
  focus:outline-none gs-admin-focus-ring`
const selectStyle = { borderRadius: 'var(--gs-admin-radius-md)' }

export default function ComboModal({ combo, categories, allMenuItems, onClose, onSave }) {
  const [form, setForm] = useState({
    name: combo?.name || '',
    category: combo?.category?._id || combo?.category || '',
    basePrice: combo?.basePrice || '',
    description: combo?.description || '',
    isAvailable: combo?.isAvailable ?? true,
    isCombo: true,
    comboItems: combo?.comboItems?.map((ci) => ({
      item: ci.item?._id || ci.item,
      quantity: ci.quantity,
    })) || [],
    image: combo?.image || null,
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(combo?.image?.url || null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [itemSearch, setItemSearch] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const addComboItem = () =>
    setForm((f) => ({ ...f, comboItems: [...f.comboItems, { item: '', quantity: 1 }] }))

  const updateComboItem = (index, field, value) => {
    setForm((f) => {
      const newItems = [...f.comboItems]
      newItems[index][field] = value
      return { ...f, comboItems: newItems }
    })
  }

  const removeComboItem = (index) =>
    setForm((f) => ({ ...f, comboItems: f.comboItems.filter((_, i) => i !== index) }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    if (!form.category) return toast.error('Category is required')
    if (!form.basePrice || isNaN(form.basePrice)) return toast.error('Valid price is required')
    if (form.comboItems.length === 0) return toast.error('Add at least one item to the combo')
    if (form.comboItems.some((ci) => !ci.item)) return toast.error('Please select an item for all combo rows')

    setLoading(true)
    try {
      let imageData = form.image
      if (imageFile) {
        setUploadingImage(true)
        const formData = new FormData()
        formData.append('image', imageFile)
        const { data } = await uploadMenuImage(formData)
        imageData = { url: data.url, publicId: data.publicId }
        setUploadingImage(false)
      }
      const payload = { ...form, basePrice: Number(form.basePrice), image: imageData }
      await onSave(payload)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save combo')
    } finally {
      setLoading(false)
      setUploadingImage(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={combo ? 'Edit Combo' : 'New Combo'}
      size="lg"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-6"
        aria-label={combo ? 'Edit combo form' : 'New combo form'}
      >
        {/* Image upload */}
        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend><Label>Combo Image</Label></legend>
          <div className="flex items-center gap-4">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Combo preview"
                  className="w-24 h-24 object-cover border border-border"
                  style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                />
                <button
                  type="button"
                  aria-label="Remove combo image"
                  onClick={() => { setImagePreview(null); setImageFile(null); set('image', null) }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs"
                  style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div
                className="w-24 h-24 border-2 border-dashed border-border flex items-center justify-center text-muted-foreground/30"
                style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
              >
                <span className="text-3xl" aria-hidden="true">🍱</span>
              </div>
            )}
            <label
              className="cursor-pointer gs-admin-focus-ring"
              tabIndex={0}
              style={{ borderRadius: 'var(--gs-admin-radius-sm)' }}
            >
              <span
                className="text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ color: 'var(--gs-admin-accent)' }}
              >
                {imagePreview ? 'Change image' : 'Upload image'}
              </span>
              <input
                name="image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
                aria-label="Upload combo image"
              />
            </label>
            {uploadingImage && <Spinner size="sm" label="Uploading combo image…" />}
          </div>
        </fieldset>

        {/* Core fields */}
        <fieldset className="border-0 p-0 m-0">
          <legend className="sr-only">Combo information</legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="combo-name">Combo Name *</Label>
              <Input
                id="combo-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Mega Burger Combo"
                required
                aria-required="true"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="combo-category">Category *</Label>
              <select
                id="combo-category"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className={selectCls}
                style={selectStyle}
                aria-required="true"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="combo-price">Combo Price (Rs.) *</Label>
              <Input
                id="combo-price"
                type="number"
                value={form.basePrice}
                onChange={(e) => set('basePrice', e.target.value)}
                placeholder="500"
                required
                aria-required="true"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="combo-desc">Description</Label>
              <Input
                id="combo-desc"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Short description"
              />
            </div>
          </div>
        </fieldset>

        {/* Combo items builder */}
        <fieldset className="border-0 p-0 m-0 space-y-3">
          <legend>
            <div className="flex items-center justify-between mb-1">
              <Label>Combo Items *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addComboItem}
                className="h-8 gs-admin-focus-ring"
                aria-label="Add item to combo"
              >
                <Plus size={14} className="mr-1" aria-hidden="true" />
                Add Item
              </Button>
            </div>
          </legend>

          <div className="mb-2">
            <Input
              type="search"
              placeholder="Filter available items list..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {form.comboItems.length === 0 ? (
            <div
              className="text-center py-6 text-muted-foreground border-2 border-dashed border-border text-sm"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
              role="status"
            >
              No items added to this combo yet.
            </div>
          ) : (
            <div className="space-y-2">
              {form.comboItems.map((ci, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={ci.item}
                    onChange={(e) => updateComboItem(idx, 'item', e.target.value)}
                    className={`flex-1 ${selectCls}`}
                    style={selectStyle}
                    aria-label={`Combo item ${idx + 1}: select menu item`}
                  >
                    <option value="">Select a menu item...</option>
                    {allMenuItems
                      .filter((i) => !i.isCombo && (!itemSearch || i.name.toLowerCase().includes(itemSearch.toLowerCase())))
                      .map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name} (Rs. {item.basePrice})
                        </option>
                      ))}
                  </select>
                  <Input
                    type="number"
                    min="1"
                    className="w-24 h-9"
                    value={ci.quantity}
                    onChange={(e) => updateComboItem(idx, 'quantity', Number(e.target.value))}
                    placeholder="Qty"
                    aria-label={`Combo item ${idx + 1}: quantity`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-red-500 gs-admin-focus-ring"
                    aria-label={`Remove combo item ${idx + 1}`}
                    onClick={() => removeComboItem(idx)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        {/* Availability */}
        <div className="flex items-center gap-2">
          <input
            id="combo-available"
            type="checkbox"
            checked={form.isAvailable}
            onChange={(e) => set('isAvailable', e.target.checked)}
            className="rounded cursor-pointer"
          />
          <Label htmlFor="combo-available" className="cursor-pointer">Combo is Available</Label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="flex-1 gs-admin-focus-ring"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 gs-admin-focus-ring"
            style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Spinner size="sm" label="Saving combo…" className="mr-2" />}
            {combo ? 'Save Combo' : 'Create Combo'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}