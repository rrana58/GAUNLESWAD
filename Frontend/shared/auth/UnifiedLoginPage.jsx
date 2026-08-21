import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Lock, User, ShieldCheck, Utensils } from 'lucide-react';
import { createAuthService } from './authService.js';
import { buildLoginPayload, parseLoginResponse } from './loginResponse.js';
import { saveAuthSession, getStoredUser } from './session.js';
import { getRoleRedirectUrl } from './roleRedirect.js';


const T = {
  // Page & card shell
  pageBg:        'var(--gs-auth-page-bg,    #1F2E1A)',   // Deep forest night
  headerBg:      'var(--gs-auth-header-bg,  #142C1C)',   // Forest Green dark
  headerPattern: 'repeating-linear-gradient(45deg, rgba(181,138,99,0.35) 0px, rgba(181,138,99,0.35) 1.5px, transparent 1.5px, transparent 16px), repeating-linear-gradient(-45deg, rgba(181,138,99,0.35) 0px, rgba(181,138,99,0.35) 1.5px, transparent 1.5px, transparent 16px)',
  formBg:        'var(--gs-bg,              #FAF8F5)',    // Warm Ivory
  logoRing:      'var(--gs-auth-header-bg,  #142C1C)',
  logoBg:        'var(--gs-secondary,       #B58A63)',    // Faded Copper
  logoText:      'var(--gs-primary,         #1B3A25)',    // Forest Green on copper
  brandText:     'var(--gs-bg,              #FAF8F5)',
  copperAccent:  'var(--gs-secondary,       #B58A63)',
  // Form
  labelColor:    'var(--gs-text-main,       #1F2937)',
  inputBg:       'var(--gs-surface,         #FFFFFF)',
  inputBorder:   'var(--gs-border,          #E5E7EB)',
  inputText:     'var(--gs-text-main,       #1F2937)',
  inputPlaceholder: 'var(--gs-text-disabled, #9CA3AF)',
  iconColor:     'var(--gs-text-sub,        #6B7280)',
  // CTA
  ctaBg:         'var(--gs-secondary,       #B58A63)',    // Copper CTA
  ctaHover:      'var(--gs-secondary-hover, #9E7454)',
  ctaText:       'var(--gs-primary,         #1B3A25)',    // Forest on Copper
  // 2FA panel
  tfaPanel:      'rgba(27, 58, 37, 0.08)',               // Forest green tint
  tfaBorder:     'rgba(27, 58, 37, 0.2)',
  tfaIcon:       'var(--gs-primary,         #1B3A25)',
  // Divider / footer
  dividerColor:  'var(--gs-border,          #E5E7EB)',
  footerText:    'var(--gs-text-sub,        #6B7280)',
  // Links
  linkColor:     'var(--gs-secondary,       #B58A63)',
  backLink:      'var(--gs-text-sub,        #6B7280)',
};

