# Medical Device Inventory Management - Design Guidelines

## Design Approach
**Selected Approach:** Design System Approach using **Material Design 3**
**Justification:** This utility-focused medical application prioritizes efficiency, data clarity, and professional reliability over visual appeal. Material Design 3 provides excellent patterns for information-dense interfaces with strong accessibility support.

## Core Design Elements

### A. Color Palette
**Light Mode:**
- Primary: 220 90% 50% (Professional medical blue)
- Surface: 0 0% 98% (Clean white backgrounds)
- On-surface: 220 15% 15% (Dark text for readability)
- Error: 0 75% 55% (Clear red for alerts/low stock)
- Success: 135 60% 45% (Green for confirmations)

**Dark Mode:**
- Primary: 220 80% 70% (Lighter blue for contrast)
- Surface: 220 15% 8% (Dark background)
- On-surface: 220 10% 90% (Light text)
- Error: 0 65% 65% (Softer red)
- Success: 135 50% 55% (Softer green)

### B. Typography
**Font Family:** Inter (Google Fonts)
- Headers: Inter 600 (Semi-bold)
- Body text: Inter 400 (Regular)
- Data/numbers: Inter 500 (Medium)
- Small text: Inter 400 (Regular)

**Scale:**
- Page titles: text-2xl (24px)
- Section headers: text-xl (20px)
- Body text: text-base (16px)
- Data tables: text-sm (14px)
- Labels: text-xs (12px)

### C. Layout System
**Spacing Framework:** Tailwind units of 2, 4, 6, and 8
- Component padding: p-4
- Section spacing: mb-6 or mb-8
- Element margins: m-2 or m-4
- Container max-width: max-w-7xl

### D. Component Library

**Navigation:**
- Top navigation bar with company branding
- Secondary navigation tabs for main sections (Home Stock, Car Stock, Implants, Products, Hospitals)
- Breadcrumb navigation for deep pages

**Data Display:**
- Card-based inventory grids with clear product information
- Data tables with sorting, filtering, and search
- Status badges for stock levels (Low/Normal/High)
- Progress bars for stock quantity visualization

**Forms:**
- Clean input fields with floating labels
- Barcode scanner integration button with camera icon
- Date pickers for expiration dates
- Dropdown selectors for products and hospitals
- Multi-step forms for implant reporting

**Alerts & Notifications:**
- Toast notifications for successful actions
- Alert banners for low stock warnings
- Modal dialogs for confirmations
- Inline validation messages

**Actions:**
- Primary buttons for main actions (Add Product, Transfer Stock)
- Secondary buttons for supporting actions
- Icon buttons for quick actions (Edit, Delete, Scan)
- Floating action button for quick add functionality

### E. Key Features

**Dashboard Cards:**
- Home stock overview with low stock alerts
- Car stock summary with transfer options
- Recent implant activity
- Upcoming expiration warnings

**Inventory Management:**
- Grid and list view toggles
- Advanced search and filtering
- Batch operations for transfers
- Quick add via barcode scanning

**Mobile Optimization:**
- Bottom navigation for mobile users
- Swipe gestures for quick actions
- Camera integration for barcode scanning
- Offline capability for field use

**Professional Medical Interface:**
- High contrast ratios for all text (WCAG AA compliant)
- Clear visual hierarchy for critical information
- Consistent iconography using Material Icons
- Minimal distractions to maintain focus on data accuracy

## Images
No hero images required - this is a utility application focused on data management rather than marketing appeal. Product images may be included as small thumbnails in inventory listings for quick device identification.