/**
 * Shared session persistence helper across all 4 frontend portals.
 * Ensures local storage tokens and Zustand state hydration sync seamlessly.
 */

export function saveAuthSession(user, accessToken, refreshToken) {
  if (!user || !accessToken) return;

  // 1. Standard localStorage keys (used by kitchen, rider, and direct API interceptors)
  localStorage.setItem('token', accessToken);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
  localStorage.setItem('user', JSON.stringify(user));

  const authData = {
    state: {
      user,
      accessToken,
      refreshToken: refreshToken || '',
      isAuthenticated: true,
    },
    version: 0,
  };

  // 2. Zustand persist key for Admin portal
  localStorage.setItem('gharko-admin-auth', JSON.stringify(authData));

  // 3. Zustand persist key for Customer portal
  localStorage.setItem('gharko-swad-auth', JSON.stringify(authData));
}

export function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('gharko-admin-auth');
  localStorage.removeItem('gharko-swad-auth');
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    if (raw) return JSON.parse(raw);

    const adminRaw = localStorage.getItem('gharko-admin-auth');
    if (adminRaw) {
      const parsed = JSON.parse(adminRaw);
      if (parsed?.state?.user) return parsed.state.user;
    }

    const customerRaw = localStorage.getItem('gharko-swad-auth');
    if (customerRaw) {
      const parsed = JSON.parse(customerRaw);
      if (parsed?.state?.user) return parsed.state.user;
    }
  } catch (e) {
    console.error('Failed to parse stored user:', e);
  }
  return null;
}
