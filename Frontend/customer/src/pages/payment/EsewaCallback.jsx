import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { paymentApi } from '@/api/orders'
import { getErrorMessage } from '@/lib/errorMessage'

export default function EsewaCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('verifying')
  const [message, setMessage] = useState('Verifying your eSewa payment...')

  useEffect(() => {
    const encodedData = searchParams.get('data')
    const isFailureRoute =
      window.location.pathname === '/payment/esewa/failure'

    if (isFailureRoute) {
      setStatus('failed')
      setMessage(
        'Your eSewa payment was cancelled or failed. No payment was confirmed.'
      )
      return
    }

    if (!encodedData) {
      setStatus('failed')
      setMessage('eSewa payment information was not found.')
      return
    }

    let cancelled = false
    let redirectTimer

    const verify = async () => {
      try {
        const { data } = await paymentApi.verifyEsewa(encodedData)

        if (cancelled) return

        const order = data?.order

        if (!order?._id) {
          throw new Error(
            'Payment was verified, but the order could not be found.'
          )
        }

        setStatus('success')
        setMessage('Payment confirmed! Redirecting to your order...')

        redirectTimer = setTimeout(() => {
          const ref = order.trackingToken || order._id

          navigate(`/track/${ref}`, {
            replace: true,
            state: {
              justPlaced: true,
              isGuest: !order.customer,
              trackingToken: order.trackingToken,
            },
          })
        }, 1000)
      } catch (err) {
        if (cancelled) return

        setStatus('failed')
        setMessage(
          getErrorMessage(
            err,
            'eSewa payment verification failed. Please check your order status.'
          )
        )
      }
    }

    verify()

    return () => {
      cancelled = true
      if (redirectTimer) clearTimeout(redirectTimer)
    }
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        {status === 'verifying' && (
          <Loader2 className="mx-auto h-12 w-12 animate-spin" />
        )}

        {status === 'success' && (
          <CheckCircle2 className="mx-auto h-12 w-12" />
        )}

        {status === 'failed' && (
          <XCircle className="mx-auto h-12 w-12" />
        )}

        <h1 className="mt-4 text-xl font-semibold">
          {status === 'verifying'
            ? 'Verifying Payment'
            : status === 'success'
              ? 'Payment Successful'
              : 'Payment Failed'}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">{message}</p>

        {status === 'failed' && (
          <button
            type="button"
            className="mt-6 rounded-md px-4 py-2 text-sm font-medium underline"
            onClick={() => navigate('/orders', { replace: true })}
          >
            Go to My Orders
          </button>
        )}
      </div>
    </div>
  )
}
