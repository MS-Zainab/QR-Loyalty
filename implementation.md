# QR LOYALTY — MASTER CODEX PROJECT CONTEXT

You are continuing an existing project called **QR Loyalty**.

Your job is to continue implementation from the current state described below. **Do not restart the project, redesign the architecture, re-audit finalized backend policies, or rewrite working files unnecessarily.**

The user is a beginner/intermediate developer and wants exact, practical, step-by-step execution.

---

# 1. PROJECT OVERVIEW

Project name:

**QR Loyalty**

Purpose:

A multi-tenant QR-based loyalty SaaS for businesses such as cafes, restaurants, salons, shops, etc.

Core concept:

* Each business is a separate tenant.
* Each business has its own customers, staff, loyalty rules, rewards, stamps, visits, and data.
* Each business has one permanent physical QR code.
* Customer scans the business QR.
* Staff generates a temporary 6-digit verification PIN.
* PIN is valid for 60 seconds.
* Customer enters the PIN.
* Backend verifies the customer + QR + PIN.
* Visit is recorded.
* Staff can issue the loyalty stamp.
* Customer sees their own loyalty progress/history.
* Owner manages business loyalty program, staff, rewards, and QR.
* Admin manages the platform and vendors.

---

# 2. IMPORTANT DEVELOPMENT RULE

The following backend architecture and business rules have already been finalized.

DO NOT:

* re-audit them
* redesign them
* remove policies
* replace them with another approach
* introduce new roles
* change tenant isolation
* change authentication architecture
* change database architecture
* change finalized API behavior

ONLY change backend code if a concrete, reproducible bug is found.

The priority now is:

1. Finish frontend functionality.
2. End-to-end test.
3. Security/access testing.
4. One final UI/UX styling pass.
5. Production deployment preparation.
6. Final QA.

The user specifically wants to avoid repeatedly changing already-finalized decisions.

---

# 3. TECH STACK

Frontend:

* React
* Vite
* React Router
* Axios
* Supabase Auth
* JavaScript / JSX

Backend:

* Node.js
* Express
* Supabase
* PostgreSQL

Database/Auth:

* Supabase

Development:

* VS Code
* Git
* GitHub
* Postman

Deployment planned:

* Frontend → Vercel
* Backend → Render
* Database/Auth → Supabase

Local project path:

```text
D:\HTML Projects\QR Loyalty
```

Frontend:

```text
D:\HTML Projects\QR Loyalty\frontend
```

Backend:

```text
D:\HTML Projects\QR Loyalty\backend
```

GitHub repository:

```text
https://github.com/MS-Zainab/QR-Loyalty.git
```

---

# 4. CURRENT PROJECT STRUCTURE

Root:

```text
QR Loyalty/
├── backend/
├── frontend/
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

Frontend:

```text
frontend/
└── src/
    ├── App.css
    ├── App.jsx
    ├── assets/
    ├── components/
    ├── context/
    ├── index.css
    ├── layouts/
    ├── main.jsx
    ├── pages/
    ├── routes/
    └── services/
```

Important frontend pages:

```text
src/pages/Login.jsx

src/pages/admin/AdminDashboard.jsx

src/pages/owner/OwnerDashboard.jsx

src/pages/staff/StaffDashboard.jsx

src/pages/customer/CustomerDashboard.jsx

