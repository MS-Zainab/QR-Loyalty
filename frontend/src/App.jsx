import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from './routes/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const CustomerDashboard = lazy(() => import('./pages/customer/CustomerDashboard'));
const VerifyVisit = lazy(() => import('./pages/customer/VerifyVisit'));
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'));
const OwnerDashboard = lazy(() => import('./pages/owner/OwnerDashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-loading" role="status">Loading page…</div>}>
      <Routes>

        {/* Public route */}
        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        <Route
          path="/login"
          element={<Login />}
        />

        {/* Admin routes */}
       <Route
  element={
    <ProtectedRoute
      allowedRoles={['admin']}
    />
  }
>
  <Route
    path="/admin"
    element={<AdminDashboard />}
  />
</Route>

        {/* Vendor Owner routes */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={['vendor_owner']}
            />
          }
        >
          <Route
            path="/owner"
            element={<OwnerDashboard />}
          />
        </Route>

        {/* Vendor Staff routes */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={['vendor_staff']}
            />
          }
        >
          <Route
            path="/staff"
            element={<StaffDashboard />}
          />
        </Route>

        {/* Customer entry / visit verification route */}
        <Route
          path="/customer/verify"
          element={<VerifyVisit />}
        />

        {/* Customer Dashboard routes */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={['customer']}
            />
          }
        >
          <Route
            path="/customer"
            element={<CustomerDashboard />}
          />
        </Route>

        {/* Unknown routes */}
        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
