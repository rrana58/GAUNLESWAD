import { useState, useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronRight, LogOut, Trash2, Award, ShoppingBag, Wallet, MapPin, Copy } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { getErrorMessage } from '@/lib/errorMessage'
import { formatNpr, cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import PasswordField from '@/components/auth/PasswordField'
import OtpInput from '@/components/auth/OtpInput'
import AddressCard from '@/components/addresses/AddressCard'
import AddressForm from '@/components/addresses/AddressForm'
import { addressApi } from '@/api/orders'



const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z
    .string()
    .min(8, 'Must be 8–16 characters')
    .max(16, 'Must be 8–16 characters')
    .regex(/[A-Za-z]/, 'Must contain a letter')
    .regex(/\d/, 'Must contain a number'),
})

export default function Profile() {
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuthStore()
  const [view, setView] = useState('overview')

  useEffect(() => {
    if (user) {
      authApi.getMe().then(({ data }) => updateUser(data.user)).catch(() => {})
    }
  }, [user?._id])

  return (
    <div className="min-h-dvh flex flex-col">
      <PageHeader
        title={
          view === 'overview'
            ? 'Your profile'
            : {
                edit: 'Edit profile',
                addresses: 'Saved addresses',
                password: 'Change password',
                history: 'Login history',
                delete: 'Delete account',
              }[view]
        }
        showBackButton={view !== 'overview'}
        rightElement={view !== 'overview' ? undefined : null}
        onBack={view !== 'overview' ? () => setView('overview') : undefined}
      />
      {view !== 'overview' && null}

      {view === 'overview' && (
        <OverviewView user={user} onNavigate={setView} onLogout={() => { logout(); navigate('/') }} />
      )}
      {view === 'edit' && <EditProfileView user={user} onSaved={(u) => { updateUser(u); setView('overview') }} onBack={() => setView('overview')} />}
      {view === 'password' && <ChangePasswordView onDone={() => setView('overview')} onBack={() => setView('overview')} />}
      {view === 'history' && <LoginHistoryView onBack={() => setView('overview')} />}
      {view === 'addresses' && <AddressesView onBack={() => setView('overview')} />}
      {view === 'delete' && <DeleteAccountView onBack={() => setView('overview')} onDeleted={() => { logout(); navigate('/') }} />}
    </div>
  )
}

// ─── Overview ───────────────────────────────────────────────────────────────────

