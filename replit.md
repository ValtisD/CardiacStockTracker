# Medical Device Inventory Management System

## Overview

This full-stack application tracks medical devices, leads, and materials for cardiac rhythm management (CRM) field engineers. It manages inventory across home and car stock locations, handles hospital/customer relationships, and records implant procedures with material usage. Key features include barcode scanning, low stock alerts, inventory transfers, and comprehensive reporting. The system aims to streamline inventory management and procedure tracking for field engineers.

## User Preferences

Preferred communication style: Simple, everyday language.

## Authentication & Authorization

The application uses **Auth0** for multi-user authentication with role-based access control.

**Setup Requirements**:
- Auth0 Domain: `dev-aljdisualoyvqfhx.eu.auth0.com`
- Auth0 Client ID: `NFyp8wssAs7cBwNd1FhvilAaDWQeae1A`
- Auth0 Audience: `https://CRM-Stock-Dimi`
- Admin Email: `valtisdimitris@gmail.com`

**Important**: Auth0 must be configured with a custom action to include the email claim in access tokens:
1. Go to Auth0 Dashboard → Actions → Flows → Login
2. Create custom action "Add email to token"
3. Add code: `api.accessToken.setCustomClaim('email', event.user.email);`
4. Deploy and add to login flow

**Authorization Model**:
- **Admin users** (identified by email matching `AUTH0_ADMIN_EMAIL`):
  - Can add/edit/delete products in the shared product catalog
  - Full access to all features
- **Regular users**:
  - Manage their own inventory (home/car stock)
  - Configure their own stock alert thresholds via userProductSettings
  - Record procedures and view their own data
  - Cannot modify the shared product catalog

All user data (inventory, procedures, transfers) is isolated by `userId` from the Auth0 JWT `sub` claim. **Hospitals** and **Products** are globally shared across all users.

## System Architecture

### Frontend

The frontend is a React 18 SPA with TypeScript, built using Vite. It utilizes Shadcn/ui (built on Radix UI) for components, following Material Design 3 principles with Tailwind CSS, and supports responsive design and dark mode. State management is handled by TanStack Query for server state and React Hook Form with Zod for form validation. Client-side routing is managed by Wouter.

**Key Features**:
- Dashboard overview
- Separate inventory views (home/car)
- Product and hospital management
- Implant procedure reporting
- Stock transfer functionality (both item-level and bulk transfers)
- Global search
- Low stock alerts
- PDF exports for expiring products and stock reports
- Barcode scanning with GS1 parsing for product lookup and auto-filling inventory details (serial, lot, expiration). It supports real-time camera-based scanning and manual GTIN entry, with comprehensive error handling and duplicate serial prevention.
- PDF Export for Expiring Products Report, Car Stock Report, and Home Stock Reorder Report (with automatic German email text copy to clipboard).
- Individual item transfer buttons ("Move to Car" / "Move to Home") in inventory tables for quick location changes.
- **Progressive Web App (PWA)** with full offline capabilities for field use in hospitals with poor connectivity.

### Offline Mode & PWA

The application is a fully installable Progressive Web App with complete offline support, designed for field engineers working in hospitals with unreliable internet connectivity.

**Offline Architecture**:
- **Service Worker**: Caches all static assets (HTML, CSS, JS, fonts, images) for instant offline loading
- **IndexedDB Storage**: Local database persists inventory, procedures, products, and hospitals data
- **Sync Queue**: All mutations (add/edit/delete) are queued when offline and automatically synced when connection returns
- **Offline Indicator**: Visual status indicator shows online/offline state and pending sync count

**How It Works**:
1. **Online First**: When online, data is fetched from server and cached locally in IndexedDB
2. **Offline Fallback**: When offline, queries read from IndexedDB; mutations are queued
3. **Automatic Sync**: When connection returns, pending changes are automatically synced without user intervention
4. **IndexedDB Refresh**: After sync completes, full data is fetched from server using React Query (with proper auth) and cached to IndexedDB
5. **Cache Clearing**: All cache methods (cacheProducts, cacheInventory, etc.) clear the IndexedDB store first, then add new items - ensuring empty arrays properly clear old data

