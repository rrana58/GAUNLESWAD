# Security Architecture — Gharko Swad Backend

## What's Protected and How

### 1. Authentication
| Threat | Fix Applied |
|--------|-------------|
| Brute-force OTP | 5 attempts then 15-min lockout + OTP wiped |
| SMS bombing | 5 OTP requests/15min per IP (`otpLimiter`) |
| Timing attacks on OTP | `crypto.timingSafeEqual()` comparison |
| User enumeration via OTP | Same generic message whether phone exists or not |
| User enumeration via login | Dummy bcrypt run even if user not found |
| Weak OTP generation | `crypto.randomInt()` instead of `Math.random()` |
| JWT algorithm confusion (alg:none) | `algorithms: ["HS256"]` explicitly set |
| JWT without issuer/audience | `issuer` + `audience` claims required |
| Stale tokens after password change | `tokenVersion` incremented on password change |
| Refresh token reuse (theft detection) | Refresh token stored as SHA-256 hash; reuse invalidates ALL sessions |
| Session not killed on logout | Refresh token hash cleared; `logoutAll` increments tokenVersion |

### 2. Input Validation & Injection
| Threat | Fix Applied |
|--------|-------------|
| MongoDB NoSQL injection | `express-mongo-sanitize` strips `$` and `.` from all inputs |
| XSS via user input | `xss` library sanitizes all strings recursively |
| Mass assignment (e.g. `role: "admin"`) | `allowFields()` middleware whitelists allowed body fields per route |
| HTTP Parameter Pollution | `hpp` middleware, whitelist on safe params |
| Oversized JSON bodies | Body limit: `50kb` (was `10mb` — dangerous) |
| Invalid ObjectIDs crashing the app | `validateObjectId()` middleware on all `:id` params |
| Price manipulation from client | All prices recalculated server-side from DB — client prices ignored |
| Float exploit in order totals | `Math.round(x * 100) / 100` applied to all money values |
| Item/quantity overflow | Max 20 items per order, max qty 10 per item |

### 3. Rate Limiting
| Endpoint | Limit |
|----------|-------|
| All routes | 200 req/15min/IP |
| `/auth/*` | 20 req/15min/IP (failed only) |
| `/auth/send-otp` | 5 req/15min/IP |
| `/payments/*` | 10 req/10min/IP |
| `/admin/*` | 300 req/15min/IP |
| Auth after failures | Progressive slow-down: +500ms/req after 5, max 20s |

### 4. HTTP Security Headers (Helmet)
- `Content-Security-Policy` — restricts what can load
- `Strict-Transport-Security` — HTTPS enforced for 1 year + preload
- `X-Content-Type-Options: nosniff` — no MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Powered-By` hidden — doesn't reveal Express
- `frameSrc: none` — no clickjacking via iframes

### 5. CORS
- Strict origin whitelist (WEB_URL + ADMIN_URL only)
- No wildcard `*` in production
- 24h preflight cache

### 6. Payments
- Amount verified server-side against DB after gateway callback
- Mismatch logs security alert and fails payment
- Duplicate payment initiation detected and blocked
- Idempotent verify endpoints (safe to call twice)
- `paymentLogger` separate from app logs

### 7. File Uploads
- MIME type whitelist: only JPEG, PNG, WebP
- Extension whitelist checked alongside MIME (prevents spoofing)
- Max 5MB, 1 file at a time
- Random public_id — no predictable filenames

### 8. Data
- OTP stored hashed? No — stored plaintext but `select: false` + 10-min TTL + wiped on use
- Passwords: bcrypt with cost factor 12
- Refresh tokens: stored as SHA-256 hash, raw token returned once
- `toJSON` transform strips ALL sensitive fields from User model output
- Soft delete: phone/email prefixed with `DELETED_timestamp_` to free them for re-registration
- Addresses capped at 5, FCM tokens capped at 5

### 9. Socket.IO
- JWT verified with algorithm lock on connection
- `maxHttpBufferSize: 10KB` — large payload flood prevented
- Event rate limit: 50 events/min per socket
- `join:admin` only works if JWT role === "admin"
- Order updates emit only safe fields to customers (no adminNote)

### 10. Logging
- Separate loggers: `app`, `request`, `security`, `payment`
- Sensitive fields auto-redacted: `password`, `otp`, `token`, `secret`, `authorization`
- Production: daily rotating files, 14-day retention
- Request IDs on every response for log correlation
- Stack traces only in development responses

### 11. Startup
- Required env vars validated at startup — server refuses to start if missing
- JWT secrets must be 32+ characters
- Default placeholder secrets detected in production — hard fail

## Running a Security Audit
```bash
npm audit --audit-level=high    # Check for known CVEs in dependencies
```

## What's NOT covered (future improvements)
- IP-based allowlist for admin routes
- 2FA for admin (TOTP)
- API key rotation mechanism
- WAF (Cloudflare recommended for production)
- Penetration testing before public launch
