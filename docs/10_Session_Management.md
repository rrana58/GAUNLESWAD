# 10. Session Management

## Overview
The architecture is inherently stateless on the backend. Sessions are maintained via JSON Web Tokens (JWT) persisting on the client device. This allows the backend to horizontally scale without requiring Redis-backed session stores for standard requests.

## Token Storage
Tokens (`token` and `refreshToken`) alongside basic `user` metadata are stringified and stored in `localStorage`. 

## Refresh Token Flow
To mitigate the security risks of long-lived access tokens, access tokens expire quickly.
1. When an access token expires, the backend API throws a `401 Unauthorized` error.
2. The `@shared/api/singleFlightRefresh` Axios interceptor catches this globally.
3. It pauses all outgoing API requests and makes a single background call to `/api/v1/auth/refresh`.
4. Upon receiving the new token, it updates `localStorage`, injects the new token into the original paused requests, and replays them seamlessly.
5. If the refresh token is also expired or invalid, the session is forcibly cleared, and the user is redirected to login.

## Session Restoration
On a hard browser refresh, `getStoredUser()` is invoked during app initialization. If valid `localStorage` keys exist, the Zustand `authStore` rehydrates immediately, bypassing the need to hit a `/me` endpoint before rendering the initial protected routes.

## Logout & Cross-App Synchronization
Calling `clearAuthSession()` guarantees a unified purge. Because the frontends operate under the monolithic umbrella, clearing the keys purges the session globally across all portals running on the same domain/port configuration.
