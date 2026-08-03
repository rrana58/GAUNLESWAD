# 15. Build & Deployment

## Installation
1. Clone the repository.
2. From the project root, run the aggregate install command:
   ```bash
   npm run install:all
   ```
   *This navigates into all 4 frontends and the `Server` directory to run `npm install`.*

## Local Development
To run the ecosystem locally:
1. Start the backend server:
   ```bash
   npm run dev:server
   ```
2. In separate terminals, start the respective frontends you are actively working on:
   ```bash
   cd Frontend/customer && npm run dev
   ```

## Build Commands
The root `package.json` contains aggregate scripts to orchestrate production builds across the monorepo.
- **Build All**: `npm run build:all`
  - This command executes `npm run build` sequentially in `customer`, `admin`, `kitchen`, and `rider`.
- **Individual Builds**: `npm run build:customer`, `npm run build:admin`, etc.

## Deployment Process
Deploying the monolithic structure usually involves separating the frontend static assets from the backend Node.js runtime.

### Frontend Deployment
1. Execute `npm run build:all`.
2. The `dist/` folders inside each frontend package contain the production-ready static assets.
3. These folders can be uploaded to static web hosts (e.g., Vercel, Netlify, Cloudflare Pages, or AWS S3).
4. **Environment Setup**: Ensure the host is configured with the production `VITE_API_URL` environment variable pointing to your live backend domain.

### Backend Deployment
1. The `Server/` directory requires a Node.js runtime (e.g., Render, AWS EC2, or a Dockerized container on AWS ECS/Kubernetes).
2. Start the server using `npm run start` (which executes `node index.js`).
3. **Prerequisites**: Ensure the production environment variables (`MONGO_URI`, `JWT_SECRET`, etc.) are securely injected into the host environment.
