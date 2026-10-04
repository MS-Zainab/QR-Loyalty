import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import api from '../services/api';
import { logClientError } from '../services/logging';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const profileUserId = useRef(null);
  const activeUserId = useRef(null);
  const profileLoad = useRef({ userId: null, promise: null, profile: null });

  const loadProfile = (accessToken, userId) => {
    const existingLoad = profileLoad.current;
    if (existingLoad.userId === userId) {
      if (existingLoad.promise) return existingLoad.promise;
      if (existingLoad.profile) return Promise.resolve(existingLoad.profile);
    }

    const request = (async () => {
      try {
        const response = await api.get('/auth/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const loadedProfile = response.data.profile;

        // A slower request for a previous account must not replace the current profile.
        if (activeUserId.current !== userId) return null;

        setProfile(loadedProfile);
        profileUserId.current = loadedProfile?.auth_user_id || userId;
        profileLoad.current = {
          userId,
          promise: null,
          profile: loadedProfile
        };
        return loadedProfile;
      } catch (error) {
        logClientError('Failed to load profile', error);
        if (activeUserId.current === userId) {
          setProfile(null);
          profileUserId.current = null;
          profileLoad.current = { userId, promise: null, profile: null };
        }
        return null;
      }
    })();

    profileLoad.current = { userId, promise: request, profile: null };
    return request;
  };

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();

      if (!active) return;
      const userId = currentSession?.user?.id || null;
      activeUserId.current = userId;
      setSession((previous) =>
        previous?.access_token === currentSession?.access_token
          ? previous
          : currentSession
      );

      if (currentSession?.access_token) {
        await loadProfile(currentSession.access_token, userId);
      }

      if (active) setLoading(false);
    };

    initializeAuth();

    const handleFocus = async () => {
      const { data: { session: focusSession } } = await supabase.auth.getSession();
      if (!active) return;
      if (focusSession?.access_token && focusSession?.access_token !== activeUserId.current) {
        const userId = focusSession?.user?.id || null;
        activeUserId.current = userId;
        setSession(focusSession);
        if (focusSession?.access_token) {
          loadProfile(focusSession.access_token, userId);
        }
      }
    };
    window.addEventListener('focus', handleFocus);

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        if (!active) return;
        const nextUserId = currentSession?.user?.id || null;
        const previousUserId = activeUserId.current;
        activeUserId.current = nextUserId;
        setSession((previous) =>
          previous?.access_token === currentSession?.access_token
            ? previous
            : currentSession
        );

        if (nextUserId && nextUserId !== profileUserId.current) {
          if (previousUserId !== nextUserId) {
            setProfile(null);
          }
          setLoading(true);
          // Keep the Supabase auth callback synchronous; profile I/O runs outside it.
          Promise.resolve().then(() => loadProfile(currentSession.access_token, nextUserId)).finally(() => {
            if (active && activeUserId.current === nextUserId) setLoading(false);
          });
        } else {
          if (!nextUserId) {
            profileUserId.current = null;
            profileLoad.current = { userId: null, promise: null, profile: null };
            setProfile(null);
          }
          setLoading(false);
        }
      });

    return () => {
      active = false;
      window.removeEventListener('focus', handleFocus);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    // Call our backend login endpoint — it authenticates via Supabase
    // server-side and returns the bearer token we need.
    let responseData;
    try {
      const response = await api.post('/auth/login', { email, password });
      responseData = response.data;
    } catch (err) {
      // Surface a clean message from the API error body when available.
      const message =
        err.response?.data?.message || err.message || 'Login failed';
      throw new Error(message);
    }

    if (!responseData?.success) {
      throw new Error(responseData?.message || 'Login failed');
    }

    const { access_token, refresh_token, user } = responseData;

    // Feed the tokens into the Supabase client so onAuthStateChange fires
    // and the rest of the app (guards, redirects) stays in sync.
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (sessionError) {
      throw sessionError;
    }

    const userId = user?.id || null;
    activeUserId.current = userId;

    let loadedProfile = null;
    if (access_token) {
      loadedProfile = await loadProfile(access_token, userId);
    }

    return {
      session: { access_token, refresh_token, user },
      user,
      profile: loadedProfile
    };
  };

  const customerLogin = async (fullName, phoneNumber) => {
    const response = await api.post('/auth/customer-login', {
      full_name: fullName,
      phone_number: phoneNumber
    });

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || 'Customer login failed');
    }

    const { access_token, refresh_token, user, profile: resProfile } = response.data;

    if (access_token && refresh_token) {
      await supabase.auth.setSession({
        access_token,
        refresh_token
      });
    }

    const userId = user?.id || null;
    activeUserId.current = userId;
    setSession({
      access_token,
      refresh_token,
      user
    });

    setProfile(resProfile);
    profileUserId.current = resProfile?.auth_user_id || userId;

    return {
      session: { access_token, user },
      profile: resProfile
    };
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setSession(null);
    setProfile(null);
    profileUserId.current = null;
    activeUserId.current = null;
    profileLoad.current = { userId: null, promise: null, profile: null };
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`
    });

    if (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        login,
        customerLogin,
        logout,
        resetPassword,
        isAuthenticated: !!session
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
