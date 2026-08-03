# 14. Environment Configuration

## Environment Variables
The repository uses `.env` files to manage environment-specific configurations. Secrets are strictly ignored from version control.

### Backend (`Server/.env`)
Required backend configurations typically include:
- `PORT`: The port the Express server binds to (default: `5000`).
- `MONGO_URI`: The connection string for the MongoDB instance.
- `JWT_SECRET`: A high-entropy cryptographic string used to sign session tokens.
- `JWT_EXPIRES_IN`: Lifespan of the access token (e.g., `1h`).
- `CLOUDINARY_URL`: API keys for image asset management (if utilized).

### Frontend (`Frontend/*/.env`)
Vite specifically exposes variables prefixed with `VITE_`.
- `VITE_API_URL`: The fully qualified URL pointing to the backend API (e.g., `http://localhost:5000/api/v1` for dev, or `https://api.gharkoswad.com/api/v1` for production).

## Development vs Production
- **Development**: Features verbose logging, local database connections, and full stack traces on API errors.
- **Production**: Operates behind reverse proxies (like NGINX), enforces strictly sanitized error responses, requires secure database URIs, and enforces HTTPS.

## Secrets Management
When deployed to cloud providers (e.g., Vercel, AWS, Render), the `.env` files are not uploaded. Instead, secrets are injected directly into the provider's Environment Variables dashboard, keeping the production keys isolated from the codebase entirely.
