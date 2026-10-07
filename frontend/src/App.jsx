import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';

import ProtectedRoute from './routes/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const CustomerDashboard = lazy(() => import('./pages/customer/CustomerDashboard'));
const VerifyVisit = lazy(() => import('./pages/customer/VerifyVisit'));
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'));
const OwnerDashboard = lazy(() => import('./pages/owner/OwnerDashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const SlugRedirect = lazy(() => import('./pages/customer/SlugRedirect'));

/**
 * TenantScopedRoute - Wrapper component that preserves tenant slug in URL.
 * Persists the slug to sessionStorage so ProtectedRoute can read it even
 * when the URL no longer contains the :slug param (e.g. after a redirect).
 */
const TenantScopedRoute = ({ children }) => {
  const { slug } = useParams();
  if (slug) {
    sessionStorage.setItem('tenant_slug', slug);
  }
  return children;
};

/**
 * SlugAwareRedirect - Used for root / and * catch-all routes.
 * Redirects to /v/:slug/login when a slug is in sessionStorage,
 * otherwise falls back to plain /login.
 */
const SlugAwareRedirect = () => {
  const slug = sessionStorage.getItem('tenant_slug');
  return <Navigate to={slug ? `/v/${slug}/login` : '/login'} replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-loading" role="status">Loading page…</div>}>
      <Routes>

        {/* Root — redirect to login, preserving slug if known */}
        <Route
          path="/"
          element={<SlugAwareRedirect />}
        />

        {/* Tenant-scoped login route - MUST come before generic /login */}
        <Route
          path="/v/:slug/login"
          element={
            <TenantScopedRoute>
              <Login />
            </TenantScopedRoute>
          }
        />

        {/* Generic login route (fallback — used by admin and non-slug flows) */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* ── Tenant-scoped protected routes ──────────────────────────── */}

        {/* Staff */}
        <Route
          path="/v/:slug/staff"
          element={
            <TenantScopedRoute>
              <ProtectedRoute allowedRoles={['vendor_staff']}>
                <StaffDashboard />
              </ProtectedRoute>
            </TenantScopedRoute>
          }
        />

        {/* Owner */}
        <Route
          path="/v/:slug/owner"
          element={
            <TenantScopedRoute>
              <ProtectedRoute allowedRoles={['vendor_owner']}>
                <OwnerDashboard />
              </ProtectedRoute>
            </TenantScopedRoute>
          }
        />

        {/* Customer dashboard */}
        <Route
          path="/v/:slug/customer"
          element={
            <TenantScopedRoute>
              <ProtectedRoute allowedRoles={['customer']}>
                <CustomerDashboard />
              </ProtectedRoute>
            </TenantScopedRoute>
          }
        />

        {/* Visit verification (tenant-scoped) */}
        <Route
          path="/v/:slug/verify"
          element={
            <TenantScopedRoute>
              <VerifyVisit />
            </TenantScopedRoute>
          }
        />

        {/* Branded slug QR redirect — public, no auth */}
        <Route
          path="/v/:slug"
          element={<SlugRedirect />}
        />

        {/* ── Admin routes (no tenant scoping) ────────────────────────── */}
        <Route
          element={<ProtectedRoute allowedRoles={['admin']} />}
        >
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* ── Legacy routes (backward-compat, no slug prefix) ─────────── */}

        <Route
          element={<ProtectedRoute allowedRoles={['vendor_owner']} />}
        >
          <Route path="/owner" element={<OwnerDashboard />} />
        </Route>

        <Route
          element={<ProtectedRoute allowedRoles={['vendor_staff']} />}
        >
          <Route path="/staff" element={<StaffDashboard />} />
        </Route>

        <Route
          element={<ProtectedRoute allowedRoles={['customer']} />}
        >
          <Route path="/customer" element={<CustomerDashboard />} />
        </Route>

        {/* Customer visit verification (legacy) */}
        <Route
          path="/customer/verify"
          element={<VerifyVisit />}
        />

        {/* Unknown routes — slug-aware fallback */}
        <Route path="*" element={<SlugAwareRedirect />} />

      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
