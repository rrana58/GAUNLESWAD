# 11. Security

## Overview
Security is applied in defense-in-depth layers across the Node.js backend and React frontends. The primary goal is to protect against OWASP Top 10 vulnerabilities (e.g., XSS, CSRF, Injection, and Broken Access Control).

## Backend Defenses
- **Data Sanitization**: `express-mongo-sanitize` intercepts JSON bodies and strips properties containing `$` or `.`, effectively blocking NoSQL injection attacks against MongoDB.
- **XSS Protection**: Inputs are scrubbed using the `xss` package, preventing the storage and eventual execution of malicious scripts.
- **HTTP Headers**: `helmet` is mounted globally to set secure HTTP response headers (e.g., removing `X-Powered-By`, enforcing `X-Frame-Options`, and `X-Content-Type-Options`).
- **Rate Limiting**: `express-rate-limit` (backed by Redis when in production) throttles excessive requests from single IP addresses to mitigate brute-force password attacks and DDoS attempts.
- **Parameter Pollution**: The `hpp` middleware guards against HTTP parameter pollution.

## Authentication Security
- **JWT Integrity**: Tokens are explicitly verified against the `HS256` symmetric algorithm. The `jwt.verify` options forbid the backend from accepting algorithms like `none`, neutralizing token forgery.
- **Session Revocation**: A `tokenVersion` integer on the `User` model ensures that if an account is compromised or a password is changed, all previously issued refresh and access tokens instantly become invalid.
- **Passwords**: Hashed automatically via `bcryptjs` using a securely scaled salt round before persisting to MongoDB.

## Authorization
- **Privilege Escalation**: The `restrictTo` middleware hard-enforces role boundaries. Even if a user artificially forces the frontend router to navigate to an admin dashboard, all underlying API fetches will be rejected with a `403 Forbidden` response.
- **Ownership Checks**: Custom `requireOwnership` middleware guarantees that users can only view or modify entities (like orders or profiles) that correspond directly to their `_id` (unless the requester has the `admin` role).

## Known Security Limitations
- **Token Storage**: Currently, tokens are kept in browser `localStorage`. While convenient for multi-portal architectures on disparate subdomains, it theoretically exposes the tokens to Cross-Site Scripting (XSS) if the `xss` sanitizers fail. A migration to HttpOnly `SameSite` cookies is a known future improvement path.
