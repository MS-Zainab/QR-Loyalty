import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(async (config) => {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  let session = data.session;

  // Refresh shortly before expiry so a request does not race the token boundary.
  if (
    session?.expires_at &&
    session.expires_at <= Math.floor(Date.now() / 1000) + 30
  ) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session) {
      session = refreshed.data.session;
    }
  }

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const message = error.response?.data?.message;
    const isTokenFailure =
      message === 'Invalid or expired authentication token' ||
      message === 'Authentication required';

    if (error.response?.status !== 401 || !isTokenFailure || !config || config._authRetried) {
      return Promise.reject(error);
    }

    config._authRetried = true;
    let refreshedSession;
    try {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) return Promise.reject(error);
      refreshedSession = data.session;
    } catch {
      return Promise.reject(error);
    }

    if (!refreshedSession?.access_token) return Promise.reject(error);

    config.headers.Authorization = `Bearer ${refreshedSession.access_token}`;
    return api(config);
  }
);

export default api;