**Files**:
- `client/src/lib/offlineStorage.ts`: IndexedDB wrapper for local data persistence
- `client/src/lib/syncManager.ts`: Sync queue system for offline mutations
- `client/src/components/OfflineIndicator.tsx`: Status indicator UI component
- `public/sw.js`: Service worker for asset caching
- `public/manifest.json`: PWA manifest for installability

**User Experience**:
- App works fully offline after first load
- All features available (add inventory, record procedures, transfer stock)
- Changes sync automatically when internet returns
- Visual indicators show offline status and pending changes count
- Toast notifications only for errors (all success toasts removed per user preference)

**iOS Setup Requirements**:
1. **Add to Home Screen**: On iOS Safari, tap Share → "Add to Home Screen" for full PWA features
2. **IndexedDB Persistence**: iOS requires the app to be installed as PWA for reliable IndexedDB storage
3. **Service Worker Limitation**: Service workers require HTTPS (works in production/deployed apps, may fail in development)
4. **Offline Mode**: IndexedDB-based offline functionality works independently of service workers

### Backend

The backend is an Express.js server providing a RESTful API. It uses a middleware-based request/response pipeline and custom error handling. The data access layer uses a repository pattern with Drizzle ORM for type-safe PostgreSQL queries and transaction support.

### Database

PostgreSQL (Neon serverless) is the primary database, using Drizzle ORM for schema management and migrations. The schema includes:
- **Products**: Simplified reference database storing GTIN (unique), Model Number, Product Name, and minimum stock thresholds (minCarStock, minTotalStock). Acts as a lookup catalog for barcode scanning workflows.
- **Inventory**: Tracks individual inventory items by location (home/car) with per-item serial number, lot number, and expiration date tracking. Each row represents a unique item.
- **Hospitals**: Manages customer details (global - shared across all users).
- **Implant Procedures**: Records surgical procedure details.
- **Procedure Materials**: Tracks material usage for procedures.

**Low Stock Alerts**: The system tracks low stock by product type (GTIN), not by individual serial numbers. It aggregates all inventory items for each product across serial/lot numbers, sums their quantities, and compares against minimum thresholds to generate alerts.

Data validation is performed using Zod schemas on both client and server.

## External Dependencies

### Database Services
- **Neon Serverless PostgreSQL**: Cloud-hosted PostgreSQL.

### UI Component Libraries
- **Radix UI**: Headless UI primitives.
- **Shadcn/ui**: Pre-built components.
- **Lucide React**: Icon library.

### Form & Validation
- **React Hook Form**: Form state management.
- **Zod**: Schema validation.
- **@hookform/resolvers**: Zod integration for React Hook Form.

### Data Fetching & Caching
- **TanStack Query**: Server state management.
  - **Cache Invalidation Pattern**: All inventory-affecting mutations use predicate-based invalidation to ensure instant UI updates across all inventory-related queries. The predicate `(query) => query.queryKey[0]?.toString().startsWith('/api/inventory') ?? false` matches all inventory queries including those with embedded parameters like `/api/inventory?location=car`, `/api/inventory/summary`, and `/api/inventory/low-stock`. This approach ensures consistent cache invalidation without needing to manually list every query key variant.

### Styling
- **Tailwind CSS**: Utility-first CSS framework.
- **class-variance-authority**: Variant-based styling.
- **clsx**, **tailwind-merge**: Conditional class utilities.

### Build Tools
- **Vite**: Frontend build tool.
- **esbuild**: Backend bundling.
- **TypeScript**: Type checking and compilation.
- **PostCSS**: CSS processing.

### Date Handling
- **date-fns**: Date manipulation and formatting.

### Routing
- **Wouter**: Lightweight client-side routing.

### Barcode Scanning
- **@zxing/library**: Real-time camera-based barcode scanning.

### PDF Export
- **jsPDF**, **jspdf-autotable**: PDF generation.

### Fonts
- **Google Fonts**: Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono.