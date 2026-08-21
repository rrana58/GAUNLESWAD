export function isCapacitorNative() {
  if (typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
    return window.Capacitor.isNativePlatform();
  }
  return false;
}

export function getRoleRedirectUrl(role) {
  if (isCapacitorNative()) {
    return '/';
  }

  const normalizedRole = (role || '').toLowerCase().trim();
  const path = window.location.pathname;

  // Determine if we are running in dev mode with distinct ports
  const port = window.location.port;
  const isDevMultiPort = Boolean(
    port && ['5173', '5174', '5175', '5176'].includes(port)
  );

  if (isDevMultiPort) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    if (normalizedRole === 'admin') {
      if (port === '5174' || path.startsWith('/admin')) return '/admin/';
      return `${protocol}//${hostname}:5174/admin/`;
    }
    if (normalizedRole === 'kitchen') {
      if (port === '5175' || path.startsWith('/kitchen')) return '/kitchen/';
      return `${protocol}//${hostname}:5175/kitchen/`;
    }
    if (normalizedRole === 'delivery' || normalizedRole === 'rider') {
      if (port === '5176' || path.startsWith('/rider')) return '/rider/';
      return `${protocol}//${hostname}:5176/rider/`;
    }
    // Default to customer
    if (port === '5173' || port === '5174') return '/';
    return `${protocol}//${hostname}:5173/`;
  }

  // Production single-origin routing (Express serving /admin, /kitchen, /rider, /)
  switch (normalizedRole) {
    case 'admin':
      return '/admin/';
    case 'kitchen':
      return '/kitchen/';
    case 'delivery':
    case 'rider':
      return '/rider/';
    case 'customer':
    default:
      return '/';
  }
}

