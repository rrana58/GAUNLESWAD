# 08. API Reference

This document provides a high-level reference of the implemented REST API endpoints available under the `/api/v1` namespace.

## Authentication Module (`/auth`)

| Method | Endpoint | Protection | Role | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Public | Any | Authenticates user credentials and issues JWTs. |
| `POST` | `/auth/totp/confirm` | Public | Any | Optional step for 2FA validation. |
| `POST` | `/auth/refresh` | Public | Any | Exchanges a valid refresh token for a new access token. |
| `GET`  | `/auth/me` | Protected | Any | Retrieves the current authenticated user's profile. |
| `POST` | `/auth/logout` | Protected | Any | Logs the user out (invalidates token/cookie state if applicable). |

## User Module (`/users`)

| Method | Endpoint | Protection | Role | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET`  | `/users` | Protected | `admin` | Retrieves a paginated list of users. |
| `POST` | `/users/register` | Public | None | Creates a new customer account. |
| `GET`  | `/users/:id` | Protected | `admin` | Retrieves a specific user by ID. |

## Orders Module (`/orders`)

| Method | Endpoint | Protection | Role | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/orders` | Protected | `customer` | Places a new food order. |
| `GET`  | `/orders/my-orders` | Protected | `customer` | Retrieves order history for the logged-in customer. |
| `GET`  | `/orders` | Protected | `admin`, `kitchen` | Retrieves all active or historical orders based on query params. |
| `PATCH`| `/orders/:id/status` | Protected | `admin`, `kitchen`, `delivery` | Updates the lifecycle status of an order (e.g. `pending` to `preparing`). |

## Menu Module (`/menu`)

| Method | Endpoint | Protection | Role | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET`  | `/menu` | Public | Any | Retrieves the list of available menu items and categories. |
| `POST` | `/menu` | Protected | `admin` | Creates a new menu item. |
| `PATCH`| `/menu/:id` | Protected | `admin` | Updates menu item details (price, availability, image). |
| `DELETE`| `/menu/:id`| Protected | `admin` | Deletes a menu item. |
