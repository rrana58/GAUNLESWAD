# 04. Backend Architecture

## Overview
The backend is a monolithic REST API constructed using Node.js and Express. It serves as the single source of truth for the Gharko Swad platform, handling business logic, data persistence, and security.

## Server Startup
The application entry point is `index.js`.
1. It configures environment variables via `dotenv`.
2. Establishes a connection to MongoDB using `mongoose`.
3. Mounts global middleware (CORS, body parsers, security headers).
4. Registers domain-specific API routes.
5. Mounts global error handlers.
6. Starts the HTTP server on the configured `PORT`.

## Folder Structure
- `config/`: Database connection logic and environment configurations.
- `controllers/`: Request handlers that contain core business logic (e.g., `authController.js`, `orderController.js`).
- `middleware/`: Custom Express middleware for authentication (`protect`), authorization (`restrictTo`), error handling, and file uploads.
- `models/`: Mongoose schemas defining database collections.
- `routes/`: Express routers mapping URLs and HTTP methods to specific controllers.
- `utils/`: Helper functions, custom error classes (`AppError`), and logging mechanisms.

## Routes
Routes are modularized by domain. For example:
- `/api/v1/auth`: Authentication and session management.
- `/api/v1/users`: User management and profile updates.
- `/api/v1/orders`: Order placement and lifecycle tracking.
- `/api/v1/menu`: Menu categories and item management.

## Controllers & Services
Controllers receive the incoming HTTP request (`req`), extract parameters and bodies, execute the necessary business logic (often querying the database directly via Mongoose models), and return JSON responses (`res`).

## Middleware
Middleware functions intercept requests before they reach controllers.
- **`protect`**: Verifies JWT existence and validity.
- **`restrictTo`**: Ensures the authenticated user has the necessary role permissions.
- **Validation**: Uses libraries like `express-validator` to sanitize and validate request payloads.
- **Security**: `helmet` for HTTP headers, `express-mongo-sanitize` to prevent NoSQL injection, and `express-rate-limit` for DDoS protection.

## Error Handling
Errors are caught centrally using a `catchAsync` wrapper which forwards promise rejections to a global error handling middleware. Operational errors are formatted into predictable JSON structures for the frontends to consume.

## Logging
Logging is implemented using `winston` (or `morgan` for HTTP request logging), outputting critical security events, validation failures, and runtime errors to the console or log files.