src/pages/customer/VerifyVisit.jsx
```

Authentication:

```text
src/context/AuthContext.jsx
```

Protected routing:

```text
src/routes/ProtectedRoute.jsx
```

API service:

```text
src/services/api.js
```

---

# 5. USER ROLES

Exactly four roles exist:

```text
admin
vendor_owner
vendor_staff
customer
```

## Admin

Admin manages the platform.

Admin can:

* view platform overview
* view vendors
* create/manage vendors through backend
* change vendor status
* view reports
* export reports

Admin does NOT manage customer loyalty operations directly.

Admin does NOT need a QR section in the dashboard.

---

## Vendor Owner

Owner manages one business/tenant.

Owner can:

* view business dashboard
* manage loyalty program
* manage staff
* view staff activity
* manage rewards
* create/view permanent QR
* download QR
* view business/customer/stamp/reward metrics

Owner cannot access another tenant's data.

---

## Vendor Staff

Staff is operational.

Staff can:

* generate temporary 6-digit verification PIN
* view current PIN
* view expiry
* verify/handle visits
* issue stamps
* redeem rewards
* view operational activity

Staff cannot:

* change loyalty rules
* edit business configuration
* manage the tenant
* manage rewards configuration
* download reports

---

## Customer

Customer can:

* view own loyalty dashboard
* view own stamp history
* view own redemption history
* view available rewards
* verify a visit
* receive loyalty stamps through the business process

Customer cannot:

* see another customer's data
* access staff dashboard
* access owner dashboard
* access admin dashboard
* access `/qr` owner/staff endpoint
* manage loyalty rules

---

# 6. VENDOR STATUS LIFECYCLE

Finalized statuses:

```text
active
hold
removed
```

Meaning:

### active

Normal operation.

### hold

Business is blocked temporarily.

Data is retained.

Can be reactivated.

### removed

Business is deactivated/archived according to retention policy.

Do not immediately hard-delete historical data.

---

# 7. QR DESIGN — FINAL

There is ONE permanent active QR per tenant.

The QR itself contains a customer verification URL.

Current tested QR code identifier:

```text
4d70ca1b3a60e45cd1f5d09c5e0c34d6
```

Current local verification URL:

```text
http://localhost:5173/customer/verify?qr_code=4d70ca1b3a60e45cd1f5d09c5e0c34d6
```

Important:

The database field is:

```text
qr_codes.code
```

NOT:

```text
qr
qr_token
qr_code_url
```

The QR backend returns:

```js
{
  success: true,
  qr_code: qrCode
}
```

The actual identifier is:

```js
qr_code.code
```

---

# 8. CUSTOMER VERIFICATION FLOW — FINAL

Final intended flow:

```text
Staff generates 6-digit PIN
        ↓
PIN valid for 60 seconds
        ↓
Customer scans permanent business QR
        ↓
Customer opens:
/customer/verify?qr_code=<code>
        ↓
Customer enters staff PIN
        ↓
POST /verification/verify
        ↓
Backend validates:
- authenticated customer
- QR
- active QR
- tenant
- valid unused PIN
- PIN expiry
- customer
        ↓
Visit recorded
        ↓
Stamp process continues
        ↓