function OverviewView({ user, onNavigate, onLogout }) {
  const navigate = useNavigate()
  const [loggingOutAll, setLoggingOutAll] = useState(false)

  const handleLogoutAll = async () => {
    setLoggingOutAll(true)
    try {
      await authApi.logoutAll()
      toast.success('Logged out of all devices')
      onLogout()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoggingOutAll(false)
    }
  }

  return (
    <main className="flex-1 px-4 py-4 flex flex-col gap-6" aria-label="Your profile">
      {/* User identity */}
      <header aria-label={`Signed in as ${user?.name}`}>
        <p className="font-display text-xl text-foreground">{user?.name}</p>
        <p className="text-sm text-muted-foreground">+977 {user?.phone}</p>
      </header>

      {/* Stats */}
      <dl
        className="grid grid-cols-3 gap-2"
        role="list"
        aria-label="Your account statistics"
      >
        <StatTile icon={Award} label="Points" value={user?.loyaltyPoints ?? 0} />
        <StatTile icon={ShoppingBag} label="Orders" value={user?.totalOrders ?? 0} />
        <StatTile icon={Wallet} label="Spent" value={formatNpr(user?.totalSpent ?? 0)} small />
      </dl>

      {/* Referral */}
      {user?.referralCode && (
        <section
          className="border border-primary/20 bg-primary/5 p-4 flex flex-col gap-2"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
          aria-label="Refer a friend and earn rewards"
          role="region"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display font-medium text-primary">Refer & Earn</h3>
            <span
              className="text-xs bg-primary/10 text-primary px-2 py-0.5 font-semibold"
              style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
            >
              Get Rs. 50 Coupon
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Share your code with friends. When they place their first order, you'll receive a Rs. 50 coupon!
          </p>
          <div
            className="mt-1 flex items-center justify-between bg-card border border-border px-3 py-2"
            style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
          >
            <span
              className="font-mono font-bold text-foreground tracking-widest"
              aria-label={`Your referral code: ${user.referralCode}`}
            >
              {user.referralCode}
            </span>
            <button
              onClick={() => {
                const shareData = {
                  title: 'Join Gharko Swad',
                  text: `Sign up for Gharko Swad using my referral code: ${user.referralCode} and we both get rewards!`,
                  url: window.location.origin,
                }
                if (navigator.share) {
                  navigator.share(shareData).catch(() => {})
                } else if (navigator.clipboard) {
                  navigator.clipboard.writeText(user.referralCode)
                  toast.success('Referral code copied!')
                } else {
                  const textArea = document.createElement('textarea')
                  textArea.value = user.referralCode
                  document.body.appendChild(textArea)
                  textArea.select()
                  try {
                    document.execCommand('copy')
                    toast.success('Referral code copied!')
                  } catch (err) {
                    toast.error('Failed to copy code. Please copy manually.')
                  }
                  document.body.removeChild(textArea)
                }
              }}
              className="text-primary hover:bg-primary/10 p-1.5 transition-colors gs-focus-ring"
              style={{ borderRadius: 'var(--gs-radius-md, 0.5rem)' }}
              aria-label="Share or copy your referral code"
            >
              <Copy size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Navigation menu */}
      <nav aria-label="Profile options">
        <ul
          role="list"
          className="flex flex-col overflow-hidden border border-border"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        >
          <MenuRow label="Order history" onClick={() => navigate('/orders')} />
          <MenuRow label="Edit profile" onClick={() => onNavigate('edit')} />
          <MenuRow label="Saved addresses" onClick={() => onNavigate('addresses')} />
          <MenuRow label="Change password" onClick={() => onNavigate('password')} />
          <MenuRow label="Login history" onClick={() => onNavigate('history')} />
        </ul>
      </nav>

      {/* Logout actions */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out of this device"
          className="flex items-center justify-center gap-2 border border-border py-3 text-sm font-medium text-foreground gs-focus-ring"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        >
          <LogOut size={16} aria-hidden="true" /> Log out
        </button>
        <button
          type="button"
          onClick={handleLogoutAll}
          disabled={loggingOutAll}
          aria-busy={loggingOutAll}
          aria-label={loggingOutAll ? 'Logging out of all devices...' : 'Log out of all devices'}
          className="text-xs text-muted-foreground underline self-center disabled:opacity-50 gs-focus-ring rounded-sm py-1 px-2"
        >
          {loggingOutAll ? 'Logging out everywhere...' : 'Log out of all devices'}
        </button>
      </div>

      {/* Delete account */}
      <button
        type="button"
        onClick={() => onNavigate('delete')}
        aria-label="Delete your account permanently"
        className="flex items-center justify-center gap-2 border border-destructive/30 text-destructive py-3 text-sm font-medium mt-2 gs-focus-ring"
        style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
      >
        <Trash2 size={16} aria-hidden="true" /> Delete account
      </button>
    </main>
  )
}

// ─── Stat Tile ──────────────────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, small }) {
  return (
    <div
      role="listitem"
      className="flex flex-col items-center gap-1 border border-border bg-card py-3"
      style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
      aria-label={`${label}: ${value}`}
    >
      <Icon size={16} className="text-primary" aria-hidden="true" />
      <span className={cn('font-mono font-semibold text-foreground', small ? 'text-xs' : 'text-sm')} aria-hidden="true">
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground" aria-hidden="true">{label}</span>
    </div>
  )
}

// ─── Menu Row ───────────────────────────────────────────────────────────────────

function MenuRow({ label, onClick }) {
  return (
    <li role="listitem">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="w-full flex items-center justify-between px-4 min-h-[44px] text-sm text-foreground bg-card border-b border-border last:border-b-0 gs-focus-ring"
      >
        {label}
        <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
      </button>
    </li>
  )
}

// ─── Edit Profile ───────────────────────────────────────────────────────────────

function EditProfileView({ user, onSaved, onBack }) {
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', email: user?.email || '' },
  })

  const onSubmit = async ({ name, email }) => {
    setSubmitting(true)
    try {
      const { data } = await authApi.updateProfile({ name, email: email || undefined })
      toast.success('Profile updated')
      onSaved(data.user)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full border border-border bg-card px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20'
  const inputStyle = { borderRadius: 'var(--gs-radius-lg, 0.75rem)' }

  return (
    <main className="flex-1 px-4 py-4" aria-label="Edit your profile">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" aria-label="Edit profile form">
        <div className="flex flex-col gap-1">
          <input
            {...register('name')}
            name="name"
            id="editName"
            placeholder="Full name"
            aria-label="Full name"
            aria-required="true"
            className={inputClass}
            style={inputStyle}
          />
          {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <input
            {...register('email')}
            name="email"
            id="editEmail"
            placeholder="Email (optional)"
            aria-label="Email address (optional)"
            className={inputClass}
            style={inputStyle}
          />
          {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          aria-label={submitting ? 'Saving changes...' : 'Save changes'}
          className="bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform gs-focus-ring"
          style={inputStyle}
        >
          {submitting ? 'Saving...' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground underline self-center gs-focus-ring rounded-sm py-1 px-2"
        >
          Cancel
        </button>
      </form>
    </main>
  )
}

// ─── Change Password ─────────────────────────────────────────────────────────────

function ChangePasswordView({ onDone, onBack }) {
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(passwordSchema) })

  const sendOtp = async () => {
    setSending(true)
    try {
      await authApi.sendChangePasswordOtp()
      setOtpSent(true)
      toast.success('OTP sent to your registered phone')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const onSubmit = async ({ currentPassword, newPassword }) => {
    if (otp.length !== 6) {
      setOtpError('Enter the 6-digit code')
      return
    }
    setOtpError('')
    setSubmitting(true)
    try {
      await authApi.changePassword({ currentPassword, otp, newPassword })
      toast.success('Password changed. Please log in again.')
      onDone()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not change password.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!otpSent) {
    return (
      <main className="flex-1 px-4 py-4 flex flex-col gap-4" aria-label="Change password — verify phone">
        <p className="text-sm text-muted-foreground">
          We'll send a verification code to your registered phone to confirm this change.
        </p>
        <button
          type="button"
          onClick={sendOtp}
          disabled={sending}
          aria-busy={sending}
          aria-label={sending ? 'Sending verification code...' : 'Send verification code'}
          className="bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform gs-focus-ring"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        >
          {sending ? 'Sending...' : 'Send verification code'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground underline self-center gs-focus-ring rounded-sm py-1 px-2"
        >
          Cancel
        </button>
      </main>
    )
  }

  return (
    <main className="flex-1 px-4 py-4" aria-label="Change password">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" aria-label="Change password form">
        <OtpInput value={otp} onChange={setOtp} error={otpError} />
        <PasswordField {...register('currentPassword')} placeholder="Current password" error={errors.currentPassword?.message} />
        <PasswordField {...register('newPassword')} placeholder="New password" error={errors.newPassword?.message} />
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          aria-label={submitting ? 'Updating password...' : 'Update password'}
          className="bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform gs-focus-ring"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        >
          {submitting ? 'Updating...' : 'Update password'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground underline self-center gs-focus-ring rounded-sm py-1 px-2"
        >
          Cancel
        </button>
      </form>
    </main>
  )
}

// ─── Login History ───────────────────────────────────────────────────────────────

function LoginHistoryView({ onBack }) {
  const { data, isLoading } = useQuery({
    queryKey: ['login-history'],
    queryFn: () => authApi.getLoginHistory().then((r) => r.data.loginHistory),
  })

  return (
    <main className="flex-1 px-4 py-4 flex flex-col gap-3" aria-label="Login history">
      {isLoading && (
        <div role="status" aria-busy="true" aria-label="Loading login history" className="flex flex-col gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="gs-skeleton h-16 w-full" style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }} />
          ))}
          <span className="sr-only">Loading login history...</span>
        </div>
      )}
      {data?.length > 0 && (
        <ol role="list" aria-label={`${data.length} login session${data.length !== 1 ? 's' : ''}`} className="flex flex-col gap-3">
          {data.map((entry, i) => (
            <li
              key={i}
              role="listitem"
              className="flex flex-col gap-0.5 border border-border bg-card p-3"
              style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
              aria-label={`Login on ${new Date(entry.at).toLocaleString()} from ${entry.ip || 'unknown IP'}`}
            >
              <p className="text-sm text-foreground">{new Date(entry.at).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground truncate">{entry.userAgent || 'Unknown device'}</p>
              <p className="text-xs text-muted-foreground font-mono">{entry.ip}</p>
            </li>
          ))}
        </ol>
      )}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-muted-foreground" role="status">No login history found.</p>
      )}
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-muted-foreground underline self-center mt-2 gs-focus-ring rounded-sm py-1 px-2"
      >
        Back
      </button>
    </main>
  )
}

// ─── Delete Account ──────────────────────────────────────────────────────────────

function DeleteAccountView({ onBack, onDeleted }) {
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const confirmCheckboxId = useId()

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      await authApi.deleteAccount(password)
      toast.success('Account deleted')
      onDeleted()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete account. Check your password.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex-1 px-4 py-4 flex flex-col gap-4" aria-label="Delete your account">
      <div
        className="bg-destructive/10 border border-destructive/30 px-4 py-3"
        style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        role="alert"
        aria-label="Warning: This action cannot be undone"
      >
        <p className="text-sm text-destructive font-medium">This can't be undone.</p>
        <p className="text-xs text-destructive/80 mt-1">
          Your account, saved addresses, and order history will be deactivated permanently.
        </p>
      </div>

      <PasswordField
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Confirm your password"
      />

      <label htmlFor={confirmCheckboxId} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
        <input
          id={confirmCheckboxId}
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="accent-destructive"
          aria-required="true"
        />
        I understand this is permanent
      </label>

      <button
        type="button"
        onClick={handleDelete}
        disabled={!password || !confirmed || submitting}
        aria-busy={submitting}
        aria-disabled={!password || !confirmed || submitting}
        aria-label={submitting ? 'Deleting your account...' : 'Delete my account permanently'}
        className="bg-destructive text-white py-3 text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform gs-focus-ring"
        style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
      >
        {submitting ? 'Deleting...' : 'Delete my account'}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-muted-foreground underline self-center gs-focus-ring rounded-sm py-1 px-2"
      >
        Cancel
      </button>
    </main>
  )
}

// ─── Addresses View ──────────────────────────────────────────────────────────────

function AddressesView({ onBack }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState('list')
  const [editingAddress, setEditingAddress] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressApi.list().then((r) => r.data.addresses),
  })

  const refresh = (updated) => queryClient.setQueryData(['addresses'], updated)

  const handleSave = async (form) => {
    setSubmitting(true)
    try {
      if (mode === 'edit' && editingAddress) {
        const { data } = await addressApi.update(editingAddress._id, form)
        refresh(data.addresses)
        toast.success('Address updated')
      } else {
        const { data } = await addressApi.create(form)
        refresh(data.addresses)
        toast.success('Address saved')
      }
      setMode('list')
      setEditingAddress(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (address) => {
    try {
      const { data } = await addressApi.remove(address._id)
      refresh(data.addresses)
      toast.success('Address deleted')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (mode === 'add' || mode === 'edit') {
    return (
      <main className="flex-1 px-4 py-4" aria-label={mode === 'edit' ? 'Edit address' : 'Add new address'}>
        <AddressForm
          initial={mode === 'edit' ? editingAddress : undefined}
          submitting={submitting}
          onSubmit={handleSave}
          onCancel={() => { setMode('list'); setEditingAddress(null) }}
        />
      </main>
    )
  }

  return (
    <main className="flex-1 px-4 py-4 flex flex-col gap-3" aria-label="Saved delivery addresses">
      {isLoading && (
        <div role="status" aria-busy="true" aria-label="Loading addresses" className="flex flex-col gap-3">
          {[1, 2].map((n) => (
            <div key={n} className="gs-skeleton h-20 w-full" style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }} />
          ))}
          <span className="sr-only">Loading addresses...</span>
        </div>
      )}

      {addresses?.map((addr) => (
        <AddressCard
          key={addr._id}
          address={addr}
          onEdit={(a) => { setEditingAddress(a); setMode('edit') }}
          onDelete={handleDelete}
        />
      ))}

      {addresses?.length >= 5 ? (
        <p className="text-xs text-muted-foreground text-center" role="status">
          Maximum 5 saved addresses. Delete one to add another.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setMode('add')}
          aria-label="Add a new delivery address"
          className="border border-dashed border-primary text-primary py-2.5 text-sm font-medium gs-focus-ring"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        >
          + Add new address
        </button>
      )}

      <button
        type="button"
        onClick={onBack}
        className="text-xs text-muted-foreground underline self-center mt-2 gs-focus-ring rounded-sm py-1 px-2"
      >
        Back
      </button>
    </main>
  )
}