import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getAdminReviews, 
  getReviewStats, 
  replyToReview, 
  unpublishReview, 
  publishReview,
  deleteReview 
} from '@/api/reviews'
import { toast } from 'sonner'
import { 
  Star, MessageSquare, EyeOff, 
  Eye, AlertTriangle, Search, Trash2 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'

/**
 * ReviewsPage — Design System: Phase 5.5
 *
 * Token & Component changes:
 *  - bg-white -> bg-card
 *  - bg-gray-50 / bg-gray-100 -> bg-muted
 *  - border-gray-100 / border-gray-200 -> border-border
 *  - text-gray-900 / text-gray-800 -> text-foreground
 *  - text-gray-600 / text-gray-500 -> text-muted-foreground
 *  - text-gray-400 -> text-muted-foreground/60
 *  - Loader2 -> <Spinner />
 *  - Status indicators -> <StatusBadge />
 *  - Empty list view -> <EmptyState />
 *  - Inline ReplyModal shell -> <Modal size="sm">
 *  - Custom inline pagination -> <Pagination />
 *  - Filter button groups -> Filter styling with gs-admin-focus-ring
 *  - orange accent colors -> var(--gs-admin-accent)
 *  - rounded-xl / rounded-2xl -> radius tokens via style
 *
 * Accessibility:
 *  - <main aria-label="Customer reviews management">
 *  - Header landmark
 *  - Star rating displays get aria-label="Rated X out of 5 stars" & decorative stars aria-hidden="true"
 *  - Search & select filter controls have proper labels
 *  - Action buttons get clear aria-label and aria-busy attributes
 *  - Section landmarks for stats, alerts, filters, and reviews
 */

function StarRating({ rating, size = 14, labelPrefix = '' }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${labelPrefix ? labelPrefix + ': ' : ''}Rated ${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          aria-hidden="true"
          className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-border fill-border'}
        />
      ))}
    </div>
  )
}

