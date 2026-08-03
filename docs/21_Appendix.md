# 21. Appendix

## Glossary
- **PWA**: Progressive Web App. A web application that uses service workers and manifests to behave similarly to a native mobile application.
- **JWT**: JSON Web Token. A compact, URL-safe means of representing claims securely between two parties.
- **Zustand**: A small, fast, and scalable bearbones state management solution for React.
- **Vite**: A build tool that aims to provide a faster and leaner development experience for modern web projects.
- **RBAC**: Role-Based Access Control. A method of restricting network access based on the roles of individual users.

## Useful Commands

| Command | Purpose |
| :--- | :--- |
| `npm run install:all` | Installs all `node_modules` across the 4 frontends and the backend. |
| `npm run dev:server` | Starts the Express backend using nodemon for hot-reloading. |
| `npm run build:all` | Compiles production assets for all 4 frontend portals. |
| `npm run start` | Starts the Express backend in production mode. |

## Important Configuration Files
- **`Frontend/*/vite.config.js`**: Contains the path aliasing linking `@shared` to `Frontend/shared`, as well as PWA configuration.
- **`Server/middleware/auth.js`**: Contains the core JWT validation and RBAC logic (`protect`, `restrictTo`).
- **`Frontend/shared/auth/roleRedirect.js`**: Central dictionary mapping backend roles to their respective frontend origins.
