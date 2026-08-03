# Gharko Swad — Backend API

Cloud kitchen food delivery platform for Nepal.

## Stack
- Node.js + Express
- MongoDB (Mongoose)
- Redis (Bull queues + caching)
- Socket.IO (real-time order tracking)
- Cloudinary (image storage)
- Sparrow SMS (Nepal OTP)
- Khalti + eSewa (Nepal payments)
- Firebase FCM (push notifications)

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Required accounts to set up
| Service | URL | What you need |
|---------|-----|---------------|
| MongoDB Atlas | atlas.mongodb.com | Connection URI |
| Redis | Upstash or local | Redis URL |
| Cloudinary | cloudinary.com | cloud_name, api_key, api_secret |
| Sparrow SMS | sparrowsms.com | API token |
| Khalti | khalti.com/for-business | Secret key |
| Firebase | console.firebase.google.com | Service account JSON |

### 4. Seed database
```bash
node seed.js
# Admin: phone=9800000001, password=admin@123
```

### 5. Run development server
```bash
npm run dev
```

## API Endpoints

### Auth
```
POST   /api/v1/auth/send-otp        Send OTP to phone
POST   /api/v1/auth/verify-otp      Verify OTP → get JWT
POST   /api/v1/auth/admin/login     Admin login with password
POST   /api/v1/auth/refresh         Refresh access token
GET    /api/v1/auth/me              Get current user
PATCH  /api/v1/auth/profile         Update profile
POST   /api/v1/auth/addresses       Add delivery address
POST   /api/v1/auth/fcm-token       Register FCM token
```

### Menu (Public)
```
GET    /api/v1/menu                 List menu items (with filters)
GET    /api/v1/menu/grouped         Full menu grouped by category
GET    /api/v1/menu/categories      All categories
GET    /api/v1/menu/:id             Single item
```

### Menu (Admin)
```
POST   /api/v1/menu                 Create item
PATCH  /api/v1/menu/:id             Update item
DELETE /api/v1/menu/:id             Delete item
PATCH  /api/v1/menu/:id/toggle      Toggle availability
POST   /api/v1/menu/upload/image    Upload item image
POST   /api/v1/menu/categories      Create category
```

### Orders
```
POST   /api/v1/orders               Place order (guest or customer)
GET    /api/v1/orders/track/:token  Track by token (guest)
GET    /api/v1/orders/my-orders     My orders (customer)
GET    /api/v1/orders/:id           Order detail
PATCH  /api/v1/orders/:id/cancel    Cancel order
POST   /api/v1/orders/:id/rate      Rate order
PATCH  /api/v1/orders/:id/status    Update status (admin)
GET    /api/v1/orders               All orders (admin)
```

### Payments
```
POST   /api/v1/payments/khalti/initiate    Start Khalti payment
POST   /api/v1/payments/khalti/verify      Verify after redirect
POST   /api/v1/payments/esewa/data         Get eSewa form data
POST   /api/v1/payments/esewa/verify       Verify after redirect
```

### Admin
```
GET    /api/v1/admin/stats                  Dashboard stats
GET    /api/v1/admin/analytics/revenue      Revenue charts
GET    /api/v1/admin/analytics/top-items    Top selling items
GET    /api/v1/admin/users                  User list
POST   /api/v1/admin/coupons                Create coupon
POST   /api/v1/admin/coupons/validate       Validate coupon
```

## Socket.IO Events

Client sends:
- `join:order <orderId>` — subscribe to order updates
- `join:admin` — admin subscribes to all orders

Server emits:
- `order:updated <order>` — order status changed
- `order:new <order>` — new order placed (admin room)

## Order Status Flow
```
pending → confirmed → preparing → ready → out_for_delivery → delivered
    ↓
cancelled
```
