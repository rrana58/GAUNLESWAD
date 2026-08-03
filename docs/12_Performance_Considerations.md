# 12. Performance Considerations

## Overview
The architecture is designed to serve a high volume of orders rapidly. Performance optimization spans static bundle generation, API payload minimization, and client-side caching.

## Frontend Optimization
- **Code Sharing**: The monolithic structure means the `@shared` module is compiled efficiently into the consuming applications.
- **Bundle Optimization**: Vite heavily leverages ES modules and Rollup for aggressive tree-shaking. The `build:all` script produces highly minimized JavaScript and CSS chunks.
- **State Caching**: React Query caches API responses in-memory, preventing redundant network requests when users navigate back to previously viewed pages (e.g., viewing an order detail, then hitting 'back' to the order list).

## Backend Optimization
- **Payload Compression**: The Express server implements the `compression` middleware, GZIPing all JSON payloads before transmitting them to the client.
- **Index Optimization**: The MongoDB schemas are designed to leverage indexing on frequently queried fields (like `role`, `status`, and `user`).
- **Statelessness**: Because JWTs encapsulate the session data and `tokenVersion` checks are efficient, the backend does not need to perform heavy round-trips to Redis for standard session validations, allowing horizontal scaling across multiple Node.js instances.

## Asset & Image Optimization
If the system leverages user-uploaded images (e.g., menu item photos), they are managed via Cloudinary (as seen by `multer-storage-cloudinary` in `package.json`), which offloads image resizing, WebP conversion, and global CDN delivery from the Node.js server.

## PWA Capabilities
The Customer Portal uses `vite-plugin-pwa` to install a Service Worker. Once loaded, core application shells and static assets are cached locally on the device, ensuring the app launches instantly and remains resilient against poor network conditions.
