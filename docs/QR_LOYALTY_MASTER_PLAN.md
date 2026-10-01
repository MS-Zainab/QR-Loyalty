# QR LOYALTY — MASTER COMPLETION PLAN, DIAGNOSTICS & DEPLOYMENT INSTRUCTIONS

**Project:** QR Loyalty Web Application  
**Target Environment:** Frontend (Vercel), Backend (Render), Database & Auth (Supabase)  
**Status:** Comprehensive Gap Closure & Production Readiness Document  

---

## 1. Executive Summary & System Status Baseline

The QR Loyalty application is a multi-tenant SaaS application connecting Platform Admins, Vendor Owners, Vendor Staff, and Customers. 

### What is Completed & Verified:
1. **Admin Management & Onboarding:** Admin dashboard (`AdminDashboard.jsx`) includes tenant onboarding modal, status lifecycle management (`ACTIVE`, `HOLD`, `REACTIVATE`, `REMOVED`), and global stats overview.
2. **Supabase Auth & Session Management:** Supabase Auth handles authentication, JWT delivery, role verification (`admin`, `vendor_owner`, `vendor_staff`, `customer`), and password recovery flows.
3. **Responsive UI Foundation:** Fluid 100% (max 1280px) responsive layout system across 320px to 4K resolutions (`index.css`).
4. **Backend REST API Architecture:** Express.js REST API with modular routing (`adminRoutes`, `ownerRoutes`, `staffRoutes`, `customerRoutes`, `loyaltyRoutes`, `verificationRoutes`, `qrRoutes`).

---

## 2. Root Cause Analysis & Detailed Fix Specifications

Below is the technical diagnostic report for all issues identified during testing, along with the precise fixes.

### Issue 1: Loyalty Program Created but Not Displayed or Editable on Owner Dashboard
* **Root Cause:** Backend `loyaltyRoutes.js` (GET `/api/loyalty`) returns response JSON in the format `{ success: true, program: { ... } }`. However, `OwnerDashboard.jsx` expected `response.data?.loyalty`. Because `response.data.loyalty` was `undefined`, `response.data` fell back to the outer object `{ success: true, program: ... }`, causing `loyalty.name` and `loyalty.id` lookups to evaluate to `undefined`.
* **Fix Specification:**
  1. In `backend/src/routes/loyaltyRoutes.js`, standardize the response to include both keys: `{ success: true, loyalty: program, program }`.
  2. In `frontend/src/pages/owner/OwnerDashboard.jsx`, update `loadLoyalty` to check `response.data?.program || response.data?.loyalty || null`.
  3. Ensure the Edit & Activate/Deactivate actions reload both `loadLoyalty()` and `loadDashboard()`.

---

### Issue 2 & 3: Staff Onboarding Missing `staff` Table Record & Staff Dashboard "Record Not Found"
* **Root Cause:** In `backend/src/routes/tenantRoutes.js` (and `ownerRoutes.js`), the staff onboarding endpoint (`POST /api/tenants/:id/staff`) inserted a user into Supabase Auth and created a profile in the `profiles` table (`role = 'vendor_staff'`). However, it **omitted inserting a corresponding record into the `staff` table**.
  * When Owner Dashboard called `GET /api/owner/staff`, it queried `supabaseAdmin.from('staff')`. Because `staff` rows were missing, only staff with existing rows appeared, or older records failed to link.
  * When Staff logged into `StaffDashboard.jsx`, the backend endpoint `GET /api/staff/me` looked up `supabaseAdmin.from('staff').eq('profile_id', profile.id)`. Finding no row, it returned `404 Staff record not found`, blocking PIN generation.
* **Fix Specification:**
  1. In `tenantRoutes.js` and `ownerRoutes.js`, update staff creation logic to perform a dual insert:
     * Insert into `profiles` (`auth_user_id`, `tenant_id`, `full_name`, `role: 'vendor_staff'`, `status: 'active'`).
     * Insert into `staff` (`tenant_id`, `profile_id`, `is_active: true`).
  2. In `GET /api/staff/me`, add auto-repair capability: if a user has `role === 'vendor_staff'` in `profiles` but lacks a row in `staff`, automatically create the missing `staff` record on the fly.
  3. In `OwnerDashboard.jsx`, update staff list rendering to display all onboarded staff members, active/inactive toggles, staff password resets, and individual daily customer visit counts.

---

### Issue 4: Owner Dashboard Reports vs. Admin Monthly Reports Ownership
* **User Question:** *"reports section abhi owner k paas bhi ha usko mein delete krna chahouni ya rakhein ?"*
* **Architectural Decision (Final Business Rule):**
  * **Monthly Tenant Report Generation & Download IS ADMIN-ONLY.**
  * Owner Dashboard should **NOT** have official CSV/PDF report download buttons.
  * Owner Dashboard retains **Owner Analytics** (visual graphs, visit totals, active customer counts, daily trends, repeat customer breakdown for their own tenant).
  * Platform Admin Dashboard contains the **Official Monthly Reports Module** with tenant picker, month picker, summary preview, CSV download, and PDF download options.

---

### Issue 5: Customer Simplified Authentication (Name + Phone Number)
* **Requirement:** Allow customers to log in seamlessly using just their **Full Name** and **Phone Number**. Automatically register new customers or authenticate existing ones, saving unique customer records and maintaining customer history per tenant for Admin reporting.
* **Fix Specification:**
  1. Update `Login.jsx` to include a "Customer Quick Login" tab (Name + Phone Number).
  2. Backend `POST /api/auth/customer-login` endpoint:
     * Accepts `{ full_name, phone_number }`.
     * Formats phone number to E.164 standard.
     * Checks if customer profile exists in `profiles` matching `phone_number` and `role = 'customer'`.
     * If not found, creates Supabase Auth user and customer profile automatically.
     * Generates and returns JWT access token for customer session.
  3. Admin Dashboard Customer Directory displays all unique registered customers, total visits across tenants, lifetime stamps, and registration date.

