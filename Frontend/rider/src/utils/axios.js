import axios from "axios";
import { attachSingleFlightRefresh } from "@shared/api/singleFlightRefresh";
import { saveAuthSession, clearAuthSession, getStoredUser } from "@shared/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

attachSingleFlightRefresh(api, {
  apiUrl: API_URL,
  getRefreshToken: () => localStorage.getItem("refreshToken"),
  setTokens: (data) => {
    const user = data.user || getStoredUser("rider");
    saveAuthSession(user, data.accessToken, data.refreshToken, "rider");
  },
  onRefreshFailed: () => {
    clearAuthSession("rider");
  },
  loginPath: "/rider/login",
});

export default api;