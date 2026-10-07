import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Resolves the active tenant slug from (in priority order):
 *  1. The :slug URL param (when inside a /v/:slug/* route)
 *  2. sessionStorage (persisted by TenantScopedRoute on first visit)
 */
const useTenantSlug = () => {
  const { slug } = useParams();
  return slug || sessionStorage.getItem('tenant_slug') || null;
};

const ProtectedRoute = ({ allowedRoles, children }) => {
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

  const { search, pathname } = useLocation();
  const slug = useTenantSlug();

  // Build prefix — every redirect stays under /v/:slug when a slug is known
  const tenantBase = slug ? `/v/${slug}` : '';

  // User is not logged in → send to tenant-scoped login (or generic)
  if (!session || !profile) {
    const loginPath = slug ? `/v/${slug}/login${search}` : `/login${search}`;
    return (
      <Navigate
        to={loginPath}
        state={{ from: pathname }}
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
          to={`${tenantBase}/owner`}
          replace
        />
      );
    }

    if (profile.role === 'vendor_staff') {
      return (
        <Navigate
          to={`${tenantBase}/staff`}
          replace
        />
      );
    }

    if (profile.role === 'customer') {
      return (
        <Navigate
          to={`${tenantBase}/customer`}
          replace
        />
      );
    }

    const loginPath = slug ? `/v/${slug}/login` : '/login';
    return (
      <Navigate
        to={loginPath}
        replace
      />
    );
  }

  // Render children (used when ProtectedRoute wraps a single element)
  // or Outlet (used when ProtectedRoute is a layout route)
  return children ?? <Outlet />;
};

export default ProtectedRoute;