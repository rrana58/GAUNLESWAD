# 19. Known Limitations

This document exclusively lists limitations that currently exist within the implemented codebase.

## 1. Local Storage for JWTs
- **Limitation**: The `token` and `refreshToken` are stored in the browser's `localStorage` via the `@shared/auth/session.js` module.
- **Impact**: While this easily solves cross-subdomain sharing within a monolithic dev environment, `localStorage` is accessible via JavaScript, leaving the tokens theoretically vulnerable to Cross-Site Scripting (XSS) attacks.

## 2. Hardcoded Role Enumeration
- **Limitation**: The roles (`customer`, `admin`, `kitchen`, `delivery`) are hardcoded as strings inside multiple frontend components (e.g., `roleRedirect.js`, `ProtectedRoute.jsx`) and backend schemas (`User.js`).
- **Impact**: If a role needs to be renamed or added, it requires a manual find-and-replace across both the Node.js API and all 4 React applications.

## 3. Absence of Automated End-to-End Testing
- **Limitation**: The repository does not include an E2E testing framework (like Cypress).
- **Impact**: Cross-portal workflows (e.g., a customer placing an order and the kitchen immediately seeing it) rely heavily on manual QA verification prior to deployment.

## 4. Single Machine Dev Mode
- **Limitation**: The backend authentication relies on a single `HS256` secret.
- **Impact**: If the backend scales horizontally across multiple servers without a unified secret manager (or if sessions transition from JWT to stateful without Redis), auth state may desync. Currently, the JWT approach safely allows horizontal scaling, provided environment variables are perfectly mirrored.
