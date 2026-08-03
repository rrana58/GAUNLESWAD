import { useState, useEffect } from 'react'
import { createUser, updateUser } from '@/api/admin'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

/**
 * UserModal — Design System: Phase 5.5
 *
 * Token changes:
 *  - Custom fixed inset-0 backdrop shell -> <Modal size="sm">
 *  - bg-white -> bg-card (handled by Modal)
 *  - text-gray-900 -> text-foreground (handled by Modal)
 *  - border-gray-200 / bg-transparent -> border-border / bg-card
 *  - rounded-md / rounded-2xl -> radius tokens via style
 *  - Loader2 -> <Spinner size="sm">
 *  - Submit button -> style accent token
 *
 * Accessibility:
 *  - Accessible dialog shell via <Modal> (role="dialog", aria-modal, aria-labelledby, Escape, focus trap)
 *  - <form aria-label>
 *  - <Label htmlFor> linked to every Input and Select
 *  - Required fields use aria-required="true"
 *  - Submit button gets aria-busy={submitting}
 *
 * No business logic, mutation, or API changes.
 */

const selectCls = `w-full h-10 px-3 py-2 bg-card border border-border text-foreground text-sm outline-none gs-admin-focus-ring transition-colors`
const selectStyle = { borderRadius: 'var(--gs-admin-radius-md)' }

export default function UserModal({ user, onClose }) {
  const isEditing = !!user
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    role: 'customer',
  })

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || '',
        password: '', // leave empty unless they want to reset
        role: user.role || 'customer',
      })
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = { ...formData }
      if (!payload.password) delete payload.password
      if (!payload.email) delete payload.email

      if (isEditing) {
        await updateUser(user._id, payload)
        toast.success('User updated successfully')
      } else {
        await createUser(payload)
        toast.success('User created successfully')
      }
      queryClient.invalidateQueries(['users'])
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? 'Edit User' : 'Create User'}
      size="sm"
    >
      <form
        onSubmit={handleSubmit}
        className="p-4 space-y-4"
        aria-label={isEditing ? 'Edit user form' : 'Create user form'}
      >
        <div className="space-y-1.5">
          <Label htmlFor="user-name">Full Name *</Label>
          <Input
            id="user-name"
            required
            aria-required="true"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="Full name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-phone">Phone Number *</Label>
          <Input
            id="user-phone"
            required
            aria-required="true"
            value={formData.phone}
            onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
            placeholder="e.g. 9800000000"
            pattern="^9[678]\d{8}$"
            title="Must be a valid 10-digit Nepali phone number"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-email">Email (Optional)</Label>
          <Input
            id="user-email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            placeholder="Email address"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-password">
            {isEditing ? 'New Password (leave blank to keep current)' : 'Password *'}
          </Label>
          <Input
            id="user-password"
            type="text"
            required={!isEditing}
            aria-required={!isEditing}
            value={formData.password}
            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            placeholder={isEditing ? 'Enter new password' : 'Enter a secure password'}
            minLength={6}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-role">Role *</Label>
          <select
            id="user-role"
            required
            aria-required="true"
            value={formData.role}
            onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
            className={selectCls}
            style={selectStyle}
          >
            <option value="customer">Customer</option>
            <option value="kitchen">Kitchen Staff</option>
            <option value="delivery">Rider / Delivery</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="pt-4 flex gap-3">
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
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting && <Spinner size="sm" label="Saving user..." className="mr-2" />}
            {isEditing ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
