import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';

import CustomerDashboard from './pages/customer/CustomerDashboard';
import VerifyVisit from './pages/customer/VerifyVisit';

import StaffDashboard from './pages/staff/StaffDashboard';
import OwnerDashboard from './pages/owner/OwnerDashboard';

import ProtectedRoute from './routes/ProtectedRoute';

import AdminDashboard from './pages/admin/AdminDashboard';

const Placeholder = ({ title }) => {
  return (
    <div>
      <h1>{title}</h1>
      <p>Dashboard coming next.</p>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
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

        {/* Customer routes */}
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

          <Route
            path="/customer/verify"
            element={<VerifyVisit />}
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
    </BrowserRouter>
  );
}

export default App;