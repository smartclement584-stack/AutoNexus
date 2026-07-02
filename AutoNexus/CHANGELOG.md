# AutoNexus — Fixes & New Features

## 🐛 Bugs Fixed

1. **OTP never reached the user** — backend now returns `demo_otp` in the response when Twilio isn't configured, and the login page displays it in an amber "Demo Mode" banner (tap to auto-fill). When Twilio *is* configured, real SMS is sent instead.
2. **Price range filter (`min_price`)** — fixed `min_price=0` being silently dropped (was checked with `if min_price:` which treats 0 as falsy); now uses `is not None`.
3. **"Sort by rating" did nothing** — parts don't store a seller rating, so this silently fell through. Now falls back to price-ascending until a proper join-based rating sort is built.
4. **CORS origins with spaces** — `CORS_ORIGINS=a.com, b.com` now strips whitespace per origin instead of breaking the match.
5. **CORS middleware registration order** — moved to immediately after `app = FastAPI(...)` instead of the bottom of the file.
6. **Dashboard infinite-reload risk** — `getAuthHeader` is now wrapped in `useCallback` in `AuthContext`, so it's a stable reference and won't re-trigger `useEffect` on every render.
7. **Mobile filter sheet model dropdown stuck empty** — added a separate effect that watches `localFilters.brand` (mobile state) instead of only the URL `brand` param.
8. **Stock status mislabeled** — `stock <= 5` was showing "Low Stock" even at 0. Now: `0 = Out of Stock`, `1–5 = Low Stock`, `6–20 = Limited Stock`, `21+ = In Stock`. Applied consistently on both the homepage card and product page.
9. **Post-login redirect lost destination** — `RequestsPage` and `DashboardPage` now pass `{ state: { from: { pathname } } }` to `/login`, and `LoginPage` reads it back to redirect correctly after verification.

## ✨ New Features

### 1. Real SMS OTP (Twilio)
- Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in `backend/.env` to enable real SMS.
- Falls back gracefully to demo mode (on-screen OTP) if not configured — so the app always works, with or without Twilio.

### 2. Image Uploads for Parts
- New `POST /api/upload/image` endpoint (JPEG/PNG/WebP, 5MB limit).
- Seller dashboard "Add Part" form has a drag/click upload zone plus a manual URL fallback.
- Images served from `/uploads/<filename>`.

### 3. Seller Response Flow on Part Requests
- New `POST /api/requests/{id}/respond` — sellers submit price, condition, availability, and a message.
- Buyer's `RequestsPage` shows an expandable list of all seller responses with a direct WhatsApp deep link per seller.
- Optional WhatsApp notification to the requester via Twilio when a seller responds (set `TWILIO_WHATSAPP_NUMBER`).

### 4. User Favorites / Saved Parts
- `GET/POST/DELETE /api/favorites` endpoints, backed by a `favorites` array on the user document.
- Heart icon on `ProductPage` toggles save state instantly (optimistic update via `AuthContext.toggleFavorite`).

### 5. AI Diagnostic Assistant (new flagship feature)
- New `/diagnostic` page: user describes a problem (+ optional vehicle brand/model/year), AI (Claude Haiku via Anthropic API) returns a diagnosis, ranked list of likely faulty parts with urgency and estimated price, and next-step advice.
- Each suggested part has a "Find on AutoNexus" button that jumps straight into a pre-filled search.
- Requires `ANTHROPIC_API_KEY` in `backend/.env`. Returns a friendly 503 message if not configured.
- Linked from the main nav (desktop + mobile bottom bar) and a hero CTA banner on the homepage.

## ⚠️ Push Notifications — Not Yet Implemented
This requires a service worker + push subscription infrastructure (web push or a mobile app shell) that's a bigger lift than the others. Recommend tackling this after the mechanic booking feature, once you have a stronger signal on engagement patterns to prioritize *which* events should trigger a push (new response, price drop, request match, etc).

## Setup Notes
- Add `ANTHROPIC_API_KEY` to `backend/.env` to enable the AI Diagnostic Assistant.
- Add Twilio credentials to enable real SMS OTP and WhatsApp notifications — otherwise the app runs fully functional in demo mode.
- `requirements.txt` now includes `httpx` (for the diagnostic API call).
