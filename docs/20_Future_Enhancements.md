# 20. Future Enhancements

This section details **optional future improvements** that are NOT currently implemented in the system, but represent recommended logical next steps for the engineering team.

## 1. Migration to HttpOnly Cookies
To eliminate the XSS risks associated with `localStorage`, the authentication system could be refactored to use `HttpOnly`, `Secure`, and `SameSite` cookies for the refresh token. The frontend would then manage access tokens exclusively in-memory (via Zustand).

## 2. Monorepo Tooling (Turborepo or Nx)
Currently, the root `package.json` relies on crude `cd` chaining (e.g., `cd Frontend/customer && npm run build`) to manage the monolithic structure. Introducing a tool like Turborepo or Nx would drastically improve build caching, dependency hoisting, and script execution across the 5 independent projects.

## 3. Centralized Shared Package Manager
Instead of relying on Vite path aliases (`@shared`), the shared modules could be extracted into a dedicated local NPM package workspace. This would enforce stricter boundary checks and allow independent linting and testing of the authentication utilities.

## 4. Playwright / Cypress Integration
Introducing a headless browser testing suite that can automatically spin up the backend, seed the MongoDB memory server, and interactively assert that a customer order correctly appears on the kitchen dashboard in real-time.
