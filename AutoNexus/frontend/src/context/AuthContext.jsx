import { API } from "../lib/constants";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

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
