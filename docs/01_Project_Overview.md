# 01. Project Overview

## Project Name
Gaunle Swad

## Purpose
Gaunle Swad is a comprehensive cloud kitchen and food delivery application ecosystem. Its purpose is to streamline the entire food ordering lifecycle—from customer menu browsing and order placement to kitchen preparation and final delivery by a rider.

## Business Objectives
- Provide a seamless ordering experience for customers via a mobile-first PWA.
- Enable kitchen staff to efficiently manage incoming orders and update statuses in real-time.
- Empower delivery riders with an optimized interface for accepting and fulfilling deliveries.
- Equip administrators with powerful tools for user management, menu configuration, and business analytics.

## Scope
The scope of the project encompasses:
- A unified multi-role authentication system.
- Four distinct frontend applications tailored to specific operational roles.
- A central backend API managing business logic, state, and database interactions.
- Real-time updates and synchronization (where applicable).

## Key Features
- **Unified Login:** A single authentication entry point supporting phone or email login.
- **Role-based Redirection:** Automatic routing of users to their specific operational dashboards based on their database role.
- **Order Management Lifecycle:** Complete tracking from `Pending` -> `Preparing` -> `Ready` -> `Out for Delivery` -> `Delivered`.
- **Menu Management:** Dynamic categories and items managed by administrators.

## Supported Platforms
- **Customer App:** Progressive Web App (PWA) optimized for mobile devices.
- **Admin Portal:** Desktop-optimized web interface.
- **Kitchen Portal:** Tablet and desktop-optimized web interface.
- **Rider Portal:** Mobile-optimized web interface.

## User Roles
1. **Customer (`customer`)**: Can browse menus, place orders, and track order status.
2. **Admin (`admin`)**: Has full access to manage users, roles, restaurants, menus, and view platform analytics.
3. **Kitchen (`kitchen`)**: Can view incoming orders, accept them, and update preparation statuses.
4. **Delivery/Rider (`delivery`)**: Can view assigned or available deliveries, update delivery status, and mark orders as delivered.

## High-Level System Description
Gaunle Swad employs a monolithic repository structure. The four frontend React applications share utilities (like the unified authentication module) and consume a single monolithic Node.js/Express backend. A MongoDB database serves as the central source of truth for all entities.
