# 09. State Management

## Overview
State management across the four frontends balances global application state (like authentication and UI settings) with server-synced state (like fetched orders and menus).

## Zustand for Global State
Zustand is utilized as the primary client-side state manager due to its minimal boilerplate and direct hook integration.
- **`useAuthStore`**: Stores the globally available `user` object, `accessToken`, and `refreshToken`. Triggers side effects when logging in or out, synchronizing deeply with `localStorage`.
- **`useCartStore`** (Customer Portal): Manages the array of selected items, quantities, and real-time total calculations before order submission.

## Context Providers
While Zustand handles the bulk of global state, React Context is used sparingly for deep component trees that require highly specialized or strictly encapsulated scopes (e.g., Theme providers or specific complex component configurations).

## Server State via React Query
Instead of pushing fetched API data into global Zustand stores, the applications rely heavily on `@tanstack/react-query`.
- **Benefits**: Automatic caching, garbage collection, background refetching (stale-while-revalidate), and built-in loading/error states.
- **Usage**: Data fetching hooks (e.g., `useQuery(['orders'])`) are executed at the component level, drastically simplifying data flow compared to traditional Redux architectures.

## Data Flow Pipeline
1. **Fetch**: `React Query` hits the API via Axios.
2. **Transform**: Interceptors handle the Bearer token injection.
3. **Render**: Components consume the React Query hook outputs (`data`, `isLoading`).
4. **Mutate**: Submitting forms triggers React Query `useMutation`, which automatically invalidates relevant query caches upon success (e.g., updating an order status forces a refetch of the active orders list).
