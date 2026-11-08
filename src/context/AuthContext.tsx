import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getProfile, updateProfile, getCategories, createCategory } from '@/lib/api';
import { processRecurringTransactions } from '@/lib/api';
import CATEGORY_PRESETS from '@/lib/categoryPresets';
import type { Profile } from '@/types';

export interface AuthUser extends Profile {
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, name: string, password: string) => Promise<{ error?: string }>;
  signOut: () => void;
  updateUserProfile: (updates: Partial<Pick<Profile, 'name' | 'currency' | 'date_format' | 'monthly_budget' | 'notify_budget' | 'notify_goals' | 'theme'>>) => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAuthUser(session: { user: { id: string; email?: string } } | null): Promise<AuthUser | null> {
  if (!session?.user) return null;
  const profile = await getProfile(session.user.id);
  return {
    ...(profile ?? {
      id: session.user.id,
      name: '',
      currency: 'BRL',
      date_format: 'dd/MM/yyyy',
      monthly_budget: 0,
      notify_budget: true,
      notify_goals: true,
      theme: 'system' as const,
      created_at: new Date().toISOString(),
    }),
    email: session.user.email ?? '',
  };
}

async function seedCategoriesIfEmpty(userId: string): Promise<void> {
  const existing = await getCategories(userId);
  if (existing.length > 0) return;
  for (const cat of CATEGORY_PRESETS) {
    await createCategory(userId, cat);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      const authUser = await fetchAuthUser(session);
      if (mounted) {
        setUser(authUser);
        setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          await processRecurringTransactions(session.user.id);
          await seedCategoriesIfEmpty(session.user.id);
        }
        const authUser = await fetchAuthUser(session);
        if (mounted) setUser(authUser);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const handleSignUp = async (email: string, name: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      // The trigger handle_new_user creates the profile row; seed categories
      await seedCategoriesIfEmpty(data.user.id);
    }
    return {};
  };

  const handleSignOut = () => {
    supabase.auth.signOut();
    setUser(null);
  };

  const handleUpdateProfile = async (updates: Partial<Pick<Profile, 'name' | 'currency' | 'date_format' | 'monthly_budget' | 'notify_budget' | 'notify_goals' | 'theme'>>) => {
    if (!user) return;
    const updated = await updateProfile(user.id, updates);
    if (updated) {
      setUser({ ...user, ...updated, email: user.email });
    }
  };

  const handleResetPassword = async (email: string) => {
    const redirectTo = `${window.location.origin}/#/recovery`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { error: error.message };
    return {};
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        updateUserProfile: handleUpdateProfile,
        resetPassword: handleResetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
