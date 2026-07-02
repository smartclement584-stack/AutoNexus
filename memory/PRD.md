# AutoNexus - PRD (Product Requirements Document)

## Original Problem Statement
Build AutoNexus - a digital automotive spare parts marketplace for Camp Yabassi, Cameroon. The platform connects car owners, mechanics, and spare parts sellers, allowing users to search parts, compare prices, and contact sellers via WhatsApp.

## Architecture & Tech Stack
- **Frontend**: React 19 + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI (Python) with MongoDB
- **Authentication**: Phone OTP (mock implementation for demo)
- **Design**: Mobile-first, dark green (#1a5c38) theme

## User Personas
1. **Car Owners**: Search parts, compare prices, contact sellers
2. **Mechanics**: Post part requests, find specific parts quickly
3. **Spare Parts Sellers**: Manage inventory, respond to requests

## Core Requirements (Static)
- Spare parts search with filters (brand, model, year, category)
- Price comparison across sellers
- WhatsApp integration for seller contact
- Seller profiles with ratings and verification
- Part requests by mechanics
- Seller dashboard for inventory management
- Phone OTP authentication (+237 Cameroon format)
- Prices in FCFA currency

## What's Been Implemented (March 12, 2026)

### Backend APIs
- [x] Auth: /api/auth/send-otp, /api/auth/verify-otp, /api/auth/me
- [x] Parts: /api/parts (search with filters), /api/parts/:id
- [x] Sellers: /api/sellers, /api/sellers/:id
- [x] Requests: /api/requests (CRUD)
- [x] Seller Dashboard: /api/seller/register, /api/seller/parts
- [x] Filters: /api/filters/brands, /api/filters/models, /api/filters/years, /api/filters/categories

### Frontend Pages (7 total)
- [x] Homepage with hero, search bar, feature icons, featured parts
- [x] Search Results with filters and product grid
- [x] Product Page with price comparison table
- [x] Seller Profile Page
- [x] Sellers List Page
- [x] Part Requests Page
- [x] Create Request Page
- [x] Seller Dashboard
- [x] Login Page with OTP flow

### Features
- [x] Mobile-first responsive design
- [x] Bottom navigation on mobile
- [x] WhatsApp pre-filled messages
- [x] Price comparison table
- [x] Stock status badges
- [x] Seller verification badges
- [x] Demo OTP mode (shows code for testing)

### Sample Data
- 5 sellers from Camp Yabassi
- 15 spare parts (filters, brakes, suspension, engine parts)
- Vehicle brands: Toyota, Nissan, Mitsubishi, Suzuki, Mazda, Hyundai, Kia, Daewoo

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Core search functionality
- [x] Product listing and details
- [x] Seller profiles
- [x] WhatsApp integration
- [x] Authentication

### P1 (Important) - Future
- [ ] Real SMS OTP integration (Twilio)
- [ ] Image upload for parts
- [ ] Seller response to part requests
- [ ] User profile management

### P2 (Nice to Have) - Future
- [ ] Push notifications
- [ ] Favorites/saved parts
- [ ] Search history
- [ ] Part request notifications for sellers

## Next Tasks
1. Integrate real Twilio SMS for OTP
2. Add image upload functionality for seller parts
3. Implement seller response flow for part requests
4. Add user favorites/saved parts feature
5. Analytics dashboard for sellers