---

### Issue 6: Customer Camera QR Scanner Integration
* **Requirement:** Add browser camera QR scanning on customer side so customers can scan shop QR codes directly using their phone camera, in addition to manual QR text input and direct URL parameters (`/customer/verify?qr_code=...`).
* **Fix Specification:**
  1. Add prominent `📷 Scan Shop QR Code` card & action button on `CustomerDashboard.jsx` navigating to `/customer/verify`.
  2. In `VerifyVisit.jsx`, integrate browser camera QR scanner utilizing `navigator.mediaDevices.getUserMedia` with barcode detector canvas or `html5-qrcode` library fallback.
  3. Ensure Camera scan, Manual input, and Direct URL parameters all converge seamlessly to `POST /api/verification/verify`.

---

### Issue 7: Subscription & Purchase Phase for Vendor Owners
* **Requirement:** Add a subscription/plan model allowing Vendor Owners to purchase or subscribe to plans (Trial vs. Paid Version), view active package details, and view subscription status. Admin Dashboard monitors tenant subscription history and package activation status.
* **Fix Specification:**
  1. Create `subscriptions` table schema:
     ```sql
     CREATE TABLE IF NOT EXISTS subscriptions (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
       plan_type VARCHAR(50) DEFAULT 'trial', -- 'trial', 'basic', 'pro', 'enterprise'
       status VARCHAR(50) DEFAULT 'active', -- 'active', 'trialing', 'expired', 'canceled'
       billing_cycle VARCHAR(20) DEFAULT 'monthly',
       amount_paid DECIMAL(10, 2) DEFAULT 0.00,
       trial_ends_at TIMESTAMPTZ,
       current_period_end TIMESTAMPTZ,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW()
     );
     ```
  2. Owner Dashboard: Add **Subscription & Billing** tab displaying:
     * Current Plan Badge (Trial / Active Paid / Expired)
     * Days remaining in trial/subscription
     * Feature limits and plan details
     * Upgrade / Subscribe modal options
  3. Admin Dashboard: Add **Subscription Management** tab displaying:
     * Global summary (Total Paid Tenants, Active Trials, Expired Subscriptions)
     * Tenant subscription table with manual plan activation/extension override controls.

---

## 3. Execution Phases

### Phase 1: Data Contract & Staff Fixes
1. Standardize GET `/api/loyalty` response to return `{ success: true, loyalty: program, program }`.
2. Update `tenantRoutes.js` and `ownerRoutes.js` staff creation to insert into both `profiles` and `staff` tables.
3. Add auto-creation repair inside GET `/api/staff/me`.
4. Verify Owner Dashboard staff list and loyalty program card render data correctly.

### Phase 2: Customer Simplified Auth & Camera QR Scanner
1. Implement `POST /api/auth/customer-login` (Name + Phone Number).
2. Update `Login.jsx` to support customer Name + Phone login tab.
3. Enhance `VerifyVisit.jsx` with camera scanner integration and add launch button in `CustomerDashboard.jsx`.

### Phase 3: Subscription & Billing Module
1. Execute database migration for `subscriptions` table.
2. Implement backend routes `ownerRoutes.js` (`/api/owner/subscription`) and `adminRoutes.js` (`/api/admin/subscriptions`).
3. Add Subscription & Plan UI tab in `OwnerDashboard.jsx`.
4. Add Tenant Subscriptions tab in `AdminDashboard.jsx`.

### Phase 4: Admin Monthly Reports & Strict Scoping
1. Ensure CSV and PDF report generation endpoints on `/api/admin/reports/monthly` require `role === 'admin'`.
2. Verify Admin Dashboard Monthly Report UI with tenant selector, month picker, live preview, CSV download, and PDF download.
3. Remove official report download buttons from Owner Dashboard (retain visual Analytics).

### Phase 5: Production Deployment (Vercel + Render + Supabase)
1. Deploy Backend to Render with environment variables: `PORT`, `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `JWT_SECRET`, `FRONTEND_URL`.
2. Configure Production CORS in `server.js` to strictly match the production Vercel domain.
3. Deploy Frontend to Vercel with environment variables: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Execute Production Smoke Test across all 4 roles (Admin, Owner, Staff, Customer).

---

## 4. Master Execution Prompt

When ready to initiate the final execution, use the following prompt:

```text
Run the final QR Loyalty gap-closure, bug fixes, and feature additions based on docs/QR_LOYALTY_MASTER_PLAN.md:

1. Fix GET /api/loyalty response contract to return { success: true, loyalty: program, program } and update OwnerDashboard.jsx loadLoyalty().
2. Fix staff onboarding in tenantRoutes.js/ownerRoutes.js to insert rows into BOTH profiles and staff tables. Add auto-repair to GET /api/staff/me.
3. Add Customer Name + Phone Number login in authRoutes.js and Login.jsx, saving unique customer records.
4. Integrate browser camera QR scanner in VerifyVisit.jsx and add prominent Scan QR button on CustomerDashboard.jsx.
5. Implement Subscription & Billing module (subscriptions schema, GET/POST owner subscription routes, Admin subscription management tab, Owner subscription UI tab).
6. Restrict official downloadable Monthly Reports (CSV/PDF) strictly to AdminDashboard.jsx and backend requireRole('admin').
7. Build, test, and prepare production deployment configs for Vercel and Render.
```