export default function UnifiedLoginPage({ api, onAuthSuccess, currentUser }) {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 2FA / TOTP challenge state
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [pendingUserId, setPendingUserId] = useState(null);
  const [pendingTotpToken, setPendingTotpToken] = useState(null);

  // Default fallback API using fetch if no custom axios instance provided
  const authService = createAuthService(
    api || {
      post: (url, body) =>
        fetch((import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1') + url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw { response: { data }, message: data.message || 'Request failed' };
          return { data };
        }),
    }
  );

  const handleRedirect = (targetUrl) => {
    const currentPath = window.location.pathname;
    if (targetUrl === '/' && (currentPath === '/login' || currentPath === '/')) {
      navigate('/', { replace: true });
    } else {
      window.location.href = targetUrl;
    }
  };

  // Redirect automatically if user is already authenticated
  useEffect(() => {
    const user = currentUser || getStoredUser();
    if (user && user.role) {
      const target = getRoleRedirectUrl(user.role);
      handleRedirect(target);
    }
  }, [currentUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const id = loginId.trim();
    if (!id || !password) {
      toast.error('Please enter your phone number/email and password');
      return;
    }

    setLoading(true);
    try {
      const payload = buildLoginPayload(id, password);
      const res = await authService.login(payload);
      const result = parseLoginResponse(res.data);

      if (result.type === 'totp_required') {
        setPendingUserId(result.userId);
        setPendingTotpToken(result.totpChallengeToken);
        setTotpRequired(true);
        toast.info('Two-factor authentication required. Enter your code to continue.');
      } else if (result.type === 'authenticated') {
        const { user, accessToken, refreshToken } = result;
        saveAuthSession(user, accessToken, refreshToken);

        if (onAuthSuccess) {
          onAuthSuccess(user, accessToken, refreshToken);
        }

        toast.success(`Welcome back, ${user.name}!`);
        const targetUrl = getRoleRedirectUrl(user.role);
        handleRedirect(targetUrl);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Login failed. Please check your credentials.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTotpVerify = async (e) => {
    e.preventDefault();
    if (!totpCode || totpCode.trim().length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.confirmTotpLogin({
        userId: pendingUserId,
        token: totpCode.trim(),
        totpChallengeToken: pendingTotpToken,
      });

      const result = parseLoginResponse(res.data);
      if (result.type === 'authenticated') {
        const { user, accessToken, refreshToken } = result;
        saveAuthSession(user, accessToken, refreshToken);

        if (onAuthSuccess) {
          onAuthSuccess(user, accessToken, refreshToken);
        }

        toast.success(`Welcome back, ${user.name}!`);
        const targetUrl = getRoleRedirectUrl(user.role);
        handleRedirect(targetUrl);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Invalid authentication code';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── Input class helper using design tokens ── */
  const inputClass = [
    'w-full py-3 bg-white border rounded-lg text-sm',
    'placeholder:text-[color:var(--gs-text-disabled,#9CA3AF)]',
    'text-[color:var(--gs-text-main,#1F2937)]',
    'border-[color:var(--gs-border,#E5E7EB)]',
    'focus:outline-none',
    'focus-visible:ring-2 focus-visible:ring-[color:var(--gs-secondary,#B58A63)]',
    'focus-visible:border-[color:var(--gs-secondary,#B58A63)]',
    'transition-colors duration-150',
  ].join(' ');

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden"
      style={{ backgroundColor: T.pageBg }}
    >
      {/* Ambient warmth — soft forest glow, purely a static backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(27,58,37,0.4), transparent 60%), radial-gradient(ellipse 50% 40% at 90% 100%, rgba(181,138,99,0.15), transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative motion-safe:animate-[gsAuthFadeUp_0.4s_ease-out]">
        <style>{`
          @keyframes gsAuthFadeUp {
            from { opacity: 0; transform: translateY(var(--gs-space-2, 8px)); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            boxShadow: 'var(--gs-shadow-modal, 0 20px 40px -8px rgba(0,0,0,0.4))',
            border: `1px solid rgba(181, 138, 99, 0.2)`,
          }}
        >
          {/* ── Brand Header Band — Dhaka-lattice pattern ── */}
          <div
            className="relative px-6 pt-9 pb-8 flex flex-col items-center text-center"
            style={{
              backgroundColor: T.headerBg,
              backgroundImage: T.headerPattern,
            }}
          >
            {/* Logo mark */}
            <div
              className="w-14 h-14 rounded-full ring-4 flex items-center justify-center shadow-lg mb-4"
              style={{
                backgroundColor: T.logoBg,
                ringColor: T.logoRing,
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              }}
            >
              <Utensils size={26} strokeWidth={2.25} color={T.logoText} />
            </div>

            <h1
              className="text-[1.75rem] sm:text-3xl font-semibold tracking-tight"
              style={{
                color: T.brandText,
                fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
              }}
            >
              Gharko Swaad
            </h1>
            <p
              className="text-xs uppercase tracking-[0.2em] mt-2 font-medium"
              style={{ color: T.copperAccent }}
            >
              Staff Sign In
            </p>
          </div>

          {/* ── Form Surface — Warm Ivory canvas ── */}
          <div className="px-6 sm:px-8 py-8" style={{ backgroundColor: T.formBg }}>
            {!totpRequired ? (
              <form onSubmit={handleLogin} className="space-y-5" noValidate>

                {/* Phone / Email field */}
                <div>
                  <label
                    htmlFor="loginId"
                    className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: T.labelColor }}
                  >
                    Phone Number or Email
                  </label>
                  <div className="relative rounded-lg">
                    <div
                      className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
                      style={{ color: T.iconColor }}
                    >
                      <User size={18} aria-hidden="true" />
                    </div>
                    <input
                      id="loginId"
                      name="loginId"
                      type="text"
                      required
                      autoComplete="username"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="Enter your phone number"
                      className={`${inputClass} pl-10 pr-4`}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: T.labelColor }}
                  >
                    Password
                  </label>
                  <div className="relative rounded-lg">
                    <div
                      className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
                      style={{ color: T.iconColor }}
                    >
                      <Lock size={18} aria-hidden="true" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={`${inputClass} pl-10 pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center gs-focus-ring rounded-r-lg"
                      style={{ color: T.iconColor }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {/* Sign in CTA */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 font-semibold text-sm rounded-xl flex items-center justify-center cursor-pointer transition-colors duration-150 gs-focus-ring disabled:opacity-60 active:scale-[0.98]"
                  style={{
                    backgroundColor: T.ctaBg,
                    color: T.ctaText,
                    boxShadow: 'var(--gs-shadow-sm)',
                  }}
                  onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = T.ctaHover)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = T.ctaBg)}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin mr-2" aria-hidden="true" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>

                {/* Customer-only links */}
                {typeof window !== 'undefined' && window.location.pathname === '/login' && (
                  <div className="space-y-2 pt-1">
                    <div className="text-center text-xs" style={{ color: T.footerText }}>
                      <a
                        href="/forgot-password"
                        className="underline underline-offset-4 hover:opacity-80 transition-opacity"
                        style={{ color: T.linkColor }}
                      >
                        Forgot password?
                      </a>
                    </div>
                    <div className="text-center text-xs" style={{ color: T.footerText }}>
                      Don't have an account?{' '}
                      <a
                        href="/register"
                        className="font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity"
                        style={{ color: T.linkColor }}
                      >
                        Create one
                      </a>
                    </div>
                    <div className="text-center text-xs pt-0.5">
                      <a
                        href="/"
                        className="underline underline-offset-4 hover:opacity-80 transition-opacity"
                        style={{ color: T.footerText }}
                      >
                        Browse menu as guest →
                      </a>
                    </div>
                  </div>
                )}
              </form>
            ) : (
              /* ── 2FA / TOTP Challenge ── */
              <form onSubmit={handleTotpVerify} className="space-y-5" noValidate>
                <div
                  className="flex flex-col items-center text-center p-4 rounded-xl mb-2"
                  style={{
                    backgroundColor: T.tfaPanel,
                    border: `1px solid ${T.tfaBorder}`,
                  }}
                >
                  <ShieldCheck
                    size={32}
                    className="mb-1.5"
                    style={{ color: T.tfaIcon }}
                    aria-hidden="true"
                  />
                  <h2
                    className="text-base font-semibold"
                    style={{ color: T.labelColor }}
                  >
                    Two-Factor Authentication
                  </h2>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: T.iconColor }}
                  >
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <div>
                  <input
                    id="totpCode"
                    name="totpCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="000000"
                    className={`${inputClass} text-center text-2xl tracking-[0.5em] font-mono font-bold`}
                    aria-label="6-digit authenticator code"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 font-semibold text-sm rounded-xl flex items-center justify-center cursor-pointer transition-colors duration-150 gs-focus-ring disabled:opacity-60 active:scale-[0.98]"
                  style={{
                    backgroundColor: T.ctaBg,
                    color: T.ctaText,
                    boxShadow: 'var(--gs-shadow-sm)',
                  }}
                  onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = T.ctaHover)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = T.ctaBg)}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin mr-2" aria-hidden="true" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & continue'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTotpRequired(false);
                    setTotpCode('');
                    setPendingUserId(null);
                    setPendingTotpToken(null);
                  }}
                  className="w-full text-center text-xs underline underline-offset-4 hover:opacity-80 transition-opacity gs-focus-ring rounded"
                  style={{ color: T.backLink }}
                >
                  Back to login
                </button>
              </form>
            )}

            {/* Footer divider */}
            <div
              className="mt-7 pt-4 text-center"
              style={{ borderTop: `1px solid ${T.dividerColor}` }}
            >
              <p className="text-xs font-medium" style={{ color: T.footerText }}>
                Gaunle Swaad © {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}