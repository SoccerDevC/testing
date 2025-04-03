import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

// Define the extended user type with role
export type UserWithRole = User & {
  role?: 'doctor' | 'patient';
  name?: string;
  id?: string;
};

type AuthContextType = {
  user: UserWithRole | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  getUserRole: () => Promise<'doctor' | 'patient' | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        // Cast the user to UserWithRole
        setUser(session.user as UserWithRole);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          // Cast the user to UserWithRole
          setUser(session.user as UserWithRole);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getUserRole = async (): Promise<'doctor' | 'patient' | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('role, name, id')
      .eq('email', user.email)
      .single();

    if (error || !data) return null;

    // Update user with role and name
    setUser({
      ...user,
      role: data.role as 'doctor' | 'patient',
      name: data.name,
      id: data.id
    });

    return data.role as 'doctor' | 'patient';
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      await getUserRole();
    }
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    
    if (!error) {
      // Add user to the users table with role 'patient'
      const { error: insertError } = await supabase
        .from('users')
        .insert([{ email, name, role: 'patient' }]);
      
      return { error: insertError };
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, getUserRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}