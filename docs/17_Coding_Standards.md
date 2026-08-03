# 17. Coding Standards

## Project Conventions
The Gharko Swad ecosystem adheres to standard modern JavaScript/TypeScript patterns, emphasizing declarative React components and modular Node.js patterns.

## Naming Conventions
- **Files/Components**: React components use PascalCase (e.g., `UnifiedLoginPage.jsx`). Utility files and hooks use camelCase (e.g., `session.js`, `useAuthStore.js`).
- **Variables/Functions**: standard camelCase for variables and methods.
- **Constants/Env**: UPPER_SNAKE_CASE (e.g., `VITE_API_URL`, `JWT_SECRET`).

## Folder Organization
- **Frontend Modules**: Inside `src/`, logic is split by feature or domain:
  - `pages/` for top-level route views.
  - `components/` for reusable UI fragments.
  - `utils/` or `api/` for Axios interceptors and network helpers.
  - `store/` for Zustand state slices.
- **Backend Modules**: Separation of concerns dictates that `routes/` define the API endpoints, `controllers/` execute the business logic, and `models/` define the data structures.

## API Patterns
- REST endpoints rely strictly on HTTP verbs for actions (`GET` for reading, `POST` for creation, `PATCH` for partial updates, `DELETE` for removal).
- Plural nouns are used for resource endpoints (e.g., `/api/v1/orders`).

## Error Handling Patterns
- **Backend**: Never `throw` generic errors from controllers. Use `next(new AppError('Message', statusCode))` to ensure the global error handling middleware can format the response consistently.
- **Frontend**: API logic should rely on React Query's built-in `isError` boolean flags rather than wrapping `useQuery` calls in manual try/catches.
