"use client"

import type React from "react"
import { createContext, useState, useEffect, useContext } from "react"
import { supabase } from "../lib/supabase"
import type { Session, User } from "@supabase/supabase-js"

// Define the extended user type with role
export type UserWithRole = User & {
  role?: "doctor" | "patient"
  name?: string
  id?: string
}

type AuthContextType = {
  user: UserWithRole | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any; userRole?: "doctor" | "patient" | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  getUserRole: () => Promise<"doctor" | "patient" | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        // Cast the user to UserWithRole
        setUser(session.user as UserWithRole)
        // Get user role when session is available
        getUserRole().then((role) => {
          if (role) {
            setUser((prev) => (prev ? { ...prev, role } : null))
          }
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        // Cast the user to UserWithRole
        setUser(session.user as UserWithRole)
        // Get user role when auth state changes
        getUserRole().then((role) => {
          if (role) {
            setUser((prev) => (prev ? { ...prev, role } : null))
          }
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const getUserRole = async (): Promise<"doctor" | "patient" | null> => {
    if (!user) return null

    // Check in the public schema's users table
    const { data, error } = await supabase.from("users").select("role, name, id").eq("email", user.email).single()

    if (error || !data) {
      console.log("Error fetching user role:", error)
      return null
    }

    // Update user with role and name
    setUser({
      ...user,
      role: data.role as "doctor" | "patient",
      name: data.name,
      id: data.id,
    })

    return data.role as "doctor" | "patient"
  }

  const signIn = async (email: string, password: string) => {
    // First try to authenticate with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.log("Auth error:", error)
      return { error }
    }

    // If authentication successful, check if user exists in public schema
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, name, id")
      .eq("email", email)
      .single()

    if (userError) {
      console.log("Error fetching user data:", userError)
      // If no user found in public schema, return auth success but no role
      if (userError.code === "PGRST116") {
        // "no rows returned" error
        return { error: null, userRole: null }
      }
    }

    // If user exists in public schema, update the user state with role
    if (userData) {
      setUser({
        ...data.user,
        role: userData.role as "doctor" | "patient",
        name: userData.name,
        id: userData.id,
      })

      return { error: null, userRole: userData.role as "doctor" | "patient" }
    }

    // If user doesn't exist in public schema but auth succeeded, they might be in auth schema only
    return { error: null, userRole: null }
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({ email, password })

    if (!error) {
      // Add user to the users table with role 'patient'
      const { error: insertError } = await supabase.from("users").insert([{ email, name, role: "patient" }])

      return { error: insertError }
    }

    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, getUserRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

