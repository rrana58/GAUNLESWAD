import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { getErrorMessage } from '@/lib/errorMessage'
import PhoneField from '@/components/auth/PhoneField'
import PasswordField from '@/components/auth/PasswordField'
import OtpInput from '@/components/auth/OtpInput'

const phoneSchema = z.object({
  phone: z.string().regex(/^9[678]\d{8}$/, 'Enter a valid Nepal mobile number'),
})

const detailsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  password: z
    .string()
    .min(8, 'Password must be 8–16 characters')
    .max(16, 'Password must be 8–16 characters')
    .regex(/[A-Za-z]/, 'Must contain at least one letter')
    .regex(/\d/, 'Must contain at least one number'),
  referralCode: z.string().optional(),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms & Conditions to create an account' }),
  }),
})

function useResendCooldown(seconds = 60) {
  const [remaining, setRemaining] = useState(0)
  const intervalRef = useRef(null)

  const start = () => {
    setRemaining(seconds)
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current)
          return 0
        }
        return r - 1
      })
    }, 1000)
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  return { remaining, start }
}

export default function Register() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [step, setStep] = useState(1) // 1: phone, 2: otp + details
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const cooldown = useResendCooldown(60)

  const phoneForm = useForm({ resolver: zodResolver(phoneSchema) })
  const detailsForm = useForm({ resolver: zodResolver(detailsSchema) })

  const sendOtp = async ({ phone: enteredPhone }) => {
    setSubmitting(true)
    try {
      await authApi.sendRegisterOtp(enteredPhone)
      setPhone(enteredPhone)
      setStep(2)
      cooldown.start()
      toast.success('OTP sent to your phone')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not send OTP. Try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const resendOtp = async () => {
    if (cooldown.remaining > 0) return
    setSubmitting(true)
    try {
      await authApi.sendRegisterOtp(phone)
      cooldown.start()
      toast.success('OTP resent')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const completeRegistration = async ({ name, password, referralCode }) => {
    if (otp.length !== 6) {
      setOtpError('Enter the 6-digit code')
      return
    }
    setOtpError('')
    setSubmitting(true)
    try {
      const { data } = await authApi.verifyAndRegister({ phone, otp, name, password, referralCode })
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success(`Welcome, ${data.user.name}!`)
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Registration failed. Check your OTP and try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background px-6 pt-16 pb-10">
      <h1 className="font-display text-3xl text-primary">Create Account</h1>
      <p className="text-sm text-muted-foreground mt-1">
        {step === 1 ? 'Enter your phone number to get started.' : `Verifying ${phone}`}
      </p>

      {step === 1 && (
        <form onSubmit={phoneForm.handleSubmit(sendOtp)} className="mt-8 flex flex-col gap-4">
          <PhoneField {...phoneForm.register('phone')} error={phoneForm.formState.errors.phone?.message} />

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-xl bg-[color:var(--gs-primary,#1B3A25)] text-white py-3 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all gs-focus-ring"
          >
            {submitting ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={detailsForm.handleSubmit(completeRegistration)} className="mt-8 flex flex-col gap-4">
          <OtpInput value={otp} onChange={setOtp} error={otpError} />

          <button
            type="button"
            onClick={resendOtp}
            disabled={cooldown.remaining > 0 || submitting}
            className="text-xs text-primary self-start disabled:text-muted-foreground"
          >
            {cooldown.remaining > 0 ? `Resend OTP in ${cooldown.remaining}s` : 'Resend OTP'}
          </button>

          <input
            {...detailsForm.register('name')}
            name="name"
            id="name"
            autoComplete="name"
            placeholder="Full name"
            className="rounded-[var(--gs-radius-lg,0.75rem)] border bg-[color:var(--gs-surface,#FFFFFF)] px-3 py-2.5 text-sm outline-none transition-colors duration-150 border-[color:var(--gs-border,#E5E7EB)] focus-visible:border-[color:var(--gs-primary,#1B3A25)] focus-visible:ring-2 focus-visible:ring-[color:var(--gs-primary,#1B3A25)]/20"
          />
          {detailsForm.formState.errors.name && (
            <span className="text-xs text-destructive -mt-3" role="alert">{detailsForm.formState.errors.name.message}</span>
          )}

          <input
            {...detailsForm.register('referralCode')}
            name="referralCode"
            id="referralCode"
            placeholder="Referral Code (optional)"
            className="rounded-[var(--gs-radius-lg,0.75rem)] border bg-[color:var(--gs-surface,#FFFFFF)] px-3 py-2.5 text-sm outline-none uppercase placeholder:normal-case transition-colors duration-150 border-[color:var(--gs-border,#E5E7EB)] focus-visible:border-[color:var(--gs-primary,#1B3A25)] focus-visible:ring-2 focus-visible:ring-[color:var(--gs-primary,#1B3A25)]/20"
          />

          <PasswordField {...detailsForm.register('password')} error={detailsForm.formState.errors.password?.message} />

          <label className="flex items-start gap-2.5 mt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              {...detailsForm.register('agreeTerms')}
              className="accent-primary w-4 h-4 mt-0.5 rounded shrink-0"
            />
            <span className="text-xs text-muted-foreground leading-snug">
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="text-primary font-semibold underline">
                Terms & Conditions
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary font-semibold underline">
                Privacy Policy
              </a>
            </span>
          </label>
          {detailsForm.formState.errors.agreeTerms && (
            <span className="text-xs text-destructive -mt-2" role="alert">{detailsForm.formState.errors.agreeTerms.message}</span>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-xl bg-[color:var(--gs-primary,#1B3A25)] text-white py-3 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all gs-focus-ring"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-xs text-muted-foreground underline self-center gs-focus-ring rounded"
          >
            Wrong number? Go back
          </button>
        </form>
      )}

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary font-medium">
          Log in
        </Link>
      </div>
    </div>
  )
}