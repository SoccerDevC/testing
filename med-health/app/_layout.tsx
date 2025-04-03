"use client"

import { useEffect } from "react"
import { Slot, useRouter, useSegments } from "expo-router"
import { AuthProvider, useAuth } from "../context/auth-context"
import { View, ActivityIndicator } from "react-native"

// Root layout with auth provider
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  )
}

// Navigation with auth protection
function RootLayoutNav() {
  const { user, loading, getUserRole } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === "(auth)"

    // Check if user is authenticated
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login")
    } else if (user && inAuthGroup) {
      // Redirect based on role
      getUserRole().then((role) => {
        if (role === "doctor") {
          router.replace("/(doctor)")  // Redirect to doctor layout
        } else if (role === "patient") {
          router.replace("/(patient)")  // Redirect to patient layout
        }
      })
    }
  }, [user, loading, segments])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return <Slot />
}
