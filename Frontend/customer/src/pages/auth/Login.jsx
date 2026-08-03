import React from 'react'
import { UnifiedLoginPage } from '@shared/auth'
import api from '@/api/axios'
import { useAuthStore } from '@/store/authStore'

export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const currentUser = useAuthStore((s) => s.user)

  return (
    <UnifiedLoginPage
      api={api}
      currentUser={currentUser}
      expectedRole="customer"
      onAuthSuccess={(user, accessToken, refreshToken) => {
        setAuth(user, accessToken, refreshToken)
      }}
    />
  )
}