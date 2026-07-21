import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange is the single source of truth for both `user` and
    // `loading` — its first firing (INITIAL_SESSION) only happens once the
    // client has finished checking storage *and* parsing any magic-link URL
    // fragment. A separate getSession() call used to race this: on a fresh
    // magic-link redirect it could resolve first and flip loading=false
    // while the real session was still being committed, which briefly made
    // RequireAuth (src/App.js) see "not authenticated" and bounce to
    // /login before the session landed a moment later.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Passwordless: no signup/login distinction, no password to set, forget,
  // or reset — the account is created implicitly on first sign-in either
  // way. Google supplies a name via user_metadata; magic-link users are
  // asked for a name once in-app later (at their first bill), not at the
  // door.
  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw error;
    return data;
  };

  const sendMagicLink = async (email) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Only Google sign-in supplies a name automatically. Magic-link users
  // have none until they set it here — see the NameSetupBanner prompt.
  // updateUser triggers onAuthStateChange itself, so `user` refreshes
  // without extra plumbing.
  const updateName = async (fullName) => {
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    if (error) throw error;
    return data.user;
  };

  const value = {
    user,
    signInWithGoogle,
    sendMagicLink,
    logout,
    updateName,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
