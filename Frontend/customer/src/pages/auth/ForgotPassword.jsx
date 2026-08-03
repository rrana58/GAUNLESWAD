import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '@/api/auth'
import { getErrorMessage } from '@/lib/errorMessage'
import PhoneField from '@/components/auth/PhoneField'
import PasswordField from '@/components/auth/PasswordField'
import OtpInput from '@/components/auth/OtpInput'

const phoneSchema = z.object({
  phone: z.string().regex(/^9[678]\d{8}$/, 'Enter a valid Nepal mobile number'),
})

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be 8–16 characters')
    .max(16, 'Password must be 8–16 characters')
    .regex(/[A-Za-z]/, 'Must contain at least one letter')
    .regex(/\d/, 'Must contain at least one number'),
})

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: phone, 2: otp + new password
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const phoneForm = useForm({ resolver: zodResolver(phoneSchema) })
  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) })

  const sendOtp = async ({ phone: enteredPhone }) => {
    setSubmitting(true)
    try {
      await authApi.sendForgotPasswordOtp(enteredPhone)
      setPhone(enteredPhone)
      setStep(2)
      toast.success('OTP sent to your phone')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not send OTP. Try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const resetPassword = async ({ newPassword }) => {
    if (otp.length !== 6) {
      setOtpError('Enter the 6-digit code')
      return
    }
    setOtpError('')
    setSubmitting(true)
    try {
      await authApi.resetPassword({ phone, otp, newPassword })
      toast.success('Password reset. Please log in with your new password.')
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Reset failed. Check your OTP and try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background px-6 pt-16 pb-10">
      <h1 className="font-display text-3xl text-primary">Reset password</h1>
      <p className="text-sm text-muted-foreground mt-1">
        {step === 1 ? "We'll send a code to your phone." : `Verifying ${phone}`}
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
        <form onSubmit={passwordForm.handleSubmit(resetPassword)} className="mt-8 flex flex-col gap-4">
          <OtpInput value={otp} onChange={setOtp} error={otpError} />

          <PasswordField
            {...passwordForm.register('newPassword')}
            placeholder="New password"
            error={passwordForm.formState.errors.newPassword?.message}
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-xl bg-[color:var(--gs-primary,#1B3A25)] text-white py-3 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all gs-focus-ring"
          >
            {submitting ? 'Resetting...' : 'Reset password'}
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
        Remembered it?{' '}
        <Link to="/login" className="text-primary font-medium">
          Log in
        </Link>
      </div>
    </div>
  )
}