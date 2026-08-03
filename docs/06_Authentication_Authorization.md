# 06. Authentication & Authorization

## Overview
Authentication is unified across the entire Gharko Swad monolithic ecosystem. A single login flow delegates users to their respective portals based on their database-assigned role, governed by secure JSON Web Tokens (JWT).

## Unified Login Flow
1. User accesses the login page on any portal (e.g., `/admin/login`, `/kitchen/login`).
2. The UI renders the shared `UnifiedLoginPage` component from `@shared/auth`.
3. User submits credentials (phone/email + password).
4. The backend validates credentials and issues an Access Token and a Refresh Token.
5. `saveAuthSession` stores tokens in `localStorage` and syncs them to Zustand global state.
6. `roleRedirect.js` determines the correct dashboard URL based on the user's role and redirects them.

## JWT Lifecycle
- **Access Tokens**: Short-lived tokens (e.g., 15-60 minutes) used for immediate API access.
- **Refresh Tokens**: Long-lived tokens stored in `localStorage` used to seamlessly request new Access Tokens when they expire.
- **Algorithm**: Tokens are signed and verified strictly using the `HS256` symmetric algorithm to prevent tampering and downgrade attacks (`alg: none`).

## Role Detection & Redirects
Roles are strictly determined by the backend database (`customer`, `admin`, `kitchen`, `delivery`). Users cannot select or alter their roles from the frontend. The `getRoleRedirectUrl()` utility parses the role and forwards the user to their designated application URL origin, preventing cross-portal leakage.

## Backend Authorization (`protect` & `restrictTo`)
The Node.js backend enforces authorization via two core middlewares:
1. **`protect`**: Extracts the Bearer token, verifies its cryptographic signature, checks the `tokenVersion` against the database to ensure the session hasn't been globally revoked, and attaches the `user` document to the `req` object.
2. **`restrictTo(...roles)`**: Inspects `req.user.role`. If the role is not explicitly listed in the allowed array (e.g., `restrictTo('admin')`), the request is blocked with a `403 Forbidden`.

## Session Management & Refresh Flow
The `Frontend/shared/api/singleFlightRefresh` utility ensures that if an Access Token expires, the first failed API call (returning a `401`) will trigger a background request to `/auth/refresh`. Subsequent concurrent `401` failures will pause and wait for the single refresh promise to resolve, preventing race conditions and redundant API hits.

## Logout Flow
Triggering a logout invokes `clearAuthSession()`, which:
1. Purges all token and user keys from `localStorage`.
2. Triggers Zustand store reset actions.
3. Automatically kicks the user back to the login screen via frontend route guards.