Customer dashboard updates
```

IMPORTANT:

Customer must NOT call:

```text
GET /qr
```

The `/qr` endpoint is for:

```text
vendor_owner
vendor_staff
```

only.

Customer gets the QR code from the URL generated by/scanned from the physical QR.

---

# 9. FINAL VERIFICATION API

Frontend must send:

```js
api.post(
  '/verification/verify',
  {
    qr_code: qrCode,
    pin: pin.trim()
  },
  getConfig()
)
```

NOT:

```js
{
  qr_token: ...
}
```

NOT:

```text
/api/verification/verify
```

Because the Axios base URL already ends in `/api`.

---

# 10. API PATH RULE — VERY IMPORTANT

`frontend/src/services/api.js` already has a base URL ending in:

```text
/api
```

Therefore frontend calls must be:

```js
api.get('/admin/dashboard')
api.get('/owner/dashboard')
api.get('/staff/activity')
api.post('/verification/generate')
api.post('/verification/verify')
```

NOT:

```js
api.get('/api/admin/dashboard')
api.get('/api/owner/dashboard')
api.get('/api/staff/activity')
api.post('/api/verification/generate')
```

Otherwise requests become:

```text
/api/api/...
```

which is wrong.

---

# 11. BACKEND ROUTES — FINALIZED

There are 11 main route files.

## 1. auth.js

```text
POST /login
GET /me
```

Uses:

```text
requireAuth
requireRole
```

---

## 2. customers.js

Includes:

```text
customer registration
/customers/me
/customers/me/stamps
/customers/me/redemptions
/customers/me/rewards
```

Customer progress calculation is already correct.

It calculates lifetime stamps minus consumed stamps from redeemed rewards.

---

## 3. admin.js

Routes:

```text
GET /admin/dashboard
GET /admin/vendors
GET /admin/reports
GET /admin/reports/export
```

---

## 4. loyalty.js

Routes:

```text
GET /loyalty
POST /loyalty
PATCH /loyalty/:id
```

Owner manages loyalty program.

---

## 5. owner.js

Routes:

```text
GET /owner/dashboard
GET /owner/staff
PATCH /owner/staff/:id/status
```

Owner dashboard includes:

* tenant
* active loyalty program
* active customers
* total stamps
* total rewards
* active rewards
* total redemptions
* active staff
* staff activity

Staff activity currently represents all-time activity.

DO NOT change it to daily unless explicitly required.

---

## 6. qr.js

Routes:

```text
GET /qr
POST /qr
```

GET is for:

```text
vendor_owner
vendor_staff
```

POST is for:

```text
vendor_owner
```

Permanent QR is created using a random code.

Example:

```js
crypto.randomBytes(16).toString('hex')
```

---

## 7. rewards.js

Routes:

```text
GET /rewards
POST /rewards
POST /rewards/:id/redeem
PATCH /rewards/:id
```

Reward redemption logic has already been tested.

---

## 8. staff.js

Routes:

```text
GET /staff/activity
GET /staff/verified-visits
```

---

## 9. stamps.js

Route:

```text
POST /stamps
```

Only active vendor staff can issue stamps.

Tenant/customer/visit validation exists.

Duplicate stamp for the same visit is prevented.

---

## 10. tenants.js

Routes:

```text
POST /tenants
GET /tenants
PATCH /tenants/:id/status
POST /tenants/:id/owner
POST /tenants/:id/staff
```

Admin can manage vendors.

Vendor owner can create staff only inside own tenant.

---

## 11. verification.js

Routes:

```text
POST /verification/generate
POST /verification/verify
```

Generate:

* active staff only
* random 6-digit PIN
* valid 60 seconds
* invalidates previous active PINs for tenant

Verify expects:

```js
{
  qr_code,
  pin
}
```

Successful response:

```js
{
  success: true,
  message: 'Customer verified successfully',
  verification: {
    tenant_id,
    customer_id,
    staff_id,
    visit_id,
    visited_at
  }
}
```

---

# 12. AUTHENTICATION

`AuthContext.jsx` is already implemented.

It:

* gets Supabase session
* loads profile through `/auth/me`
* exposes:

  * session
  * profile
  * loading
  * login
  * logout
  * isAuthenticated

Do not rewrite it unless there is a concrete bug.

---

# 13. PROTECTED ROUTES

Current routes:

```text
/admin
/owner
/staff
/customer
/customer/verify
```

Protected according to role.

Current role redirects:

```text
admin → /admin
vendor_owner → /owner
vendor_staff → /staff
customer → /customer
```

---

# 14. FRONTEND STATUS — ALREADY DONE

## Admin Dashboard

File:

```text
src/pages/admin/AdminDashboard.jsx
```

Status:

DONE.

It successfully loads.

Current example:

```text
Platform Overview

Total Vendors: 2
Active Vendors: 0
Vendors on Hold: 0
Removed Vendors: 0
Total Customers: 0
Total Stamps: 0
Total Rewards: 0
Total Redemptions: 0
```

The earlier React error involving an object being rendered directly has already been fixed.

Do NOT rewrite Admin Dashboard unnecessarily.

Also:

Admin does NOT need a QR section.

---

# 15. OWNER DASHBOARD STATUS

File:

```text
src/pages/owner/OwnerDashboard.jsx
```

Main functionality exists.

Sections include:

* overview
* loyalty
* staff
* rewards
* QR

QR integration was fixed.

The frontend uses the `qrcode` npm package.

Installation command:

```bash
cd "D:\HTML Projects\QR Loyalty\frontend"
npm install qrcode
```

QR generation uses the business QR code identifier:

```js
const verificationUrl =
  `${window.location.origin}/customer/verify?qr_code=${encodeURIComponent(qrRecord.code)}`;
```

Then generates a data URL using:

```js
QRCode.toDataURL(...)
```

Owner QR section currently successfully displays:

```text
Business QR Code

This is your permanent business QR code.

QR Code Identifier
4d70ca1b3a60e45cd1f5d09c5e0c34d6

Customer Verification URL
http://localhost:5173/customer/verify?qr_code=4d70ca1b3a60e45cd1f5d09c5e0c34d6

Download QR Code
```

Therefore QR generation is already working.

---

# 16. STAFF DASHBOARD STATUS

File:

```text
src/pages/staff/StaffDashboard.jsx
```

Status:

DONE AND TESTED.

It successfully:

* loads staff profile
* generates verification PIN
* displays PIN
* displays expiry
* displays staff activity
* displays verified visits
* refreshes dashboard
* handles errors

Tested output example:

```text
Staff Dashboard

