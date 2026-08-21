

const ZUSTAND_KEY = {
  admin: 'gharko-admin-auth',
  customer: 'gharko-swad-auth',
};

export function saveAuthSession(user, accessToken, refreshToken, app) {
  if (!user || !accessToken) return;

  if (app === 'admin' || app === 'customer') {
    const authData = {
      state: {
        user,
        accessToken,
        refreshToken: refreshToken || '',
        isAuthenticated: true,
      },
      version: 0,
    };
    localStorage.setItem(ZUSTAND_KEY[app], JSON.stringify(authData));
    return;
  }

  // kitchen / rider — flat keys, no zustand persist involved
  localStorage.setItem('token', accessToken);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuthSession(app) {
  if (app === 'admin' || app === 'customer') {
    localStorage.removeItem(ZUSTAND_KEY[app]);
    return;
  }
  // kitchen / rider
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

export function getStoredUser(app) {
  try {
    if (app === 'admin' || app === 'customer') {
      const raw = localStorage.getItem(ZUSTAND_KEY[app]);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.user || null;
    }
    // kitchen / rider
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Failed to parse stored user:', e);
    return null;
  }
}