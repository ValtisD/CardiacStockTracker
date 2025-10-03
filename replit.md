# Medical Device Inventory Management System

## Overview

This full-stack application tracks medical devices, leads, and materials for cardiac rhythm management (CRM) field engineers. It manages inventory across home and car stock locations, handles hospital/customer relationships, and records implant procedures with material usage. Key features include barcode scanning, low stock alerts, inventory transfers, and comprehensive reporting. The system aims to streamline inventory management and procedure tracking for field engineers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React 18 SPA with TypeScript, built using Vite. It utilizes Shadcn/ui (built on Radix UI) for components, following Material Design 3 principles with Tailwind CSS, and supports responsive design and dark mode. State management is handled by TanStack Query for server state and React Hook Form with Zod for form validation. Client-side routing is managed by Wouter.

**Key Features**:
- Dashboard overview
- Separate inventory views (home/car)
- Product and hospital management
- Implant procedure reporting
- Stock transfer functionality
- Global search
- Low stock alerts
- PDF exports for expiring products and stock reports
- Barcode scanning with GS1 parsing for product lookup and auto-filling inventory details (serial, lot, expiration). It supports real-time camera-based scanning and manual GTIN entry, with comprehensive error handling and duplicate serial prevention.
- PDF Export for Expiring Products Report, Car Stock Report, and Home Stock Reorder Report (with automatic German email text copy to clipboard).

### Backend

The backend is an Express.js server providing a RESTful API. It uses a middleware-based request/response pipeline and custom error handling. The data access layer uses a repository pattern with Drizzle ORM for type-safe PostgreSQL queries and transaction support.

### Database

PostgreSQL (Neon serverless) is the primary database, using Drizzle ORM for schema management and migrations. The schema includes:
- **Products**: Stores device catalog information (model, name, GTIN, manufacturer, barcode).
- **Inventory**: Tracks location-based stock levels, quantities, and minimum thresholds.
- **Hospitals**: Manages customer details.
- **Implant Procedures**: Records surgical procedure details.
- **Procedure Materials**: Tracks material usage for procedures.
- **Stock Transfers**: Logs inventory movements.
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