Welcome, Loyalty Demo Staff

Verification PIN generated successfully.
It is valid for 60 seconds.

Customer Verification PIN

Current PIN
687162

Expires:
26/09/2026, 23:36:24

Staff Activity

Stamps Issued: 0
Rewards Redeemed: 0
Verified Visits: 0
```

Do not rewrite this file unless a concrete bug appears.

---

# 17. CUSTOMER DASHBOARD STATUS

File:

```text
src/pages/customer/CustomerDashboard.jsx
```

Status:

DONE AND TESTED.

It successfully calls:

```js
api.get('/customers/me')
api.get('/customers/me/stamps')
api.get('/customers/me/redemptions')
api.get('/customers/me/rewards')
```

It displays:

* customer welcome
* loyalty card
* stamps collected
* remaining stamps
* rewards redeemed
* progress percentage
* available rewards
* recent stamp history
* redemption history
* Verify Visit button
* logout
* refresh
* loading/error states

Example successful test:

```text
Customer Dashboard

Welcome, Test Customer

Stamps Collected
0 / 10

Remaining
10

Rewards Redeemed
0

Progress
0%

Available Rewards
Free Coffee

Requires 10 stamps

Recent Stamp History
No stamp history yet.

Redemption History
No redemption history yet.
```

This is correct for the currently logged-in test customer.

Do not assume empty history is a bug.

---

# 18. VERIFY VISIT — CURRENT STATUS

File:

```text
src/pages/customer/VerifyVisit.jsx
```

This file was recently fixed.

OLD incorrect behavior:

```js
GET /qr
```

and:

```js
qr_token
```

That caused:

```text
You do not have permission to access this resource
```

because customers are not allowed to access `/qr`.

The current intended behavior is:

```js
const [searchParams] = useSearchParams();

const qrCode =
  searchParams.get('qr_code') || '';
```

Then:

```js
api.post(
  '/verification/verify',
  {
    qr_code: qrCode,
    pin: pin.trim()
  },
  getConfig()
)
```

The page should NOT call `/qr`.

---

# 19. CURRENT VERIFY VISIT TEST ISSUE

When opening:

```text
/customer/verify
```

from the Customer Dashboard button, there is no QR query parameter.

Therefore it correctly shows:

```text
Business QR code is missing.
Please scan the business QR code again.
```

This is not necessarily a backend bug.

The correct QR URL contains:

```text
/customer/verify?qr_code=<actual-code>
```

Example:

```text
http://localhost:5173/customer/verify?qr_code=4d70ca1b3a60e45cd1f5d09c5e0c34d6
```

The user is currently testing locally.

The intended production behavior is:

```text
Physical QR scan
↓
URL contains qr_code
↓
Verify Visit page
↓
Customer enters staff PIN
↓
POST verification
```

---

# 20. TEST ACCOUNTS

## Test Customer

```text
Email:
test@qrloyalty.local

Password:
QRLoyaltyTest123!
```

---

## Admin

```text
Email:
admin@qrloyalty.local

Password:
Citymel@-22
```

---

## Owner 1

```text
Email:
owner@loyaltydemo.local

Password:
MominBhai!22
```

This account previously returned:

```text
Invalid login credentials
```

Do not spend time debugging it unless specifically needed.

---

## Owner 2

```text
Email:
owner2@loyaltydemo.local

Password:
MominBhai!23
```

This account currently works.

---

## Staff

```text
Email:
staff1@loyaltydemo.local

