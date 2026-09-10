import { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/axios";
import {
  createAuthService,
  saveAuthSession,
  clearAuthSession,
  getStoredUser,
} from "@shared/auth";
import { resetPushNotifications } from "../utils/pushNotifications";

const AuthContext = createContext();
const authService = createAuthService(api);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser("kitchen"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const res = await authService.getMe();
          if (res.data?.user) {
            setUser(res.data.user);
            localStorage.setItem("user", JSON.stringify(res.data.user));
          }
        } catch {
          clearAuthSession("kitchen");
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const loginWithSession = (userData, accessToken, refreshToken) => {
    saveAuthSession(userData, accessToken, refreshToken, "kitchen");
    setUser(userData);
  };

  const logout = () => {
    clearAuthSession("kitchen");
    resetPushNotifications();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, setAuthUser: setUser, loginWithSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);