function ReplyModal({ review, onClose, onSave }) {
  const [reply, setReply] = useState(review.adminReply || '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return toast.error('Reply cannot be empty')
    setLoading(true)
    try {
      await onSave(reply)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save reply')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reply to Review"
      size="sm"
    >
      <div className="p-5">
        {/* Context box */}
        <div
          className="p-4 mb-4 border border-border bg-muted"
          style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--gs-admin-accent)' }}
              >
                Food
              </span>
              <StarRating rating={review.foodRating} labelPrefix="Food" />
            </div>
            {review.deliveryRating && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Delivery</span>
                <StarRating rating={review.deliveryRating} labelPrefix="Delivery" />
              </div>
            )}
          </div>
          <p className="text-sm text-foreground italic leading-relaxed">
            "{review.comment || 'No comment provided'}"
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          aria-label="Submit response to customer review"
        >
          <div>
            <Label htmlFor="review-response" className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Your Response
            </Label>
            <textarea
              id="review-response"
              autoFocus
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Ex: Thank you for your feedback! We will look into the spiciness level..."
              className="w-full h-32 border border-border bg-card text-foreground px-3 py-2 text-sm resize-none focus:outline-none gs-admin-focus-ring transition-all"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gs-admin-focus-ring"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gs-admin-focus-ring"
              style={{
                backgroundColor: 'var(--gs-admin-accent)',
                color: 'var(--gs-admin-accent-foreground)',
                borderRadius: 'var(--gs-admin-radius-xl)',
              }}
              disabled={loading}
              aria-busy={loading}
            >
              {loading && <Spinner size="sm" label="Posting reply..." className="mr-2" />}
              Post Reply
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

export default function ReviewsPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [publishedFilter, setPublishedFilter] = useState('')
  const [page, setPage] = useState(1)
  const [replyModal, setReplyModal] = useState(null)

  const { data: statsData } = useQuery({
    queryKey: ['reviewStats'],
    queryFn: () => getReviewStats().then((r) => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', ratingFilter, publishedFilter, page, searchTerm],
    queryFn: () =>
      getAdminReviews({
        page,
        limit: 20,
        search: searchTerm,
        ...(ratingFilter && { rating: ratingFilter }),
        ...(publishedFilter !== '' && { published: publishedFilter }),
      }).then((r) => r.data),
  })

  const reply = useMutation({
    mutationFn: ({ id, text }) => replyToReview(id, text),
    onSuccess: () => { queryClient.invalidateQueries(['reviews']); toast.success('Reply posted') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to post reply'),
  })

  const unpublish = useMutation({
    mutationFn: (id) => unpublishReview(id),
    onSuccess: () => { queryClient.invalidateQueries(['reviews']); toast.success('Review hidden from customers') },
  })

  const publish = useMutation({
    mutationFn: (id) => publishReview(id),
    onSuccess: () => { queryClient.invalidateQueries(['reviews']); toast.success('Review made public') },
  })

  const remove = useMutation({
    mutationFn: (id) => deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['reviews'])
      toast.success('Review deleted permanently')
    },
  })

  const reviews = data?.reviews || []
  const totalPages = data?.totalPages || 1

  return (
    <main className="space-y-6 pb-12" aria-label="Customer reviews management">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Reviews</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage feedback and build kitchen reputation</p>
        </div>
      </header>

      {/* Stats Cards */}
      {statsData && (
        <section aria-label="Review statistics" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className="bg-card border border-border p-5 shadow-sm"
            style={{ borderRadius: 'var(--gs-admin-radius-2xl)' }}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Avg Food Quality</p>
            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold text-foreground">{statsData.avgFood || 0}</p>
              <StarRating rating={Math.round(statsData.avgFood)} size={18} labelPrefix="Average Food" />
            </div>
          </div>
          <div
            className="bg-card border border-border p-5 shadow-sm"
            style={{ borderRadius: 'var(--gs-admin-radius-2xl)' }}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Avg Delivery</p>
            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold text-foreground">{statsData.avgDelivery || 0}</p>
              <StarRating rating={Math.round(statsData.avgDelivery)} size={18} labelPrefix="Average Delivery" />
            </div>
          </div>
          <div
            className="bg-card border border-border p-5 shadow-sm"
            style={{ borderRadius: 'var(--gs-admin-radius-2xl)' }}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Total Feedback</p>
            <p className="text-3xl font-bold text-foreground">{statsData.total || 0}</p>
          </div>
          <div
            className="bg-card border border-border p-5 shadow-sm"
            style={{ borderRadius: 'var(--gs-admin-radius-2xl)' }}
          >
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((r) => {
                const found = statsData.ratingBreakdown?.find((rb) => rb._id === r)
                const count = found?.count || 0
                const total = statsData.total || 1
                return (
                  <div key={r} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground w-2">{r}</span>
                    <div
                      className="flex-1 h-1.5 bg-muted overflow-hidden"
                      style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                    >
                      <div
                        className="h-full bg-yellow-400"
                        style={{
                          width: `${(count / total) * 100}%`,
                          borderRadius: 'var(--gs-admin-radius-full)',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-4">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Negative Reviews Alert */}
      {statsData?.recentNegative?.length > 0 && (
        <section
          aria-label="Critical feedback alerts"
          className="bg-red-50 border border-red-100 p-5"
          style={{ borderRadius: 'var(--gs-admin-radius-2xl)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="bg-red-100 p-1.5"
              style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
            >
              <AlertTriangle size={18} className="text-red-600" aria-hidden="true" />
            </div>
            <p className="font-bold text-red-800">Critical Feedback ({statsData.recentNegative.length})</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {statsData.recentNegative.map((r) => (
              <div
                key={r._id}
                className="bg-card p-4 flex items-center justify-between shadow-sm border border-red-100"
                style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StarRating rating={r.foodRating} size={10} />
                    <span className="text-xs font-medium text-foreground">{r.customer?.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate italic">"{r.comment || 'No comment'}"</p>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs gs-admin-focus-ring"
                  style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
                  onClick={() => setReplyModal(r)}
                  aria-label={`Reply to critical review from ${r.customer?.name || 'Customer'}`}
                >
                  Reply
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters & Search */}
      <section
        aria-label="Review filters"
        className="bg-card border border-border p-4 flex flex-col lg:flex-row gap-4 shadow-sm"
        style={{ borderRadius: 'var(--gs-admin-radius-2xl)' }}
      >
        <div className="relative flex-1">
          <Label htmlFor="review-search" className="sr-only">Search reviews</Label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={16} aria-hidden="true" />
          <Input
            id="review-search"
            placeholder="Search by customer or comment..."
            className="pl-10 h-9"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0" role="group" aria-label="Filter by rating">
          <button
            onClick={() => { setRatingFilter(''); setPage(1) }}
            aria-pressed={!ratingFilter}
            className={`px-4 py-2 text-xs font-semibold border transition-all gs-admin-focus-ring ${
              !ratingFilter
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          >
            All Ratings
          </button>
          {[5, 4, 3, 2, 1].map((r) => (
            <button
              key={r}
              onClick={() => { setRatingFilter(r); setPage(1) }}
              aria-pressed={ratingFilter === r}
              className={`px-4 py-2 text-xs font-semibold border flex items-center gap-1.5 transition-all gs-admin-focus-ring ${
                ratingFilter === r
                  ? 'bg-yellow-400 text-white border-yellow-400'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              {r}{' '}
              <Star
                size={12}
                aria-hidden="true"
                className={ratingFilter === r ? 'fill-white text-white' : 'fill-yellow-400 text-yellow-400'}
              />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 lg:border-l border-border lg:pl-4" role="group" aria-label="Filter by status">
          {[
            ['', 'All Status'],
            ['true', 'Live'],
            ['false', 'Hidden'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => { setPublishedFilter(val); setPage(1) }}
              aria-pressed={publishedFilter === val}
              className={`px-4 py-2 text-xs font-semibold border whitespace-nowrap transition-all gs-admin-focus-ring ${
                publishedFilter === val
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner size="lg" label="Loading feedback..." />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          message="No reviews match your filters"
          sub="Try clearing or adjusting your search criteria."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchTerm('')
            setRatingFilter('')
            setPublishedFilter('')
          }}
        />
      ) : (
        <section aria-label="Customer review cards" className="space-y-4">
          {reviews.map((review) => (
            <article
              key={review._id}
              className={`group bg-card border p-6 transition-all hover:shadow-md ${
                !review.isPublished ? 'border-dashed border-border bg-muted/40' : 'border-border'
              }`}
              style={{ borderRadius: 'var(--gs-admin-radius-2xl)' }}
            >
              <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  {/* Header Info */}
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 flex items-center justify-center font-bold text-sm"
                      style={{
                        backgroundColor: 'var(--gs-admin-accent-muted)',
                        color: 'var(--gs-admin-accent)',
                        borderRadius: 'var(--gs-admin-radius-full)',
                      }}
                      aria-hidden="true"
                    >
                      {review.customer?.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm leading-none mb-1">
                        {review.customer?.name || 'Customer'}
                      </p>
                      <p className="text-xs text-muted-foreground/60 font-medium">{review.customer?.phone}</p>
                    </div>
                    <div className="h-4 w-px bg-border mx-1 hidden md:block" />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">Food</span>
                        <StarRating rating={review.foodRating} labelPrefix="Food" />
                      </div>
                      {review.deliveryRating && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">Logistics</span>
                          <StarRating rating={review.deliveryRating} size={11} labelPrefix="Logistics" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Context */}
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className="bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase"
                      style={{ borderRadius: 'var(--gs-admin-radius-sm)' }}
                    >
                      Order #{review.order?.orderNumber}
                    </div>
                    <span className="text-xs text-muted-foreground/60" aria-hidden="true">·</span>
                    <span className="text-xs font-semibold text-muted-foreground">{review.menuItem?.name}</span>
                    <span className="text-xs text-muted-foreground/60" aria-hidden="true">·</span>
                    <span className="text-xs text-muted-foreground/60">
                      {format(new Date(review.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>

                  {/* Comment */}
                  <p
                    className="text-sm text-foreground leading-relaxed bg-muted p-3 border border-border mb-4"
                    style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                  >
                    {review.comment || <span className="text-muted-foreground/60 italic">No written comment provided.</span>}
                  </p>

                  {/* Admin reply section */}
                  {review.adminReply && (
                    <div
                      className="border border-border p-4 ml-4 md:ml-8 relative bg-muted"
                      style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase mb-1 tracking-widest"
                        style={{ color: 'var(--gs-admin-accent)' }}
                      >
                        🍳 Kitchen's Response
                      </p>
                      <p className="text-sm text-foreground">{review.adminReply}</p>
                    </div>
                  )}
                </div>

                {/* Actions Sidebar */}
                <div className="flex flex-col gap-2 w-full md:w-36 shrink-0">
                  <StatusBadge
                    status={review.isPublished ? 'published' : 'hidden'}
                    size="sm"
                  />

                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs font-bold gs-admin-focus-ring"
                    style={{
                      borderColor: 'var(--gs-admin-accent-muted)',
                      color: 'var(--gs-admin-accent)',
                      borderRadius: 'var(--gs-admin-radius-xl)',
                    }}
                    onClick={() => setReplyModal(review)}
                    aria-label={`${review.adminReply ? 'Edit reply for' : 'Reply to'} review from ${review.customer?.name || 'Customer'}`}
                  >
                    <MessageSquare size={14} className="mr-2" aria-hidden="true" />
                    {review.adminReply ? 'Edit Reply' : 'Reply'}
                  </Button>

                  <div className="flex gap-2 w-full">
                    <Button
                      variant="ghost"
                      className={`flex-1 h-9 text-xs font-bold transition-all gs-admin-focus-ring ${
                        review.isPublished
                          ? 'text-muted-foreground hover:bg-red-50 hover:text-red-500'
                          : 'text-green-600 bg-green-50 hover:bg-green-100'
                      }`}
                      style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                      onClick={() => (review.isPublished ? unpublish.mutate(review._id) : publish.mutate(review._id))}
                      aria-label={review.isPublished ? `Hide review from ${review.customer?.name}` : `Publish review from ${review.customer?.name}`}
                      aria-busy={unpublish.isPending || publish.isPending}
                    >
                      {review.isPublished ? (
                        <>
                          <EyeOff size={14} className="mr-1.5" aria-hidden="true" /> Hide
                        </>
                      ) : (
                        <>
                          <Eye size={14} className="mr-1.5" aria-hidden="true" /> Show
                        </>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      className="h-9 w-9 p-0 text-muted-foreground/60 hover:text-red-600 hover:bg-red-50 gs-admin-focus-ring"
                      style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                      onClick={() => {
                        if (window.confirm('Delete this review permanently? This cannot be undone.')) {
                          remove.mutate(review._id)
                        }
                      }}
                      aria-label={`Delete review from ${review.customer?.name}`}
                      aria-busy={remove.isPending}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}

          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={(p) => {
              setPage(p)
              window.scrollTo(0, 0)
            }}
            label="reviews"
          />
        </section>
      )}

      {replyModal && (
        <ReplyModal
          review={replyModal}
          onClose={() => setReplyModal(null)}
          onSave={(text) => reply.mutateAsync({ id: replyModal._id, text })}
        />
      )}
    </main>
  )
}