Password:
WheelsontheBus#22
```

Staff PIN generation has already been successfully tested.

---

# 21. CURRENT TEST REWARD

Reward:

```text
Free Coffee
```

Required stamps:

```text
10
```

---

# 22. LOYALTY TESTS ALREADY VALIDATED

The loyalty calculation has been tested conceptually with:

### Test 1

10 stamps → redeem → current progress:

```text
0
```

### Test 2

13 stamps → redeem → current progress:

```text
3
```

### Test 3

20 stamps → 2 redemptions → current progress:

```text
0
```

Historical records remain.

Historical stamps are NOT deleted when a reward is redeemed.

---

# 23. EXPECTED CUSTOMER TEST AFTER TWO CYCLES

Example expected state:

```text
Stamps Collected: 0 / 10
Remaining: 10
Rewards Redeemed: 2
Progress: 0%
Historical stamps: 20
Redemptions: 2
```

The UI should eventually show only a few recent records initially, approximately 3–5, with a View All / Show More approach.

---

# 24. IMMEDIATE REMAINING WORK

Do NOT start with styling.

First complete functionality.

Remaining order:

## STEP 1 — Verify Visit

Confirm:

```text
Customer scans/opens QR URL
↓
qr_code is detected
↓
PIN entered
↓
POST /verification/verify
↓
visit created
```

---

## STEP 2 — End-to-End Stamp Flow

After visit verification works:

Test:

```text
Staff generates PIN
↓
Customer verifies visit
↓
Visit exists
↓
Staff issues stamp
↓
Customer dashboard updates
```

Verify:

* customer stamp count
* history
* staff activity
* visit record
* tenant isolation

---

## STEP 3 — Reward Redemption

Test:

```text
10 stamps
↓
reward becomes eligible
↓
staff redeems reward
↓
redemption recorded
↓
customer current progress resets correctly
↓
historical stamps remain
```

Do not alter the backend calculation unless a concrete test fails.

---

## STEP 4 — Owner Dashboard Full Test

Test:

* overview metrics
* loyalty program
* staff list
* staff status
* staff activity
* rewards
* QR
* QR download

---

## STEP 5 — Admin Full Test

Test:

* platform metrics
* vendors
* vendor statuses
* reports
* report export
* access restrictions

---

## STEP 6 — Security / Access Testing

Test that:

Customer cannot access:

```text
/admin
/owner
/staff
```

Staff cannot access:

```text
/admin
/owner
```

Owner cannot access another tenant.

Customer cannot access:

```text
GET /qr
```

Customer only sees own data.

---

# 25. IMPORTANT: DO NOT FIX NON-BUGS

If a dashboard displays:

```text
0
```

first determine whether the database actually has zero records.

Do not automatically change frontend/backend code.

If:

```text
Total Vendors = 2
Active Vendors = 0
```

this may simply mean both vendors have non-active status.

If:

```text
Customer history = empty
```

it may simply mean that customer has not completed a visit.

Always verify the actual API response before modifying code.

---

# 26. FINAL UI/UX PASS — ONLY AFTER FUNCTIONALITY

After all functionality works, perform ONE consolidated styling pass.

Do not repeatedly redesign individual dashboards.

Create a consistent UI system across:

```text
Admin
Owner
Staff
Customer
Verify Visit
Login
```

Style goals:

* clean
* professional
* modern
* simple
* responsive
* mobile friendly
* consistent spacing
* consistent cards
* consistent buttons
* consistent forms
* consistent alerts
* consistent tables
* loading states
* empty states
* error states
* success states

Do not make the application unnecessarily flashy.

Keep it suitable for a real small SaaS MVP.

---

# 27. PRODUCTION PREPARATION — AFTER UI

Later:

Frontend:

```text
Vercel
```

Backend:

```text
Render
```

Database:

```text
Supabase
```

Need to configure:

```text
production frontend URL
production backend URL
CORS
environment variables
Supabase keys
API base URL
```

Important:

The QR URL must work in production.

The current localhost QR URL:

```text
http://localhost:5173/customer/verify?qr_code=...
```

will eventually become the production frontend URL.

Existing physical QR strategy should remain permanent.

---

# 28. ENVIRONMENT VARIABLES

Do not expose secret keys in frontend code.

Frontend should use appropriate public Supabase configuration.

Backend contains server-side secrets.

Never commit:

```text
.env
```

to GitHub.

Only commit:

```text
.env.example
```

with placeholder values.

---

# 29. USE THESE COMMANDS

Frontend:

```bash
cd "D:\HTML Projects\QR Loyalty\frontend"
npm install
npm run dev
```

Backend:

```bash
cd "D:\HTML Projects\QR Loyalty\backend"
npm install
npm run dev
```

If the frontend needs QRCode package:

```bash
cd "D:\HTML Projects\QR Loyalty\frontend"
npm install qrcode
```

Git status:

```bash
cd "D:\HTML Projects\QR Loyalty"
git status
```

Git add:

```bash
git add .
```

Commit:

```bash
git commit -m "Complete QR verification flow"
```

Push:

```bash
git push origin master
```

Before committing, inspect:

```bash
git status
```

Do not commit `.env` or secrets.

---

# 30. CODEX EFFICIENCY RULES

This project needs to be completed efficiently.

Use these rules:

### Rule 1

Do not scan/re-read the entire project after every request.

Use the context in this prompt.

### Rule 2

Before changing a file, inspect only that relevant file.

### Rule 3

Do not modify multiple unrelated files for one bug.

### Rule 4

If a bug is reported:

1. identify exact cause
2. change minimum required code
3. test
4. report result

### Rule 5

Do not re-audit finalized backend routes unless a concrete failure proves they need inspection.

### Rule 6

Do not change business policies.

### Rule 7

Do not redesign working components.

### Rule 8

Prefer complete replacement files when a frontend file is clearly small and needs a controlled change.

### Rule 9

Do not generate huge explanations when a simple command or code change is enough.

### Rule 10

Before making changes, state:

```text
File:
Problem:
Exact change:
```

Then make the change.

---

# 31. HOW TO WORK WITH THE USER

The user prefers:

* Roman Urdu + English
* beginner-friendly explanations
* exact paths
* exact commands
* exact clicks where relevant
* complete code when code is requested
* one step at a time
* no unnecessary theory

Example:

```text
Jani, ab sirf ye file change karni hai:

