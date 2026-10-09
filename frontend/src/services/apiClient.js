import axios from 'axios';

// Resolve base URL from environment or default to localhost FastAPI
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
export const API_BASE_URL = rawBaseUrl.endsWith('/api/v1')
  ? rawBaseUrl
  : `${rawBaseUrl.replace(/\/+$/, '')}/api/v1`;

/**
 * Primary Axios instance for SolarMind REST API communication
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// In-memory access token reference
let memoryToken = null;

export const setAuthToken = (token) => {
  memoryToken = token;
  if (token) {
    try {
      sessionStorage.setItem('solarmind_access_token', token);
    } catch {
      // Ignore storage restrictions
    }
  } else {
    try {
      sessionStorage.removeItem('solarmind_access_token');
    } catch {
      // Ignore
    }
  }
};

export const getAuthToken = () => {
  if (memoryToken) return memoryToken;
  try {
    return sessionStorage.getItem('solarmind_access_token');
  } catch {
    return null;
  }
};

export const clearAuthToken = () => {
  setAuthToken(null);
};

/**
 * Standardized API Error parsing utility
 */
export const parseApiError = (error) => {
  if (!error) {
    return {
      message: 'An unknown error occurred.',
      status: 0,
      code: 'UNKNOWN_ERROR',
      details: null,
      isNetworkError: false,
      isAuthError: false,
      isPermissionError: false,
      isRateLimited: false,
      isServerError: false,
      originalError: null,
    };
  }

  // Already standardized
  if (error.isStandardized) {
    return error;
  }

  const status = error.response?.status || 0;
  const data = error.response?.data;

  let message = 'API Communication Error';
  if (typeof data?.detail === 'string') {
    message = data.detail;
  } else if (Array.isArray(data?.detail)) {
    message = data.detail.map((err) => `${err.loc ? err.loc.join('.') : 'Field'}: ${err.msg}`).join(', ');
  } else if (data?.message) {
    message = data.message;
  } else if (error.message) {
    message = error.message;
  }

  const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');
  const isAuthError = status === 401;
  const isPermissionError = status === 403;
  const isRateLimited = status === 429;
  const isServerError = status >= 500;

  return {
    isStandardized: true,
    message,
    status,
    code: error.code || (status ? `HTTP_${status}` : 'COMMUNICATION_ERROR'),
    details: data?.details || data || null,
    isNetworkError,
    isAuthError,
    isPermissionError,
    isRateLimited,
    isServerError,
    originalError: error,
  };
};

/**
 * Sanitize query parameters (strip undefined/null, format Date objects to ISO string)
 */
export const buildQueryParams = (params = {}) => {
  const clean = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'ALL') {
      continue;
    }
    if (value instanceof Date) {
      clean[key] = value.toISOString();
    } else {
      clean[key] = value;
    }
  }
  return clean;
};

/**
 * Helper for multipart/form-data POST and PUT uploads
 */
export const uploadMultipart = async (url, formData, { method = 'POST', onUploadProgress, timeout = 60000 } = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'multipart/form-data',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await apiClient({
    url,
    method,
    data: formData,
    headers,
    timeout,
    onUploadProgress,
  });
  return response.data;
};

// 1. Request Interceptor: Attach Bearer Token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(parseApiError(error))
);

// 2. Response Interceptor: Standardized Error Handling & Session Expiry Trigger
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const parsed = parseApiError(error);

    // Handle 401 Unauthorized session expiration
    if (parsed.isAuthError) {
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('solarmind_auth_expired', {
            detail: { message: 'Your session has expired. Please sign in again.' },
          })
        );
      }
    }

    return Promise.reject(parsed);
  }
);

export default apiClient;
