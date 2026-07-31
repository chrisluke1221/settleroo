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
  // redirectPath lets a caller (e.g. Login.js resuming pricing-page intent)
  // send the user somewhere other than /dashboard after auth completes. It
  // must be a relative same-origin path — callers are responsible for
  // validating it, since it's interpolated into the URL Supabase redirects
  // to and an unvalidated absolute URL here would be an open redirect.
  const signInWithGoogle = async (redirectPath = '/dashboard') => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${redirectPath}` },
    });
    if (error) throw error;
    return data;
  };

  const sendMagicLink = async (email, redirectPath = '/dashboard') => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${redirectPath}` },
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

  // Operator flag: set exclusively via service-role in app_metadata (never
  // user_metadata, which the user can write themselves). The claim is read
  // from the JWT that Supabase Auth embeds in the session — no extra RPC
  // needed. The SECURITY DEFINER RPCs re-assert this server-side; the
  // client flag is only for routing and UI visibility.
  const isOperator = !!(user?.app_metadata?.operator === true);

  const value = {
    user,
    signInWithGoogle,
    sendMagicLink,
    logout,
    updateName,
    loading,
    isAuthenticated: !!user,
    isOperator,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
