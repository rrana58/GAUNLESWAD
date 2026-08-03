# 02. System Architecture

## Overall Architecture
Gaunle Swad follows a client-server architectural pattern structured as a monolithic repository (monorepo). 
- **Clients**: Four distinct Single Page Applications (SPAs) built with React and Vite.
- **Server**: A single monolithic Node.js backend using Express.
- **Database**: MongoDB (via Mongoose) acting as the primary data store.

## Frontend Architecture
The frontend layer is divided into four domain-specific applications:
1. `Frontend/customer`: Mobile-first PWA for end-users.
2. `Frontend/admin`: Desktop-oriented management dashboard.
3. `Frontend/kitchen`: Interface for chefs/kitchen staff.
4. `Frontend/rider`: Mobile-oriented interface for delivery personnel.

These applications are completely independent in their routing and bundle generation but share common logic through a shared directory structure (`Frontend/shared`).

## Backend Architecture
The backend (`Server/`) is a monolithic RESTful API. It handles all business logic, data persistence, and cross-cutting concerns (authentication, authorization, logging, rate-limiting). The server is stateless, relying on JWTs for session management.

## Shared Packages
To enforce DRY (Don't Repeat Yourself) principles across the four frontends, the `Frontend/shared` directory acts as an internal package.
- **`@shared/auth`**: Contains the unified `UnifiedLoginPage` component, `roleRedirect.js` logic, and `session.js` storage managers.
- **`@shared/api`**: Contains common Axios interceptor logic (e.g., `singleFlightRefresh`).

Vite's path aliasing (`vite.config.js`) maps `@shared` to this directory during local development and production builds.

## API Communication
Frontends communicate with the backend via HTTPS REST calls using Axios. 
- **Authentication**: JWTs are sent in the `Authorization: Bearer <token>` header.
- **Interceptors**: Axios interceptors automatically attach tokens to outgoing requests and catch `401 Unauthorized` responses to seamlessly request a new access token using a stored refresh token.

## Database Interaction
The backend communicates with MongoDB using Mongoose ORM. Models define strict schemas and relationships (e.g., Orders reference Users and Menu Items).

## Authentication Architecture
Authentication is heavily centralized. 
1. The user inputs credentials into the shared `UnifiedLoginPage`.
2. The backend validates credentials, returning an Access Token, a Refresh Token, and the user's role.
3. The frontend `roleRedirect` router dynamically forwards the user to the correct application URL.
4. Token lifecycle is managed entirely via `localStorage` and synchronized to Zustand stores.

## Deployment Architecture
- **Builds**: `npm run build:all` triggers sequential Vite builds, generating static HTML/JS/CSS assets in the `dist` folders.
- **Hosting (Typical)**: The static frontend assets are deployed to CDNs or static hosting providers (e.g., Vercel, Netlify, AWS S3). The backend is deployed to a Node.js runtime environment (e.g., Render, Heroku, AWS EC2, or Docker containers).
