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
- PDF export for expiring products report
- PDF export for low stock reorder report

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
   - GTIN field for Global Trade Item Number (extracted from GS1 barcodes)
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

### Add Inventory Dialog Implementation
The application provides a comprehensive Add to Stock dialog (`AddInventoryDialog.tsx`) for adding new inventory items with dual input methods:

**Product Lookup Methods**:
- **Barcode Scanner**: Real-time camera-based scanning with GS1 parsing for quick product identification
- **Manual GTIN Entry**: Fallback input field for manual GTIN lookup when camera is unavailable or preferred
- **Product Search**: Both methods query the same `/api/products?gtin={gtin}` endpoint for consistent product lookup
- **Error Handling**: Clear toast notifications for empty input, fetch failures, and not-found scenarios

**Per-Item Tracking**:
- **Tracking Mode Selection**: Serial-tracked (quantity fixed to 1) or lot-tracked (configurable quantity)
- **Serial Number Tracking**: Required field for serial-tracked items with unique device identification
- **Lot Number Tracking**: Required field for lot-tracked items with batch identification
- **Expiration Date**: Optional date field with timezone-safe parsing to prevent date shifts across locales
- **Auto-Population**: GS1 barcode data automatically fills serial/lot/expiration fields when available
- **Form Validation**: React Hook Form with Zod validation ensures data integrity before submission

**Date Handling**:
- **Timezone-Safe Parsing**: Custom `parseDateString` function converts YYYY-MM-DD strings to Date objects without timezone shifts
- **Local Date Preservation**: Uses `new Date(year, month-1, day)` instead of `new Date(string)` to prevent UTC conversion issues
- **Display Formatting**: Calendar component correctly displays selected dates regardless of user timezone
- **String Storage**: Form stores dates as YYYY-MM-DD strings for database consistency while displaying as formatted dates to users

### Barcode Scanning Implementation
The application includes real-time camera-based barcode scanning using @zxing/library with GS1 barcode parsing:

**Camera Features**:
- **Multi-language Camera Detection**: Detects back cameras in multiple languages (English "back/rear/environment", German "rück", Spanish "trasera", French "arrière")
- **Smart Camera Selection**: On first use, automatically finds back camera by label; falls back to last camera (typically back on mobile) if label detection fails; handles single-camera devices gracefully
- **Camera Persistence**: Remembers user's camera choice across scan sessions (within component lifecycle)
- **Reliable Camera Switching**: Async/await pattern with 500ms cleanup delay ensures proper camera resource release before switching
- **High-Resolution Detection**: Uses 1920x1080 ideal resolution with continuous focus mode for detecting barcodes in any part of the camera frame
- **Partial Frame Detection**: Barcodes can be detected even when small in the frame, not requiring full-frame coverage
- **Optimized Scan Timing**: 300ms interval between scans for optimal balance of speed, reliability, and battery life
- **Duplicate Prevention**: 2-second cooldown prevents repeated processing of same barcode
- **Single-Detection Guarantee**: isScanningActiveRef flag prevents queued callbacks from executing after camera stops
- **Resource Management**: Comprehensive MediaStream cleanup in all lifecycle paths (unmount, error, switch) prevents camera LED leaks

**GS1 Barcode Parsing** (`client/src/lib/gs1Parser.ts`):
- **Automatic Detection**: Recognizes GS1-compliant barcodes by Application Identifier prefix
- **Field Extraction**: Parses (01) GTIN/item number, (17) expiration date, (21) serial number, (10) lot/batch number
- **Smart Product Lookup**: Uses GTIN for database search instead of full barcode string for more accurate matching
- **Separate GTIN Storage**: GTIN is saved to dedicated `gtin` field, NOT in `modelNumber` field
- **Date Conversion**: Converts GS1 YYMMDD format to YYYY-MM-DD (handles century with YY < 50 = 20xx, else 19xx)
- **Variable-Length Support**: Correctly handles both fixed-length (GTIN, exp date) and variable-length (serial, lot) fields
- **Auto-Population**: Automatically fills inventory form fields (serial number, lot number, expiration date) from scanned GS1 data
- **State Management**: Clears GS1 data when non-GS1 barcodes are scanned to prevent stale data issues
- **User Feedback**: Displays extracted GS1 data in dedicated card with formatted Application Identifier labels

### PDF Export Implementation
The application provides professional PDF reports using jsPDF and jspdf-autotable libraries:

**Expiring Products Report**:
- Accessible from Dashboard's "Expiring Soon" dialog via "Export PDF" button
- Reports products expiring within the next 90 days from both home and car inventory
- Includes: Product name, Model number, GTIN, Location, Quantity, Expiration date, Days until expiration
- Formatted with striped table theme and blue header styling
- Filename format: `expiring-products-YYYY-MM-DD.pdf`

**Car Stock Report**:
- Quick Action button on Dashboard for car stock transfer planning
- Reports car stock items below minimum levels
- Includes: Product name, Model number, GTIN, Current quantity, Minimum stock level, Transfer quantity needed
- Formatted with striped table theme and blue header styling
- Filename format: `car-stock-report-YYYY-MM-DD.pdf`
- Button is disabled when no car stock low items exist
- Useful for planning inventory transfers from home to car stock

**Home Stock Reorder Report**:
- Quick Action button on Dashboard for supplier reordering
- Reports home stock items below minimum levels
- Includes: Product name, Model number, GTIN, Current quantity, Minimum stock level, Reorder quantity needed
- Formatted with striped table theme and red header styling (alerts)
- Filename format: `home-stock-report-YYYY-MM-DD.pdf`
- Button is disabled when no home stock low items exist
- **Automatically copies German email text to clipboard** with format:
  ```
  Guten Tag,
  
  bitte folgendes Material für mein Konsilager nachbestellen:
  
  [Model Number] - [Quantity] Stück
  
  Mit freundlichen Grüßen,
  ```
- Shows toast notification when email text is successfully copied
- Useful for creating supplier reorder emails and inventory management workflows