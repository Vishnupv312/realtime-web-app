import axios from "axios";
import Cookies from "js-cookie";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor to add guest token
api.interceptors.request.use((config) => {
  // Try guest token first (session storage), then fallback to auth token
  const guestToken = sessionStorage.getItem("guestAuthToken");
  const authToken = Cookies.get("authToken") || localStorage.getItem("authToken");
  const token = guestToken || authToken;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Let session context handle token regeneration
let sessionRegenerationCallback: (() => Promise<void>) | null = null;

// Function to set the session regeneration callback
export const setSessionRegenerationCallback = (callback: (() => Promise<void>) | null) => {
  sessionRegenerationCallback = callback;
};

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired - handle both guest and auth tokens
      const hasGuestToken = sessionStorage.getItem("guestAuthToken");
      const hasAuthToken = Cookies.get("authToken") || localStorage.getItem("authToken");
      
      if (hasGuestToken && sessionRegenerationCallback) {
        console.log('🔄 Guest session expired, attempting to regenerate...');
        try {
          // Clear expired session
          sessionStorage.removeItem("guestAuthToken");
          sessionStorage.removeItem("guest_user_session");
          
          // Attempt to regenerate session
          await sessionRegenerationCallback();
          
          // Retry the original request with new token
          const newToken = sessionStorage.getItem("guestAuthToken");
          if (newToken && error.config) {
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(error.config);
          }
        } catch (regenerationError) {
          console.error('❌ Failed to regenerate guest session:', regenerationError);
          // Fall back to redirect if regeneration fails
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
        }
      } else if (hasGuestToken) {
        // No regeneration callback available, clear session and redirect
        sessionStorage.removeItem("guestAuthToken");
        sessionStorage.removeItem("guest_user_session");
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      } else if (hasAuthToken) {
        // Clear auth tokens and redirect to login
        Cookies.remove("authToken");
        localStorage.removeItem("authToken");
        localStorage.removeItem("currentUser");
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// Guest API calls
export const guestAPI = {
  generateUsername: () => api.get("/api/guest/username"),
  createSession: (userData: { username?: string; location?: any; gender?: string; language?: string }) =>
    api.post("/api/guest", userData),
  getSession: (sessionId: string) => api.get(`/api/guest/${sessionId}`),
  getMe: () => api.get("/api/guest/me"),
  updateLocation: (locationData: { location?: any; gender?: string; language?: string }) =>
    api.post("/api/guest/location", locationData),
};

// Auth API calls (deprecated - keeping for backward compatibility)
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
