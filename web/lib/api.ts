import axios from "axios";
import Cookies from "js-cookie";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = Cookies.get("authToken") || localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      Cookies.remove("authToken");
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: (userData: { username: string; email: string; password: string }) =>
    api.post("/api/auth/register", userData),
  login: (credentials: { email: string; password: string }) =>
    api.post("/api/auth/login", credentials),
  getMe: () => api.get("/api/auth/me"),
};

// User API calls
export const userAPI = {
  getOnlineUsers: () => api.get("/api/users/online"),
  getAvailableUsers: () => api.get("/api/users/available"),
  updateDevice: (deviceData: { deviceId: string }) =>
    api.post("/api/users/device", deviceData),
  getStats: () => api.get("/api/users/stats"),
};

// File upload API
export const fileAPI = {
  uploadFile: (formData: FormData) =>
    api.post("/api/files/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    }),
  uploadVoice: (formData: FormData) =>
    api.post("/api/files/voice", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    }),
};

export default api;
