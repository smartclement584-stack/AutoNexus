import { API } from "../lib/constants";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import i18n from "../i18n";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("autonexus_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
        } catch (error) {
          console.error("Failed to load user:", error);
          localStorage.removeItem("autonexus_token");
          setToken(null);
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token]);

  // Global 401 handling. Route guards (ProtectedRoute) only run when the
  // user navigates — they can't catch a token expiring while the user sits
  // on a page making API calls (e.g. leaves a dashboard tab open past the
  // token's 7-day lifetime). Without this, those calls fail silently
  // (console.error only) and the page just looks broken with no
  // explanation. This catches every 401 from any request in one place,
  // clears the stale session, and lets the router react — AuthContext lives
  // outside BrowserRouter and has no navigate() of its own by design; the
  // next render of any ProtectedRoute-guarded page sees isAuthenticated
  // become false and redirects on its own.
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const url = error.config?.url || "";
        // Don't treat a failed login/signup attempt (wrong password, e.g.)
        // as a "session expired" event — there's no session yet to expire.
        const isAuthAttempt = url.includes("/auth/login") || url.includes("/auth/signup");

        if (status === 401 && !isAuthAttempt && localStorage.getItem("autonexus_token")) {
          localStorage.removeItem("autonexus_token");
          setToken(null);
          setUser(null);
          // Uses the shared i18n instance directly (not the `t` from
          // useTranslation()) so this always reflects whichever language is
          // active at the moment the 401 actually happens, regardless of
          // when this effect's closure was created (registered once, deps=[]).
          toast.error(i18n.t("common.session_expired"));
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptorId);
  }, []);

  const signup = async ({ name, phone, email, password }) => {
    const response = await axios.post(`${API}/auth/signup`, { name, phone, email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem("autonexus_token", newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const login = async (identifier, password) => {
    const response = await axios.post(`${API}/auth/login`, { identifier, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem("autonexus_token", newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  // Both intentionally do NOT touch token/user state — the person isn't
  // logged in yet during this flow (or shouldn't be assumed to be), and a
  // successful reset should always land them back on the login form to
  // authenticate fresh with the new password, not silently sign them in.
  const forgotPassword = async (identifier) => {
    const response = await axios.post(`${API}/auth/forgot-password`, { identifier });
    return response.data;
  };

  const resetPassword = async (identifier, code, newPassword) => {
    const response = await axios.post(`${API}/auth/reset-password`, {
      identifier,
      code,
      new_password: newPassword,
    });
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem("autonexus_token");
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (data) => {
    const response = await axios.put(`${API}/auth/me`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUser(response.data);
    return response.data;
  };

  // FIX: wrap in useCallback so reference is stable — prevents DashboardPage useEffect loop
  const getAuthHeader = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const toggleFavorite = async (partId) => {
    if (!token) return;
    const favorites = user?.favorites || [];
    const isFav = favorites.includes(partId);
    try {
      if (isFav) {
        await axios.delete(`${API}/favorites/${partId}`, { headers: getAuthHeader() });
        setUser(u => ({ ...u, favorites: u.favorites.filter(id => id !== partId) }));
      } else {
        await axios.post(`${API}/favorites/${partId}`, {}, { headers: getAuthHeader() });
        setUser(u => ({ ...u, favorites: [...(u.favorites || []), partId] }));
      }
    } catch (e) {
      console.error("Favorite toggle failed:", e);
    }
  };

  const value = {
    user,
    token,
    loading,
    signup,
    login,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    getAuthHeader,
    toggleFavorite,
    isAuthenticated: !!user,
    isSeller: user?.role === "seller",
    isAdmin: !!user?.is_admin,
    favorites: user?.favorites || []
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
