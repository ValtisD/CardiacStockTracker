# Medical Device Inventory Management System

## Overview

This is a full-stack medical device inventory management application designed for cardiac rhythm management (CRM) field engineers. The system tracks medical devices (pacemakers, ICDs, CRTs), leads/electrodes, and materials across multiple locations (home stock and car stock), manages hospital/customer relationships, and records implant procedures with material usage tracking.

The application provides barcode scanning capabilities for quick product lookup, low stock alerts, inventory transfers between locations, and comprehensive reporting of implant procedures.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Client-side routing via Wouter for lightweight navigation
- Single-page application (SPA) pattern with route-based code organization

**UI Component System:**
- Shadcn/ui components built on Radix UI primitives
- Material Design 3 principles with custom Tailwind CSS configuration
- Responsive design with mobile-first approach using `use-mobile` hook
- Dark mode support with theme toggle functionality
- Design tokens defined in CSS variables for consistent theming across light/dark modes

**State Management:**
- TanStack Query (React Query) for server state management and caching
- Form state handled by React Hook Form with Zod schema validation
- Local component state using React hooks
- Query invalidation strategy for real-time data consistency after mutations

**Key Features:**
- Dashboard with inventory overview and alerts
- Separate inventory views for home and car locations
- Product management with barcode scanning
- Hospital/customer management
- Implant procedure reporting with material tracking
- Stock transfer functionality between locations
- Global search capability
- Low stock alerts and notifications

### Backend Architecture

**Server Framework:**
- Express.js as the HTTP server framework
- RESTful API design pattern
- Middleware-based request/response pipeline
- Custom error handling middleware
- Development logging middleware for API requests

**API Structure:**
- Resource-based endpoints (`/api/products`, `/api/inventory`, `/api/hospitals`, `/api/implant-procedures`)
- CRUD operations for all major entities
- Query parameters for filtering (e.g., location-based inventory queries)
- Barcode lookup endpoint for quick product identification
- Aggregated endpoints for low stock items

**Data Access Layer:**
- Storage abstraction layer (`server/storage.ts`) implementing IStorage interface
- Repository pattern for database operations
- Type-safe database queries using Drizzle ORM
- Transaction support for multi-table operations (e.g., implant procedures with materials)

### Database Architecture

**ORM & Migrations:**
- Drizzle ORM for type-safe database access
- PostgreSQL as the primary database (via Neon serverless)
- Schema-first approach with shared TypeScript types
- Database migrations managed via `drizzle-kit`

**Schema Design:**

1. **Products Table** - Core medical device catalog
   - Stores device information (model, name, category, manufacturer)
   - Optional fields for expiration dates, serial numbers, lot numbers
   - Barcode field for scanning integration

2. **Inventory Table** - Location-based stock levels
   - Links products to locations (home/car)
   - Quantity tracking with minimum stock level thresholds
   - Unique constraint on product-location combinations
   - Timestamps for tracking updates

3. **Hospitals Table** - Customer/facility management
   - Hospital contact information and addresses
   - Primary physician tracking
   - Notes field for additional context

4. **Implant Procedures Table** - Surgical procedure records
   - Links to hospitals
   - Patient information (optional patient ID for privacy)
   - Procedure details (type, date, device used)
   - Outcome tracking

5. **Procedure Materials Table** - Material usage tracking
   - Junction table linking procedures to products
   - Quantity used per material
   - Source location tracking (car, external, hospital stock)

6. **Stock Transfers Table** - Inventory movement audit trail
   - From/to location tracking
   - Transfer reason documentation
   - Quantity and timestamp logging

**Data Validation:**
- Zod schemas derived from Drizzle table definitions
- Client-side and server-side validation using the same schemas
- Type inference from database schema to application types

### Authentication & Authorization

Currently not implemented - the application appears to be designed for single-user or trusted environment usage. Future enhancements may add user authentication and role-based access control.

### Development Workflow

**Hot Module Replacement:**
- Vite HMR for instant frontend updates during development
- Development-only middleware for server-side errors
- Replit-specific plugins for enhanced development experience

**Type Safety:**
- Shared types between client and server via `@shared` path alias
- TypeScript strict mode enabled
- Path aliases for clean imports (`@/`, `@shared/`, `@assets/`)

**Build Process:**
- Frontend: Vite builds React application to `dist/public`
- Backend: esbuild bundles Express server to `dist/index.js`
- Production deployment uses compiled JavaScript with external packages

## External Dependencies

### Database Services
- **Neon Serverless PostgreSQL** - Cloud-hosted PostgreSQL database with serverless connection pooling
- Database URL configured via `DATABASE_URL` environment variable
- Connection via `@neondatabase/serverless` driver

### UI Component Libraries
- **Radix UI** - Headless UI primitives for accessible components (dialogs, dropdowns, popovers, etc.)
- **Shadcn/ui** - Pre-built component library following Material Design 3 principles
- **Lucide React** - Icon library for UI elements

### Form & Validation
- **React Hook Form** - Form state management with performance optimization
- **Zod** - Schema validation for both client and server
- **@hookform/resolvers** - Integration between React Hook Form and Zod

### Data Fetching & Caching
- **TanStack Query** - Server state management with intelligent caching, background refetching, and optimistic updates

### Styling
- **Tailwind CSS** - Utility-first CSS framework with custom configuration
- **class-variance-authority** - Variant-based component styling
- **clsx** & **tailwind-merge** - Conditional class name utilities

### Build Tools
- **Vite** - Frontend build tool and dev server
- **esbuild** - Backend bundling for production
- **TypeScript** - Type checking and compilation
- **PostCSS** - CSS processing with Autoprefixer

### Date Handling
- **date-fns** - Date manipulation and formatting utilities

### Routing
- **Wouter** - Lightweight client-side routing library

### Development Tools
- **@replit/vite-plugin-runtime-error-modal** - Enhanced error display during development
- **@replit/vite-plugin-cartographer** - Replit-specific development features
- **@replit/vite-plugin-dev-banner** - Development environment indicators

### Fonts
- **Google Fonts** - Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono loaded via CDN

### Barcode Scanning Implementation
The application includes real-time camera-based barcode scanning using @zxing/library:
- **Camera Selection**: Automatically prefers back/rear/environment cameras on first use
- **Camera Persistence**: Remembers user's camera choice across scan sessions (within component lifecycle)
- **Camera Switching**: Button to cycle through available cameras when multiple devices detected
- **High-Resolution Detection**: Uses 1920x1080 ideal resolution with continuous focus mode for detecting barcodes in any part of the camera frame
- **Partial Frame Detection**: Barcodes can be detected even when small in the frame, not requiring full-frame coverage
- **Camera Index Sentinel**: Initializes to -1 to force back-camera selection on first use
- **Resource Management**: Comprehensive MediaStream cleanup in all lifecycle paths (unmount, error, switch) prevents camera LED leaks