import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeForRole } from '../lib/utils';

/**
 * Guards a route the same way requireAuth(roles) did in the original app:
 * - No token/user -> send to /login
 * - Logged in but wrong role -> send to that role's home page
 */
export default function RequireAuth({ roles, children }) {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && roles.length && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return children;
}
