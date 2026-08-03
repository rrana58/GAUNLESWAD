# 05. Database Design

## Overview
Gharko Swad uses MongoDB as its primary database, interfaced via the Mongoose ODM (Object Data Modeling) library. The schema design emphasizes normalization for core entities while denormalizing some data for read performance (e.g., embedding order items).

## Core Collections / Models

### 1. User Model (`User.js`)
Stores authentication credentials and profile information for all actors in the system.
- **Fields**: `name`, `email`, `phone`, `password` (hashed), `role`, `isActive`, `tokenVersion`.
- **Roles**: Enum restricted to `['customer', 'admin', 'kitchen', 'delivery']`.
- **Security**: Passwords are mathematically hashed using `bcryptjs`. `tokenVersion` tracks session invalidation.

### 2. Menu Model (`Menu.js` / `MenuItem.js`)
Represents the food offerings available to customers.
- **Fields**: `name`, `description`, `price`, `image`, `category`, `isAvailable`.
- **Relationships**: Items belong to specific categories, allowing dynamic menu rendering.

### 3. Order Model (`Order.js`)
Tracks the lifecycle of a food transaction.
- **Fields**: `user` (reference to Customer), `items` (array of embedded menu items with quantities and snapshot prices), `totalAmount`, `status`, `deliveryAddress`.
- **Status Enum**: `['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']`.
- **Relationships**: Links heavily to the `User` who placed it, and optionally the `User` (rider) assigned to deliver it.

### 4. Review / Rating Model (If Applicable)
- Links a Customer `User` to a specific `MenuItem` or `Order` to provide qualitative feedback.

## Relationships
- **One-to-Many**: A `User` (customer) can have many `Orders`.
- **Many-to-Many**: An `Order` contains many `MenuItems`. Mongoose captures the snapshot of the item's price at the time of purchase to prevent historical totals from changing if a menu price is updated later.

## Schema Architecture
The models make heavy use of Mongoose middleware (pre-save hooks) to manage side-effects, such as automatically hashing passwords before saving a user document to the database.
