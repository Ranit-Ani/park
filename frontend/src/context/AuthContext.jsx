import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, getToken, getUser, setSession } from '../lib/api';
import { homeForRole } from '../lib/utils';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser());
  const navigate = useNavigate();

  const login = useCallback((token, userObj) => {
    setSession(token, userObj);
    setUser(userObj);
  }, []);

  const updateUser = useCallback((patch) => {
    const merged = { ...getUser(), ...patch };
    localStorage.setItem('agp_user', JSON.stringify(merged));
    setUser(merged);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const redirectByRole = useCallback((role) => {
    navigate(homeForRole(role), { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({ user, token: getToken(), login, logout, updateUser, redirectByRole }),
    [user, login, logout, updateUser, redirectByRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}