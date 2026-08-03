# 07. API Overview

## General Conventions
The Gharko Swad API is a RESTful service following standard HTTP methodologies. 
- **Base URL**: `/api/v1`
- **Data Format**: `application/json` (both request bodies and responses).
- **Multipart Data**: Endpoints accepting file uploads (e.g., updating menu item images or profile avatars) expect `multipart/form-data`.

## Authentication Protocol
The API relies strictly on JSON Web Tokens (JWT) for authentication.
- **Header**: Requests to protected routes must include the `Authorization` header.
- **Format**: `Bearer <access_token>`

## Error Format Structure
All API errors return a standardized JSON envelope to ensure predictable frontend parsing.
```json
{
  "status": "error",
  "message": "Human-readable error description.",
  "error": { ...stackTraceOrDetails } // Only present in development mode
}
```

## Success Format Structure
Successful payloads generally encapsulate the requested entity inside a `data` object to allow for top-level metadata (like pagination).
```json
{
  "status": "success",
  "data": {
    "user": { ... },
    "orders": [ ... ]
  }
}
```

## Versioning
The API is currently on version 1 (`/api/v1`). If future breaking structural changes occur, they will be introduced under a `/api/v2` namespace to preserve backwards compatibility for older installed PWA clients.
