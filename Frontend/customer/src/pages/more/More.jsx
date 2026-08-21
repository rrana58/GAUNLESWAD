import { useState, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChevronRight, ChevronDown, Megaphone, Ticket, Briefcase, Phone, Info,
  Copy, MapPin, Mail, MessageCircle, Globe, CheckCircle2, FileText, ShieldCheck,
} from 'lucide-react'
import { announcementApi, jobApi, promoApi, settingsApi } from '@/api/orders'
import { useAuthStore } from '@/store/authStore'
import { getErrorMessage } from '@/lib/errorMessage'
import { formatNpr, cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'


export default function More() {
  const [view, setView] = useState('hub')

  const titles = {
    hub: 'More',
    announcements: 'Announcements',
    promos: 'Promo Codes',
    jobs: 'Careers',
    contact: 'Contact Us',
    about: 'About Us',
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PageHeader
        title={titles[view]}
        showBackButton={view !== 'hub'}
        onBack={() => setView('hub')}
      />
      {view === 'hub' && <HubView onNavigate={setView} />}
      {view === 'announcements' && <AnnouncementsView />}
      {view === 'promos' && <PromoCodesView />}
      {view === 'jobs' && <JobsView />}
      {view === 'contact' && <ContactUsView />}
      {view === 'about' && <AboutUsView />}
    </div>
  )
}

// ─── Hub ────────────────────────────────────────────────────────────────────────

function HubView({ onNavigate }) {
  const items = [
    { key: 'announcements', label: 'Announcements', icon: Megaphone },
    { key: 'promos', label: 'Promo Codes', icon: Ticket },
    { key: 'jobs', label: 'Careers', icon: Briefcase },
    { key: 'contact', label: 'Contact Us', icon: Phone },
    { key: 'about', label: 'About Us', icon: Info },
    { route: '/terms', label: 'Terms & Conditions', icon: FileText },
    { route: '/privacy', label: 'Privacy Policy', icon: ShieldCheck },
  ]

  const rowClass = 'flex items-center gap-3 px-4 min-h-[44px] text-sm text-foreground bg-card border-b border-border last:border-b-0 gs-focus-ring'

  return (
    <main className="flex-1 px-4 py-4 flex flex-col gap-6" aria-label="More options">
      <nav aria-label="More pages">
        <ul
          role="list"
          className="flex flex-col overflow-hidden border border-border"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        >
          {items.map(({ key, route, label, icon: Icon }) => {
            if (route) {
              return (
                <li key={route} role="listitem">
                  <a
                    href={route}
                    className={rowClass}
                    aria-label={label}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10 text-primary"
                      style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
                    >
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-left font-medium">{label}</span>
                    <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
                  </a>
                </li>
              )
            }
            return (
              <li key={key} role="listitem">
                <button
                  onClick={() => onNavigate(key)}
                  className={`w-full ${rowClass}`}
                  aria-label={label}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10 text-primary"
                    style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
                  >
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-left font-medium">{label}</span>
                  <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <p className="text-center text-xs text-muted-foreground">Gharko Swad</p>
    </main>
  )
}

// ─── Announcements ──────────────────────────────────────────────────────────────

function AnnouncementsView() {
  const [expandedId, setExpandedId] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: () => announcementApi.getActive().then((r) => r.data.announcements),
  })

  const announcements = data || []

  if (isLoading) return <CenteredSpinner label="Loading announcements" />

  if (announcements.length === 0) {
    return <EmptyState icon={Megaphone} text="No announcements right now" />
  }

  return (
    <main className="flex-1 px-4 py-4 flex flex-col gap-2.5" aria-label="Announcements">
      <ol role="list" aria-label={`${announcements.length} announcement${announcements.length !== 1 ? 's' : ''}`} className="flex flex-col gap-2.5">
        {announcements.map((a) => {
          const expanded = expandedId === a._id
          return (
            <li key={a._id} role="listitem">
              <button
                onClick={() => setExpandedId(expanded ? null : a._id)}
                aria-expanded={expanded}
                aria-label={`${a.title} — ${expanded ? 'collapse' : 'expand'}`}
                className="w-full text-left border border-border bg-card p-4 gs-focus-ring"
                style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10 text-primary"
                    style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
                    aria-hidden="true"
                  >
                    <Megaphone size={14} aria-hidden="true" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-sm font-semibold text-foreground">{a.title}</p>
                      <ChevronDown
                        size={15}
                        className={cn('text-muted-foreground shrink-0 transition-transform', expanded && 'rotate-180')}
                        aria-hidden="true"
                      />
                    </div>
                    <p className={cn('text-sm text-muted-foreground mt-1', !expanded && 'line-clamp-2')}>
                      {a.body}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                      {new Date(a.createdAt).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </main>
  )
}

// ─── Promo Codes ────────────────────────────────────────────────────────────────

function discountLabel(coupon) {
  const isFlat = coupon.discountType === 'flat'
  if (isFlat) return `${formatNpr(coupon.discountValue)} OFF`
  const capped = coupon.maxDiscount ? ` (up to ${formatNpr(coupon.maxDiscount)})` : ''
  return `${coupon.discountValue}% OFF${capped}`
}

function PromoCodesView() {
  const { data, isLoading } = useQuery({
    queryKey: ['coupons', 'public'],
    queryFn: () => promoApi.getPublic().then((r) => r.data.coupons),
  })

  const coupons = data || []

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success(`${code} copied!`)
    } catch {
      toast.error('Could not copy. Long-press the code to copy it.')
    }
  }

  if (isLoading) return <CenteredSpinner label="Loading promo codes" />

  if (coupons.length === 0) {
    return <EmptyState icon={Ticket} text="No active promo codes right now" />
  }

  return (
    <main className="flex-1 px-4 py-4 flex flex-col gap-3" aria-label="Promo codes">
      <ol role="list" aria-label={`${coupons.length} promo code${coupons.length !== 1 ? 's' : ''}`} className="flex flex-col gap-3">
        {coupons.map((c) => (
          <li key={c._id} role="listitem">
            <article
              className="border border-dashed border-primary/40 bg-primary/5 p-4 flex items-center gap-3"
              style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
              aria-label={`Coupon: ${discountLabel(c)}. Code: ${c.code}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-display text-base font-bold text-primary">{discountLabel(c)}</p>
                {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className="font-mono font-bold tracking-widest text-sm text-foreground bg-card border border-border px-2.5 py-1"
                    style={{ borderRadius: 'var(--gs-radius-md, 0.5rem)' }}
                  >
                    {c.code}
                  </span>
                  <button
                    onClick={() => copyCode(c.code)}
                    className="text-primary hover:bg-primary/10 p-1.5 transition-colors gs-focus-ring"
                    style={{ borderRadius: 'var(--gs-radius-md, 0.5rem)' }}
                    aria-label={`Copy code ${c.code}`}
                  >
                    <Copy size={14} aria-hidden="true" />
                  </button>
                </div>
                {(c.minOrderAmount > 0 || c.validUntil) && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {c.minOrderAmount > 0 && `Min. order ${formatNpr(c.minOrderAmount)}`}
                    {c.minOrderAmount > 0 && c.validUntil && ' · '}
                    {c.validUntil && `Valid till ${new Date(c.validUntil).toLocaleDateString('en-NP', { day: 'numeric', month: 'short' })}`}
                  </p>
                )}
              </div>
            </article>
          </li>
        ))}
      </ol>
    </main>
  )
}

// ─── Jobs ───────────────────────────────────────────────────────────────────────

const applySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  phone: z.string().regex(/^9\d{9}$/, 'Enter a valid 10-digit phone number'),
  message: z.string().max(1000).optional().or(z.literal('')),
})

function JobsView() {
  const [applyingTo, setApplyingTo] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['jobs', 'active'],
    queryFn: () => jobApi.getActive().then((r) => r.data.jobs),
  })

  const jobs = data || []

  if (applyingTo) {
    return <JobApplyForm job={applyingTo} onDone={() => setApplyingTo(null)} />
  }

  if (isLoading) return <CenteredSpinner label="Loading job openings" />

  if (jobs.length === 0) {
    return <EmptyState icon={Briefcase} text="No openings right now — check back soon" />
  }

  return (
    <main className="flex-1 px-4 py-4 flex flex-col gap-3" aria-label="Career openings">
      <ol role="list" aria-label={`${jobs.length} job opening${jobs.length !== 1 ? 's' : ''}`} className="flex flex-col gap-3">
        {jobs.map((j) => (
          <li key={j._id} role="listitem">
            <article
              className="border border-border bg-card p-4"
              style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
              aria-label={`${j.title}${j.location ? `, ${j.location}` : ''}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-display text-sm font-semibold text-foreground">{j.title}</p>
                <span
                  className="text-[10px] font-semibold bg-secondary/15 text-secondary-foreground px-2 py-0.5 capitalize"
                  style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
                >
                  {j.employmentType?.replace('-', ' ')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{j.description}</p>
              {j.location && (
                <p className="text-[11px] text-muted-foreground/70 mt-1.5 flex items-center gap-1">
                  <MapPin size={10} aria-hidden="true" /> {j.location}
                </p>
              )}
              <button
                type="button"
                onClick={() => setApplyingTo(j)}
                aria-label={`Apply for ${j.title}`}
                className="mt-3 w-full bg-primary text-primary-foreground py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform gs-focus-ring"
                style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
              >
                Apply Now
              </button>
            </article>
          </li>
        ))}
      </ol>
    </main>
  )
}

function JobApplyForm({ job, onDone }) {
  const { user } = useAuthStore()
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const nameId = useId()
  const phoneId = useId()
  const messageId = useId()
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(applySchema),
    defaultValues: { name: user?.name || '', phone: user?.phone || '', message: '' },
  })

  const onSubmit = async ({ name, phone, message }) => {
    setSubmitting(true)
    try {
      await jobApi.apply(job._id, { name, phone, message: message || undefined })
      setSubmitted(true)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main
        className="flex-1 px-4 py-10 flex flex-col items-center justify-center gap-3 text-center"
        role="status"
        aria-label="Application submitted successfully"
      >
        <CheckCircle2 size={40} className="text-primary" aria-hidden="true" />
        <p className="font-display text-lg font-semibold text-foreground">Application sent!</p>
        <p className="text-sm text-muted-foreground max-w-[260px]">
          We've received your application for {job.title}. We'll reach out on your phone if it's a fit.
        </p>
        <button
          onClick={onDone}
          className="mt-2 text-sm font-semibold text-primary underline gs-focus-ring rounded-sm py-1 px-2"
        >
          Back to openings
        </button>
      </main>
    )
  }

  const inputClass = 'w-full border border-border bg-card px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20'
  const inputStyle = { borderRadius: 'var(--gs-radius-lg, 0.75rem)' }

  return (
    <main className="flex-1 px-4 py-4" aria-label={`Apply for ${job.title}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" aria-label={`Application form for ${job.title}`}>
        <div>
          <p className="font-display text-sm font-semibold text-foreground">Applying for</p>
          <p className="text-sm text-primary font-medium">{job.title}</p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={nameId} className="sr-only">Full name</label>
          <input
            {...register('name')}
            id={nameId}
            placeholder="Full name"
            aria-label="Full name"
            aria-required="true"
            className={inputClass}
            style={inputStyle}
          />
          {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <div
            className="flex items-center border border-border bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors"
            style={inputStyle}
          >
            <span className="pl-3 pr-1 text-sm text-muted-foreground">+977</span>
            <input
              {...register('phone')}
              id={phoneId}
              placeholder="98XXXXXXXX"
              inputMode="numeric"
              maxLength={10}
              aria-label="Phone number (10 digits)"
              aria-required="true"
              className="flex-1 py-2.5 pr-3 text-sm bg-transparent outline-none"
            />
          </div>
          {errors.phone && <span className="text-xs text-destructive">{errors.phone.message}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={messageId} className="sr-only">Additional message (optional)</label>
          <textarea
            {...register('message')}
            id={messageId}
            placeholder="Anything you'd like us to know (optional)"
            rows={4}
            maxLength={1000}
            aria-label="Additional message (optional)"
            className={`${inputClass} resize-none`}
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          aria-label={submitting ? 'Submitting application...' : 'Submit application'}
          className="bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform gs-focus-ring"
          style={inputStyle}
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-muted-foreground underline self-center gs-focus-ring rounded-sm py-1 px-2"
        >
          Cancel
        </button>
      </form>
    </main>
  )
}

// ─── Contact Us ─────────────────────────────────────────────────────────────────

function ContactUsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => settingsApi.getPublic().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const contact = data?.contactInfo || {}
  const hasAny = contact.phone || contact.whatsapp || contact.email || contact.address || contact.facebook || contact.instagram

  if (isLoading) return <CenteredSpinner label="Loading contact details" />
  if (!hasAny) return <EmptyState icon={Phone} text="Contact details coming soon" />

  const rows = [
    contact.phone && {
      icon: Phone, label: 'Call us', value: `+977 ${contact.phone}`, href: `tel:+977${contact.phone}`,
    },
    contact.whatsapp && {
      icon: MessageCircle, label: 'WhatsApp', value: `+977 ${contact.whatsapp}`,
      href: `https://wa.me/977${contact.whatsapp}`,
    },
    contact.email && {
      icon: Mail, label: 'Email', value: contact.email, href: `mailto:${contact.email}`,
    },
    contact.address && {
      icon: MapPin, label: 'Address', value: contact.address, href: contact.mapLink || undefined,
    },
    contact.facebook && { icon: Globe, label: 'Facebook', value: 'Visit our page', href: contact.facebook },
    contact.instagram && { icon: Globe, label: 'Instagram', value: 'Visit our page', href: contact.instagram },
  ].filter(Boolean)

  const rowClass = 'flex items-center gap-3 px-4 min-h-[44px] bg-card border-b border-border last:border-b-0 gs-focus-ring'

  return (
    <main className="flex-1 px-4 py-4" aria-label="Contact information">
      <address>
        <ul
          role="list"
          className="flex flex-col overflow-hidden border border-border"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        >
          {rows.map(({ icon: Icon, label, value, href }, i) => {
            const content = (
              <>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10 text-primary"
                  style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
                  aria-hidden="true"
                >
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs text-muted-foreground">{label}</span>
                  <span className="block text-sm font-medium text-foreground truncate">{value}</span>
                </span>
                {href && <ChevronRight size={16} className="text-muted-foreground shrink-0" aria-hidden="true" />}
              </>
            )
            return href ? (
              <li key={i} role="listitem">
                <a
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  aria-label={`${label}: ${value}`}
                  className={rowClass}
                >
                  {content}
                </a>
              </li>
            ) : (
              <li key={i} role="listitem">
                <div className={rowClass}>{content}</div>
              </li>
            )
          })}
        </ul>
      </address>
    </main>
  )
}

// ─── About Us ───────────────────────────────────────────────────────────────────

function AboutUsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => settingsApi.getPublic().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return <CenteredSpinner label="Loading about us" />

  return (
    <main className="flex-1 px-4 py-6" aria-label="About Gharko Swad">
      <p className="font-display text-lg font-semibold text-foreground mb-3">Gharko Swad</p>
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {data?.aboutUs}
      </p>
    </main>
  )
}

// ─── Shared bits ────────────────────────────────────────────────────────────────

function CenteredSpinner({ label = 'Loading' }) {
  return (
    <div
      className="flex-1 flex items-center justify-center py-16"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div
        className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin"
        style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}...</span>
    </div>
  )
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6"
      role="status"
      aria-label={text}
    >
      <Icon size={28} className="text-muted-foreground/40" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