frontend/src/pages/customer/VerifyVisit.jsx

Current problem:
...

Fix:
...

Run:
...

Expected:
...
```

Do not overwhelm the user with 10 unrelated tasks.

Give the next concrete step.

---

# 32. CURRENT PRIORITY

The highest priority right now is:

## COMPLETE AND TEST CUSTOMER QR VERIFICATION

Current QR:

```text
4d70ca1b3a60e45cd1f5d09c5e0c34d6
```

Current test URL:

```text
http://localhost:5173/customer/verify?qr_code=4d70ca1b3a60e45cd1f5d09c5e0c34d6
```

Current customer:

```text
test@qrloyalty.local
QRLoyaltyTest123!
```

Current staff:

```text
staff1@loyaltydemo.local
WheelsontheBus#22
```

Test sequence:

```text
1. Login Staff
2. Generate PIN
3. Copy 6-digit PIN
4. Login Customer
5. Open QR verification URL
6. Enter PIN
7. Submit
8. Verify successful response
9. Verify visit record
10. Continue to stamp issuance
```

Do NOT move to UI styling until this flow works.

---

# 33. IMPORTANT CURRENT OBSERVATION

The Customer Dashboard's normal button:

```text
Verify Visit
```

currently navigates to:

```text
/customer/verify
```

without a query parameter.

That is why the page can display:

```text
Business QR code is missing.
Please scan the business QR code again.
```

This should eventually be improved as part of the final customer flow if appropriate.

Possible final UX:

```text
Customer Dashboard
        ↓
"Scan Business QR"
        ↓
physical QR scan
        ↓
/customer/verify?qr_code=...
```

Do not add an insecure workaround that exposes the owner-only `/qr` endpoint to customers.

---

# 34. SUCCESS CRITERIA

The project is functionally complete when all of these work:

## Authentication

* Admin login
* Owner login
* Staff login
* Customer login
* Logout
* protected routes

## Admin

* dashboard
* vendor management
* vendor status
* reports
* export

## Owner

* dashboard
* loyalty program
* staff
* rewards
* QR
* QR download

## Staff

* PIN generation
* PIN expiry
* verified visits
* stamp issuance
* reward redemption

## Customer

* dashboard
* loyalty progress
* stamp history
* redemption history
* QR verification
* visit verification

## Multi-tenancy

* tenant isolation
* owner isolation
* customer isolation
* staff isolation

## Loyalty

* stamps
* progress
* reward eligibility
* redemption
* historical records
* correct progress after redemption

## Production

* frontend deployment
* backend deployment
* Supabase production configuration
* CORS
* environment variables
* production QR URL

---

# 35. DO NOT RESTART FROM SCRATCH

This project is already significantly implemented.

The correct approach is:

```text
Continue from current code
↓
Finish verification
↓
Finish end-to-end loyalty flow
↓
Test access/security
↓
One UI pass
↓
Deploy
↓
Final QA
```

NOT:

```text
Rebuild project
↓
Redesign database
↓
Rewrite backend
↓
Rewrite policies
```

The goal is to finish the existing implementation efficiently.
