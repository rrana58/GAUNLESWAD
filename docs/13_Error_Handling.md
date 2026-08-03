# 13. Error Handling

## Frontend Error Handling
Errors experienced by the user are designed to fail gracefully.
- **Validation Errors**: Form inputs (via `zod` and `react-hook-form`) trigger immediate, localized error text below the offending input field without hitting the API.
- **Network Errors**: Axios interceptors catch global network failures or timeouts and display generic, user-friendly toasts (using `sonner` or similar UI libraries).
- **Authentication Errors**: A `401 Unauthorized` response that cannot be recovered via a refresh token gracefully forces the user back to the login view without crashing the app.
- **React Error Boundaries**: High-level component trees are wrapped in Error Boundaries to catch React render exceptions, preventing the "white screen of death" and offering a fallback UI.

## Backend Error Handling
The backend implements a highly centralized error management architecture.
- **`catchAsync` Wrapper**: All async controller functions are wrapped in this utility, eliminating the need for verbose `try/catch` blocks. Unhandled promises automatically forward to the next middleware.
- **Global Error Middleware**: A single Express error-handling middleware sits at the bottom of the stack.
  - In **Development**, it outputs the full stack trace and raw error metadata.
  - In **Production**, it sanitizes the output, classifying operational errors (using the custom `AppError` class) and masking programming bugs (e.g., unhandled TypeErrors) as generic `500 Internal Server Error` messages to prevent leaking architecture details to clients.
- **Validation Errors**: Mongoose validation failures and JWT signature errors are specifically intercepted and translated into human-readable 400-level operational errors.
