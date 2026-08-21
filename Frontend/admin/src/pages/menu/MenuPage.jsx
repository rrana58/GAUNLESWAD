import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  getAdminMenuItems, createMenuItem, updateMenuItem, deleteMenuItem,
  toggleMenuItemAvailability,
  uploadMenuImage,
} from '@/api/menu'
import api from '@/api/axios'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, X, Search, ToggleLeft, ToggleRight, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ComboModal from './ComboModal'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'

/**
 * MenuPage — Design System: Phase 5.4
 *
 * Token changes (all three embedded sub-components + main page):
 *
 *  Backgrounds
 *   bg-white → bg-card
 *   bg-gray-50/bg-gray-100 → bg-muted
 *
 *  Text
 *   text-gray-900/800/700 → text-foreground
 *   text-gray-600/500 → text-muted-foreground
 *   text-gray-400/300 → text-muted-foreground/60
 *
 *  Borders
 *   border-gray-100/200 → border-border
 *   divide-gray-50 → divide-border
 *
 *  Radius (all via style prop)
 *   rounded-xl → var(--gs-admin-radius-xl)
 *   rounded-2xl → var(--gs-admin-radius-2xl)
 *   rounded-lg/md → var(--gs-admin-radius-lg) / var(--gs-admin-radius-md)
 *   rounded-full → var(--gs-admin-radius-full)
 *
 *  Brand orange
 *   bg-orange-500/600 → style backgroundColor var(--gs-admin-accent)
 *   text-orange-500/600 → style color var(--gs-admin-accent)
 *   bg-orange-100 → var(--gs-admin-accent-muted) inline style
 *   text-orange-600 on featured badge → var(--gs-admin-accent)
 *   border-orange-500 → border-[var(--gs-admin-accent)]
 *
 *  Loading
 *   All Loader2 → Spinner (size="sm" in buttons, size="md" for page loading)
 *
 *  Modals
 *   CategoryModal: fixed inset-0 div → <Modal size="sm">
 *   MenuItemModal: fixed inset-0 div → <Modal size="md">
 *   BulkPriceModal: fixed inset-0 div → <Modal size="sm">
 *   (All three gain Escape/backdrop/focus trap from <Modal>)
 *
 *  Select elements
 *   border-gray-200 bg-white → border-border bg-card
 *
 *  Image upload placeholder
 *   border-gray-200 text-gray-300 → border-border text-muted-foreground/30
 *   Category placeholder bg-gray-100 → bg-muted
 *
 *  Category image fallback in table
 *   bg-gray-100 → bg-muted
 *
 *  Adjustment warning card
 *   bg-amber-50 border-amber-100 text-amber-700 — intentional semantic (preserved)
 *
 *  Toggle button (availability)
 *   text-green-500 — intentional semantic available colour (preserved)
 *   text-gray-300 — unavailable muted → text-border
 *
 *  Delete buttons — text-red-500 — intentional semantic (preserved)
 *
 * Accessibility:
 *   - <main aria-label="Menu management"> wraps all content
 *   - <header> for page title + CTA
 *   - Tab nav: existing role="navigation" aria-label preserved
 *   - Tab buttons: aria-current="page" preserved
 *   - New Item / New Category / New Combo button: aria-label
 *   - Plus icon: aria-hidden
 *   - TrendingUp icon (Bulk Price): aria-hidden
 *   - Search input: sr-only Label preserved
 *   - Category filter select: sr-only Label preserved
 *   - Category table: aria-label + scope="col" on all 4 <th>
 *   - Category image fallback: aria-hidden preserved
 *   - Category Pencil/Trash2 icons: aria-hidden (inside labelled buttons)
 *   - Items table: aria-label + scope="col" on all 5 <th>
 *   - Items image fallback: aria-hidden preserved
 *   - Toggle availability button: existing aria-label preserved
 *   - ToggleLeft/ToggleRight icons: aria-hidden
 *   - Items Pencil/Trash2 icons: aria-hidden (inside labelled buttons)
 *   - Combos table: aria-label + scope="col" on all 5 <th>
 *   - Combos empty row → EmptyState inside <td colSpan>
 *   - Combos toggle: aria-label added; ToggleLeft/ToggleRight aria-hidden
 *   - Combos Pencil/Trash2 icons: aria-hidden
 *   - CategoryModal: <Modal> + <form aria-label> + fieldset/legend + aria-hidden on remove X
 *   - MenuItemModal: <Modal> + <form aria-label> + fieldsets + aria-required + select aria-label
 *   - BulkPriceModal: <Modal> + <form aria-label> + fieldset + aria-pressed on type btns + select id
 *   - All upload labels: htmlFor linked; file inputs have aria-label via wrapping label
 *   - Upload Spinner: label prop provided
 *   - All async submit buttons: aria-busy + Spinner with label
 *   - Cancel/close buttons: existing aria-label maintained via Modal component
 *   - Red image remove button: aria-label preserved; X icon aria-hidden
 *
 * No API, query, mutation, routing, or data logic changed.
 */

