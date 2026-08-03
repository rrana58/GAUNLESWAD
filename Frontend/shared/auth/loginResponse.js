/** Thrown when credentials are valid but the user role does not match this portal. */
export class WrongPortalError extends Error {
  constructor(expectedRole, actualRole) {
    super(`Access denied. ${roleLabel(expectedRole)} accounts only.`)
    this.name = 'WrongPortalError'
    this.expectedRole = expectedRole
    this.actualRole = actualRole
  }
}

function roleLabel(role) {
  const norm = (role || '').toLowerCase().trim();
  if (norm === 'delivery' || norm === 'rider') return 'Delivery Rider'
  if (norm === 'kitchen') return 'Kitchen Staff'
  if (norm === 'admin') return 'Admin'
  if (norm === 'customer') return 'Customer'
  return role
}

/** Build login body from phone or email identifier. */
export function buildLoginPayload(loginId, password) {
  const trimmed = String(loginId).trim()
  if (trimmed.includes('@')) {
    return { email: trimmed, password }
  }
  return { phone: trimmed, password }
}

/**
 * Normalize a successful login API response.
 * Returns either a TOTP challenge or authenticated session tokens.
 */
export function parseLoginResponse(data) {
  if (data?.totpRequired) {
    return {
      type: 'totp_required',
      userId: data.userId,
      totpChallengeToken: data.totpChallengeToken,
    }
  }

  return {
    type: 'authenticated',
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  }
}

/** Ensure the authenticated user belongs on this portal. */
export function assertRole(user, expectedRole) {
  if (!expectedRole) return;
  const actualRole = (user?.role || '').toLowerCase().trim();
  const expRole = expectedRole.toLowerCase().trim();
  const isMatch = (expRole === 'delivery' || expRole === 'rider')
    ? (actualRole === 'delivery' || actualRole === 'rider')
    : actualRole === expRole;

  if (!isMatch) {
    throw new WrongPortalError(expectedRole, user?.role)
  }
}

