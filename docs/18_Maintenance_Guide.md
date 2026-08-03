# 18. Maintenance Guide

## How to Maintain Shared Modules
The `@shared` logic (e.g., `Frontend/shared/auth`) is imported by multiple applications.
- **Caution**: Any modification to a shared file impacts all 4 frontends. Always run `npm run build:all` after editing `@shared` to ensure you haven't introduced syntax errors or broken imports in downstream applications.
- **Path Aliasing**: The `vite.config.js` of each frontend manages the `@shared` alias. Do not alter this configuration unless you are restructuring the repository.

## How to Add New User Roles
1. **Database**: Update the enum in the Mongoose `User` model (`Server/models/User.js`) to accept the new role string.
2. **Frontend Routing**: Update `getRoleRedirectUrl()` in `@shared/auth/roleRedirect.js` to map the new role to its frontend origin.
3. **Backend Middleware**: You can immediately secure API endpoints for the new role by adding it to the `restrictTo('admin', 'newRole')` middleware argument.

## How to Add New APIs
1. Create a new model in `Server/models/`.
2. Create the business logic in `Server/controllers/`. Wrap async functions in `catchAsync`.
3. Map the endpoint in `Server/routes/` and protect it using `protect` and `restrictTo`.
4. Mount the new router in `Server/index.js` (e.g., `app.use('/api/v1/newFeature', newRouter)`).

## Upgrade Considerations
- **Node.js**: The backend currently targets Node.js >= 18.
- **React/Vite**: The frontend uses React 19 and Vite 8. Upgrading major versions of these tools may require adjustments to the internal plugins (especially `vite-plugin-pwa`).