// ─── Shared select style helper ─────────────────────────────────────────────
const selectCls = `w-full h-9 px-3 text-sm border border-border bg-card text-foreground
  focus:outline-none gs-admin-focus-ring`
const selectStyle = { borderRadius: 'var(--gs-admin-radius-md)' }

// ─── CategoryModal ───────────────────────────────────────────────────────────
function CategoryModal({ category, onClose, onSave }) {
  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(category?.image?.url || null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageObj, setImageObj] = useState(category?.image || null)

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Name is required')
    setLoading(true)
    try {
      let imageData = imageObj
      if (imageFile) {
        setUploadingImage(true)
        const formData = new FormData()
        formData.append('image', imageFile)
        const { data } = await uploadMenuImage(formData)
        imageData = { url: data.url, publicId: data.publicId }
        setUploadingImage(false)
      }
      await onSave({ name, description, image: imageData })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category')
    } finally {
      setLoading(false)
      setUploadingImage(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? 'Edit Category' : 'New Category'}
      size="sm"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4"
        aria-label={category ? 'Edit category form' : 'New category form'}
      >
        {/* Image upload */}
        <fieldset className="space-y-1.5 border-0 p-0 m-0">
          <legend>
            <Label>Category Image / Icon</Label>
          </legend>
          <div className="flex items-center gap-4">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Category preview"
                  className="w-16 h-16 object-cover border border-border"
                  style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => { setImagePreview(null); setImageFile(null); setImageObj(null) }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs"
                  style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div
                className="w-16 h-16 border-2 border-dashed border-border flex items-center justify-center text-muted-foreground/30"
                style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
              >
                <span className="text-xl" aria-hidden="true">🍲</span>
              </div>
            )}
            <label className="cursor-pointer gs-admin-focus-ring" tabIndex={0} style={{ borderRadius: 'var(--gs-admin-radius-sm)' }}>
              <span
                className="text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ color: 'var(--gs-admin-accent)' }}
              >
                {imagePreview ? 'Change image' : 'Upload image'}
              </span>
              <input
                id="cat-image-upload"
                name="image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
                aria-label="Upload category image"
              />
            </label>
            {uploadingImage && <Spinner size="sm" label="Uploading image…" />}
          </div>
        </fieldset>

        {/* Category name */}
        <div className="space-y-1.5">
          <Label htmlFor="cat-name">Category Name *</Label>
          <Input
            id="cat-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Momo, Rice, Drinks"
            required
            aria-required="true"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="cat-desc">Description</Label>
          <Input
            id="cat-desc"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 gs-admin-focus-ring" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 gs-admin-focus-ring"
            style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Spinner size="sm" label="Saving…" className="mr-2" />}
            {category ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── MenuItemModal ───────────────────────────────────────────────────────────
function MenuItemModal({ item, categories, onClose, onSave }) {
  const initialCategories = item?.categories?.length > 0
    ? item.categories.map(c => c._id || c)
    : (item?.category?._id || item?.category ? [item.category._id || item.category] : [])

  const [form, setForm] = useState({
    name: item?.name || '',
    categories: initialCategories,
    basePrice: item?.basePrice || '',
    description: item?.description || '',
    stockQuantity: item?.stockQuantity ?? '',
    isAvailable: item?.isAvailable ?? true,
    isVeg: item?.isVeg ?? false,
    isFeatured: item?.isFeatured ?? false,
    isCelebrationEligible: item?.isCelebrationEligible ?? false,
    tags: item?.tags?.join(', ') || '',
    image: item?.image || null,
    variants: item?.variants || [],
    addons: item?.addons || [],
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(item?.image?.url || null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const toggleCategory = (catId) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(catId)
        ? f.categories.filter(c => c !== catId)
        : [...f.categories, catId]
    }))
  }

  const addVariant = () => {
    setForm((f) => ({
      ...f,
      variants: [...f.variants, { name: '', price: '', isAvailable: true }],
    }))
  }

  const removeVariant = (index) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.filter((_, i) => i !== index),
    }))
  }

  const updateVariant = (index, field, value) => {
    setForm((f) => {
      const newVariants = [...f.variants]
      newVariants[index] = { ...newVariants[index], [field]: value }
      return { ...f, variants: newVariants }
    })
  }

  const addAddon = () => {
    setForm((f) => ({
      ...f,
      addons: [...f.addons, { name: '', price: '', isAvailable: true }],
    }))
  }

  const removeAddon = (index) => {
    setForm((f) => ({
      ...f,
      addons: f.addons.filter((_, i) => i !== index),
    }))
  }

  const updateAddon = (index, field, value) => {
    setForm((f) => {
      const newAddons = [...f.addons]
      newAddons[index] = { ...newAddons[index], [field]: value }
      return { ...f, addons: newAddons }
    })
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    if (!form.categories || form.categories.length === 0) return toast.error('Select at least one category')
    if (!form.basePrice || isNaN(form.basePrice)) return toast.error('Valid price is required')
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
      const payload = {
        ...form,
        category: form.categories[0], // primary fallback
        categories: form.categories,
        basePrice: Number(form.basePrice),
        stockQuantity: form.stockQuantity !== '' ? Number(form.stockQuantity) : null,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        image: imageData,
        variants: form.variants.map(v => ({ ...v, price: Number(v.price) })),
        addons: form.addons.map(a => ({ ...a, price: Number(a.price) })),
      }
      await onSave(payload)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save item')
    } finally {
      setLoading(false)
      setUploadingImage(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? 'Edit Menu Item' : 'New Menu Item'}
      size="md"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4"
        aria-label={item ? 'Edit menu item form' : 'New menu item form'}
      >
        {/* Image upload */}
        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend><Label>Item Image</Label></legend>
          <div className="flex items-center gap-4">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Item preview"
                  className="w-20 h-20 object-cover border border-border"
                  style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => { setImagePreview(null); setImageFile(null); set('image', null) }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs"
                  style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div
                className="w-20 h-20 border-2 border-dashed border-border flex items-center justify-center text-muted-foreground/30"
                style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
              >
                <span className="text-2xl" aria-hidden="true">🍽️</span>
              </div>
            )}
            <label className="cursor-pointer gs-admin-focus-ring" tabIndex={0} style={{ borderRadius: 'var(--gs-admin-radius-sm)' }}>
              <span
                className="text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ color: 'var(--gs-admin-accent)' }}
              >
                {imagePreview ? 'Change image' : 'Upload image'}
              </span>
              <input
                id="item-image-upload"
                name="image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
                aria-label="Upload menu item image"
              />
            </label>
            {uploadingImage && <Spinner size="sm" label="Uploading image…" />}
          </div>
        </fieldset>

        {/* Core fields */}
        <fieldset className="border-0 p-0 m-0">
          <legend className="sr-only">Item information</legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="item-name">Item Name *</Label>
              <Input
                id="item-name"
                name="name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Steamed Momo"
                required
                aria-required="true"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Categories (Select all that apply) *</Label>
              <div className="border border-border rounded-lg p-2.5 max-h-36 overflow-y-auto space-y-1.5 bg-card">
                {categories.map((c) => (
                  <label key={c._id} className="flex items-center gap-2.5 text-sm cursor-pointer hover:bg-muted p-1 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={form.categories.includes(c._id)}
                      onChange={() => toggleCategory(c._id)}
                      className="rounded cursor-pointer"
                    />
                    <span className="text-foreground">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-price">Base Price (Rs.) *</Label>
              <Input
                id="item-price"
                name="basePrice"
                type="number"
                value={form.basePrice}
                onChange={(e) => set('basePrice', e.target.value)}
                placeholder="150"
                required
                aria-required="true"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-stock">Stock Quantity</Label>
              <Input
                id="item-stock"
                name="stockQuantity"
                type="number"
                value={form.stockQuantity}
                onChange={(e) => set('stockQuantity', e.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-tags">Tags (comma separated)</Label>
              <Input
                id="item-tags"
                name="tags"
                value={form.tags}
                onChange={(e) => set('tags', e.target.value)}
                placeholder="spicy, bestseller"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="item-desc">Description</Label>
              <Input
                id="item-desc"
                name="description"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Short description"
              />
            </div>
          </div>
        </fieldset>

        {/* Variants Section */}
        <fieldset className="border border-border p-4 rounded-lg space-y-3">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Variants / Sub-items (e.g. Veg, Chicken, Buff)
          </legend>
          <div className="space-y-2">
            {form.variants.map((v, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-muted/30 p-2 rounded-lg border border-border">
                <Input
                  placeholder="Variant Name"
                  value={v.name}
                  onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                  className="flex-1 h-9 bg-card"
                  required
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={v.price}
                  onChange={(e) => updateVariant(idx, 'price', e.target.value)}
                  className="w-24 h-9 bg-card"
                  required
                />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={v.isAvailable}
                    onChange={(e) => updateVariant(idx, 'isAvailable', e.target.checked)}
                    className="rounded cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground select-none">Avail</span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeVariant(idx)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 h-8 w-8 rounded-full"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addVariant}
              className="w-full text-xs h-8 text-[var(--gs-admin-accent)] border-[var(--gs-admin-accent)]/30 hover:bg-[var(--gs-admin-accent)]/5"
            >
              <Plus size={14} className="mr-1" />
              Add Variant Option
            </Button>
          </div>
        </fieldset>

        {/* Add-ons Section */}
        <fieldset className="border border-border p-4 rounded-lg space-y-3">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add-ons / Sides (e.g. Extra Achar, Extra Butter)
          </legend>
          <div className="space-y-2">
            {form.addons.map((a, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-muted/30 p-2 rounded-lg border border-border">
                <Input
                  placeholder="Add-on Name"
                  value={a.name}
                  onChange={(e) => updateAddon(idx, 'name', e.target.value)}
                  className="flex-1 h-9 bg-card"
                  required
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={a.price}
                  onChange={(e) => updateAddon(idx, 'price', e.target.value)}
                  className="w-24 h-9 bg-card"
                  required
                />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={a.isAvailable}
                    onChange={(e) => updateAddon(idx, 'isAvailable', e.target.checked)}
                    className="rounded cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground select-none">Avail</span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeAddon(idx)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 h-8 w-8 rounded-full"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAddon}
              className="w-full text-xs h-8 text-[var(--gs-admin-accent)] border-[var(--gs-admin-accent)]/30 hover:bg-[var(--gs-admin-accent)]/5"
            >
              <Plus size={14} className="mr-1" />
              Add Add-on / Extra Option
            </Button>
          </div>
        </fieldset>

        {/* Toggles */}
        <fieldset className="border-0 p-0 m-0">
          <legend className="sr-only">Item options</legend>
          <div className="flex gap-6 flex-wrap">
            {[
              { id: 'item-available', name: 'isAvailable', label: 'Available' },
              { id: 'item-veg',       name: 'isVeg',       label: 'Vegetarian' },
              { id: 'item-featured',  name: 'isFeatured',  label: 'Featured' },
              { id: 'item-celebration', name: 'isCelebrationEligible', label: 'For Celebration' },
            ].map(({ id, name, label }) => (
              <div key={id} className="flex items-center gap-2">
                <input
                  id={id}
                  name={name}
                  type="checkbox"
                  checked={form[name]}
                  onChange={(e) => set(name, e.target.checked)}
                  className="rounded cursor-pointer"
                />
                <Label htmlFor={id} className="cursor-pointer text-sm font-medium">{label}</Label>
              </div>
            ))}
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 gs-admin-focus-ring" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 gs-admin-focus-ring"
            style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Spinner size="sm" label="Saving…" className="mr-2" />}
            {item ? 'Save Changes' : 'Create Item'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── BulkPriceModal ──────────────────────────────────────────────────────────
function BulkPriceModal({ categories, onClose, onSave }) {
  const [form, setForm] = useState({
    categoryId: '',
    adjustmentType: 'percentage',
    adjustmentValue: '',
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.categoryId) return toast.error('Select a category')
    if (!form.adjustmentValue) return toast.error('Enter adjustment value')
    setLoading(true)
    try {
      await onSave({
        categoryId: form.categoryId,
        adjustmentType: form.adjustmentType,
        adjustmentValue: Number(form.adjustmentValue),
      })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Bulk Price Update"
      size="sm"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4"
        aria-label="Bulk price update form"
      >
        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="bulk-category">Category *</Label>
          <select
            id="bulk-category"
            value={form.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
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

        {/* Adjustment type */}
        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend><Label>Adjustment Type *</Label></legend>
          <div className="flex gap-2" role="group" aria-label="Select adjustment type">
            {['percentage', 'fixed'].map((t) => {
              const isActive = form.adjustmentType === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('adjustmentType', t)}
                  aria-pressed={isActive}
                  className="flex-1 py-2 text-sm font-medium border transition-colors capitalize gs-admin-focus-ring"
                  style={{
                    borderRadius: 'var(--gs-admin-radius-lg)',
                    backgroundColor: isActive ? 'var(--gs-admin-accent)' : undefined,
                    color: isActive ? 'var(--gs-admin-accent-foreground)' : undefined,
                    borderColor: isActive ? 'var(--gs-admin-accent)' : undefined,
                  }}
                >
                  {t === 'percentage' ? 'Percentage (%)' : 'Fixed Amount (Rs.)'}
                </button>
              )
            })}
          </div>
        </fieldset>

        {/* Adjustment value */}
        <div className="space-y-1.5">
          <Label htmlFor="bulk-value">
            {form.adjustmentType === 'percentage'
              ? 'Percentage change (e.g. 10 to increase by 10%, -10 to decrease)'
              : 'Fixed amount change (e.g. 20 to add Rs.20, -20 to subtract)'}
          </Label>
          <div className="relative">
            <Input
              id="bulk-value"
              type="number"
              value={form.adjustmentValue}
              onChange={(e) => set('adjustmentValue', e.target.value)}
              placeholder={form.adjustmentType === 'percentage' ? 'e.g. 10' : 'e.g. 20'}
              aria-required="true"
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
              aria-hidden="true"
            >
              {form.adjustmentType === 'percentage' ? '%' : 'Rs.'}
            </span>
          </div>
        </div>

        {/* Warning preview — semantic amber preserved */}
        {form.adjustmentValue && form.categoryId && (
          <div
            className="bg-amber-50 border border-amber-100 p-3 text-sm text-amber-700"
            role="status"
            aria-live="polite"
            style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
          >
            This will {Number(form.adjustmentValue) > 0 ? 'increase' : 'decrease'} all prices
            in the selected category by{' '}
            {form.adjustmentType === 'percentage'
              ? `${Math.abs(form.adjustmentValue)}%`
              : `Rs. ${Math.abs(form.adjustmentValue)}`}.
            This cannot be undone.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 gs-admin-focus-ring" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 gs-admin-focus-ring"
            style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Spinner size="sm" label="Applying…" className="mr-2" />}
            Apply Changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function MenuPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('items')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categoryModal, setCategoryModal] = useState(null)
  const [itemModal, setItemModal] = useState(null)
  const [comboModal, setComboModal] = useState(null)
  const [bulkModal, setBulkModal] = useState(false)

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories().then((r) => r.data.categories || []),
  })

  const { data: itemsData, isLoading } = useQuery({
    queryKey: ['menuItems', categoryFilter],
    queryFn: () => getAdminMenuItems({ category: categoryFilter, limit: 1000 }).then((r) => r.data),
  })

  const categories = categoriesData || []
  const allFetchedItems = itemsData?.items || itemsData?.menuItems || []
  const allItems = allFetchedItems.filter((i) => !i.isCombo)
  const allCombos = allFetchedItems.filter((i) => i.isCombo)
  const items = allItems.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()))
  const combos = allCombos.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()))

  const createCat = useMutation({
    mutationFn: (data) => createCategory(data),
    onSuccess: () => { queryClient.invalidateQueries(['categories']); toast.success('Category created') },
  })
  const updateCat = useMutation({
    mutationFn: ({ id, data }) => updateCategory(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['categories']); toast.success('Category updated') },
  })
  const deleteCat = useMutation({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: () => { queryClient.invalidateQueries(['categories']); toast.success('Category deleted') },
  })
  const createItem = useMutation({
    mutationFn: (data) => createMenuItem(data),
    onSuccess: () => { queryClient.invalidateQueries(['menuItems']); toast.success('Item created') },
  })
  const updateItem = useMutation({
    mutationFn: ({ id, data }) => updateMenuItem(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['menuItems']); toast.success('Item updated') },
  })
  const deleteItem = useMutation({
    mutationFn: (id) => deleteMenuItem(id),
    onSuccess: () => { queryClient.invalidateQueries(['menuItems']); toast.success('Item deleted') },
  })
  const toggleItemAvailability = useMutation({
    mutationFn: (id) => toggleMenuItemAvailability(id),
    onSuccess: () => queryClient.invalidateQueries(['menuItems']),
    onError: (err) => toast.error(err.response?.data?.message || 'Toggle failed'),
  })
  const bulkPrice = useMutation({
    mutationFn: (data) => api.post('/admin/menu/bulk-price', data),
    onSuccess: () => { queryClient.invalidateQueries(['menuItems']); toast.success('Prices updated successfully') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const newButtonLabel =
    tab === 'categories' ? 'New Category' : tab === 'combos' ? 'New Combo' : 'New Item'

  return (
    <main className="space-y-5" aria-label="Menu management">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Menu</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {items.length} items · {categories.length} categories · {combos.length} combos
          </p>
        </div>
        <Button
          aria-label={newButtonLabel}
          className="gs-admin-focus-ring"
          style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
          onClick={() => {
            if (tab === 'categories') setCategoryModal({})
            else if (tab === 'combos') setComboModal({})
            else setItemModal({})
          }}
        >
          <Plus size={16} className="mr-2" aria-hidden="true" />
          {newButtonLabel}
        </Button>
      </header>

      {/* Tab nav */}
      <nav
        className="flex gap-1 p-1 w-fit bg-muted"
        style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
        aria-label="Menu sections"
      >
        {['items', 'combos', 'categories'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`px-4 py-1.5 text-sm font-medium transition-colors capitalize gs-admin-focus-ring ${
              tab === t
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* ── Categories tab ─────────────────────────────────────────── */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <section
            className="bg-card border border-border overflow-hidden"
            aria-label="Categories table"
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          >
            <table className="w-full text-sm" aria-label="Menu categories">
              <thead className="bg-muted border-b border-border">
                <tr className="text-left text-muted-foreground text-xs">
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Slug</th>
                  <th scope="col" className="px-4 py-3 font-medium">Description</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.description && c.description.toLowerCase().includes(search.toLowerCase()))).length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState message="No categories found" sub="Try a different search query" />
                    </td>
                  </tr>
                ) : categories
                  .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.description && c.description.toLowerCase().includes(search.toLowerCase())))
                  .map((cat) => (
                  <tr key={cat._id} className="hover:bg-muted transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {cat.image?.url
                          ? <img src={cat.image.url} alt="" className="w-8 h-8 object-cover" style={{ borderRadius: 'var(--gs-admin-radius-md)' }} />
                          : (
                            <div
                              className="w-8 h-8 bg-muted flex items-center justify-center text-xs"
                              style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                              aria-hidden="true"
                            >🍲</div>
                          )
                        }
                        <span className="font-medium text-foreground">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground/60 font-mono text-xs">{cat.slug}</td>
                    <td className="px-4 py-3 text-muted-foreground">{cat.description || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 gs-admin-focus-ring"
                          aria-label={`Edit ${cat.name}`}
                          onClick={() => setCategoryModal(cat)}
                        >
                          <Pencil size={13} aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 text-red-500 gs-admin-focus-ring"
                          aria-label={`Delete ${cat.name}`}
                          onClick={() => window.confirm(`Delete ${cat.name}?`) && deleteCat.mutate(cat._id)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* ── Items tab ──────────────────────────────────────────────── */}
      {tab === 'items' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Label htmlFor="menu-search" className="sr-only">Search items</Label>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
              <Input
                id="menu-search"
                name="search"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Label htmlFor="category-filter" className="sr-only">Filter by category</Label>
            <select
              id="category-filter"
              name="categoryFilter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 text-sm border border-border bg-card text-foreground gs-admin-focus-ring"
              style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gs-admin-focus-ring"
              aria-label="Bulk price update"
              onClick={() => setBulkModal(true)}
            >
              <TrendingUp size={14} className="mr-2" aria-hidden="true" />
              Bulk Price
            </Button>
          </div>

          <section
            className="bg-card border border-border overflow-hidden"
            aria-label="Menu items"
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Spinner size="md" label="Loading menu items…" />
              </div>
            ) : (
              <table className="w-full text-sm" aria-label="All menu items">
                <thead className="bg-muted border-b border-border">
                  <tr className="text-left text-muted-foreground text-xs">
                    <th scope="col" className="px-4 py-3 font-medium">Name</th>
                    <th scope="col" className="px-4 py-3 font-medium">Category</th>
                    <th scope="col" className="px-4 py-3 font-medium">Price</th>
                    <th scope="col" className="px-4 py-3 font-medium">Available</th>
                    <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState message="No menu items found" sub="Try a different search or category" />
                      </td>
                    </tr>
                  ) : items.map((item) => (
                    <tr key={item._id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.image?.url
                            ? <img src={item.image.url} alt="" className="w-8 h-8 object-cover" style={{ borderRadius: 'var(--gs-admin-radius-md)' }} />
                            : (
                              <div
                                className="w-8 h-8 bg-muted flex items-center justify-center text-xs"
                                style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                                aria-hidden="true"
                              >🍽️</div>
                            )
                          }
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground flex items-center gap-2">
                              {item.name}
                              {item.isFeatured && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider"
                                  style={{
                                    backgroundColor: 'var(--gs-admin-accent-muted)',
                                    color: 'var(--gs-admin-accent)',
                                    borderRadius: 'var(--gs-admin-radius-sm)',
                                  }}
                                >
                                  Featured
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.categories?.length > 0
                          ? item.categories.map(c => c.name).join(', ')
                          : (item.category?.name || '—')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">Rs. {item.basePrice}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleItemAvailability.mutate(item._id)}
                          disabled={toggleItemAvailability.isPending}
                          aria-label={item.isAvailable ? `Mark ${item.name} as unavailable` : `Mark ${item.name} as available`}
                          aria-pressed={item.isAvailable}
                          className={`text-xl transition-colors gs-admin-focus-ring ${item.isAvailable ? 'text-green-500' : 'text-border'}`}
                          style={{ borderRadius: 'var(--gs-admin-radius-sm)' }}
                        >
                          {item.isAvailable
                            ? <ToggleRight size={24} aria-hidden="true" />
                            : <ToggleLeft size={24} aria-hidden="true" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost" size="sm" className="h-7 px-2 gs-admin-focus-ring"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => setItemModal(item)}
                          >
                            <Pencil size={13} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost" size="sm" className="h-7 px-2 text-red-500 gs-admin-focus-ring"
                            aria-label={`Delete ${item.name}`}
                            onClick={() => window.confirm(`Delete ${item.name}?`) && deleteItem.mutate(item._id)}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {/* ── Combos tab ─────────────────────────────────────────────── */}
      {tab === 'combos' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-xs">
              <Label htmlFor="combo-search" className="sr-only">Search combos</Label>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
              <Input
                id="combo-search"
                placeholder="Search combos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          <section
            className="bg-card border border-border overflow-hidden"
            aria-label="Combos table"
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Spinner size="md" label="Loading combos…" />
              </div>
            ) : (
              <table className="w-full text-sm" aria-label="All combos">
                <thead className="bg-muted border-b border-border">
                  <tr className="text-left text-muted-foreground text-xs">
                    <th scope="col" className="px-4 py-3 font-medium">Name</th>
                    <th scope="col" className="px-4 py-3 font-medium">Included Items</th>
                    <th scope="col" className="px-4 py-3 font-medium">Combo Price</th>
                    <th scope="col" className="px-4 py-3 font-medium">Available</th>
                    <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {combos.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          message="No combos found"
                          sub="Create one to bundle items together!"
                        />
                      </td>
                    </tr>
                  ) : combos.map((combo) => (
                    <tr key={combo._id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {combo.image?.url
                            ? <img src={combo.image.url} alt="" className="w-8 h-8 object-cover" style={{ borderRadius: 'var(--gs-admin-radius-md)' }} />
                            : (
                              <div
                                className="w-8 h-8 bg-muted flex items-center justify-center text-xs"
                                style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                                aria-hidden="true"
                              >🍱</div>
                            )
                          }
                          <span className="font-medium text-foreground">{combo.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {combo.comboItems?.length || 0} items
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">Rs. {combo.basePrice}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleItemAvailability.mutate(combo._id)}
                          disabled={toggleItemAvailability.isPending}
                          aria-label={combo.isAvailable ? `Mark ${combo.name} as unavailable` : `Mark ${combo.name} as available`}
                          aria-pressed={combo.isAvailable}
                          className={`text-xl transition-colors gs-admin-focus-ring ${combo.isAvailable ? 'text-green-500' : 'text-border'}`}
                          style={{ borderRadius: 'var(--gs-admin-radius-sm)' }}
                        >
                          {combo.isAvailable
                            ? <ToggleRight size={24} aria-hidden="true" />
                            : <ToggleLeft size={24} aria-hidden="true" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost" size="sm" className="h-7 px-2 gs-admin-focus-ring"
                            aria-label={`Edit ${combo.name}`}
                            onClick={() => setComboModal(combo)}
                          >
                            <Pencil size={13} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost" size="sm" className="h-7 px-2 text-red-500 gs-admin-focus-ring"
                            aria-label={`Delete ${combo.name}`}
                            onClick={() => window.confirm(`Delete ${combo.name}?`) && deleteItem.mutate(combo._id)}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {/* Portals */}
      {categoryModal !== null && (
        <CategoryModal
          category={categoryModal._id ? categoryModal : null}
          onClose={() => setCategoryModal(null)}
          onSave={(data) =>
            categoryModal._id
              ? updateCat.mutateAsync({ id: categoryModal._id, data })
              : createCat.mutateAsync(data)
          }
        />
      )}
      {itemModal !== null && (
        <MenuItemModal
          item={itemModal._id ? itemModal : null}
          categories={categories}
          onClose={() => setItemModal(null)}
          onSave={(data) =>
            itemModal._id
              ? updateItem.mutateAsync({ id: itemModal._id, data })
              : createItem.mutateAsync(data)
          }
        />
      )}
      {comboModal !== null && (
        <ComboModal
          combo={comboModal._id ? comboModal : null}
          categories={categories}
          allMenuItems={allItems}
          onClose={() => setComboModal(null)}
          onSave={(data) =>
            comboModal._id
              ? updateItem.mutateAsync({ id: comboModal._id, data })
              : createItem.mutateAsync(data)
          }
        />
      )}
      {bulkModal && (
        <BulkPriceModal
          categories={categories}
          onClose={() => setBulkModal(false)}
          onSave={(data) => bulkPrice.mutateAsync(data)}
        />
      )}
    </main>
  )
}