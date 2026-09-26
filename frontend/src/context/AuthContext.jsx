import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (accessToken) => {
    try {
      const response = await api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      setProfile(response.data.profile);

      return response.data.profile;
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfile(null);

      return null;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();

      setSession(currentSession);

      if (currentSession?.access_token) {
        await loadProfile(currentSession.access_token);
      }

      setLoading(false);
    };

    initializeAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession);

        if (currentSession?.access_token) {
          await loadProfile(currentSession.access_token);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    let loadedProfile = null;

    if (data.session?.access_token) {
      loadedProfile = await loadProfile(data.session.access_token);
    }

    return {
      ...data,
      profile: loadedProfile
    };
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        login,
        logout,
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