import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles }) => {
  const {
    loading,
    session,
    profile
  } = useAuth();

  // Wait until authentication state is loaded
  if (loading) {
    return (
      <div>
        <p>Loading...</p>
      </div>
    );
  }

  // User is not logged in
  if (!session || !profile) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // User does not have permission for this route
  if (
    allowedRoles &&
    !allowedRoles.includes(profile.role)
  ) {
    if (profile.role === 'admin') {
      return (
        <Navigate
          to="/admin"
          replace
        />
      );
    }

    if (profile.role === 'vendor_owner') {
      return (
        <Navigate
          to="/owner"
          replace
        />
      );
    }

    if (profile.role === 'vendor_staff') {
      return (
        <Navigate
          to="/staff"
          replace
        />
      );
    }

    if (profile.role === 'customer') {
      return (
        <Navigate
          to="/customer"
          replace
        />
      );
    }

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;