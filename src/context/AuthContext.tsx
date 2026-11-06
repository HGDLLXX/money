import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDb } from '@/lib/db';
import { signIn as apiSignIn, signUp as apiSignUp, getUserById, updateUser, updatePassword } from '@/lib/api';
import { processRecurringTransactions } from '@/lib/api';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, name: string, password: string) => Promise<{ error?: string }>;
  signOut: () => void;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'granaplus_user_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await getDb();
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        const u = await getUserById(storedId);
        if (u) {
          await processRecurringTransactions(u.id);
          setUser(u);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    const { user: u, error } = await apiSignIn(email, password);
    if (error) return { error };
    if (u) {
      await processRecurringTransactions(u.id);
      setUser(u);
      localStorage.setItem(STORAGE_KEY, u.id);
    }
    return {};
  };

  const handleSignUp = async (email: string, name: string, password: string) => {
    const { user: u, error } = await apiSignUp(email, name, password);
    if (error) return { error };
    if (u) {
      setUser(u);
      localStorage.setItem(STORAGE_KEY, u.id);
    }
    return {};
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleUpdateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    const updated = await updateUser(user.id, updates);
    if (updated) setUser(updated);
  };

  const handleResetPassword = async (email: string, newPassword: string) => {
    return await updatePassword(email, newPassword);
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
