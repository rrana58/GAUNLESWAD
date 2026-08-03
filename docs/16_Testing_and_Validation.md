# 16. Testing & Validation

## Completed Testing
The application recently underwent a rigorous 14-phase manual validation and stabilization audit focusing heavily on the unified authentication architecture.

- **Build Verification**: `npm run build:all` executes with 0 errors across all 4 React applications.
- **Backend Authorization**: Verified via code inspection that `protect` and `restrictTo` middlewares correctly block unauthorized access and reject invalid `HS256` tokens.
- **Session Lifecycle**: Validated the `singleFlightRefresh` logic ensuring robust recovery from expired Access Tokens.

## Known Testing Limitations
Currently, the repository does not contain an automated testing suite. 
- The `test` script in the root package resolves to missing scripts.
- There are no end-to-end (E2E) testing frameworks (like Cypress or Playwright) configured to mechanically test UI workflows (e.g., navigating the cart or accepting orders) in a live browser.

## Recommended Future Testing
To ensure long-term stability as new features are added, the following testing layers are highly recommended:
1. **Unit Testing**: Implement Jest/Vitest for pure utility functions (e.g., `roleRedirect.js`, formatting helpers).
2. **Integration Testing**: Implement Supertest for the Node.js API to programmatically verify endpoint responses against a seeded MongoDB memory server.
3. **E2E Testing**: Introduce Playwright or Cypress to script automated user journeys across the four portals (e.g., simulating a customer placing an order and an admin viewing it).
