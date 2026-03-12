import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
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

  const sendOtp = async (phone) => {
    const response = await axios.post(`${API}/auth/send-otp`, { phone });
    return response.data;
  };

  const verifyOtp = async (phone, code) => {
    const response = await axios.post(`${API}/auth/verify-otp`, { phone, code });
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

  const getAuthHeader = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const value = {
    user,
    token,
    loading,
    sendOtp,
    verifyOtp,
    logout,
    updateProfile,
    getAuthHeader,
    isAuthenticated: !!user,
    isSeller: user?.role === "seller"
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
