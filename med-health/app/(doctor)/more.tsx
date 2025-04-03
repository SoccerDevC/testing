"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, ScrollView } from "react-native"
import { useAuth } from "../../context/auth-context"
import { supabase } from "../../lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"

export default function DoctorMoreScreen() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        onPress: async () => {
          await signOut()
          router.replace("/(auth)/login")
        },
      },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert("Delete Account", "Are you sure you want to delete your account? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: confirmDeleteAccount,
      },
    ])
  }

  const confirmDeleteAccount = async () => {
    try {
      // Delete user from the database
      const { error: deleteError } = await supabase.from("users").delete().eq("id", user?.id)

      if (deleteError) throw deleteError

      // Sign out the user
      await signOut()
      router.replace("/(auth)/login")
    } catch (error) {
      console.error("Error deleting account:", error)
      Alert.alert("Error", "Failed to delete account")
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields")
      return
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match")
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      Alert.alert("Success", "Password changed successfully")
      setShowChangePassword(false)
      resetPasswordForm()
    } catch (error) {
      console.error("Error changing password:", error)
      Alert.alert("Error", "Failed to change password")
    }
  }

  const resetPasswordForm = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name ? user.name.charAt(0).toUpperCase() : "D"}</Text>
            </View>
            <View>
              <Text style={styles.userName}>{user?.name || "Doctor"}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => setShowChangePassword(true)}>
            <Ionicons name="key-outline" size={24} color="#4a90e2" />
            <Text style={styles.menuItemText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={24} color="#f44336" />
            <Text style={[styles.menuItemText, { color: "#f44336" }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color="#f44336" />
            <Text style={[styles.menuItemText, { color: "#f44336" }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showChangePassword}
        onRequestClose={() => setShowChangePassword(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowChangePassword(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter current password"
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword}>
              <Text style={styles.saveButtonText}>Change Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#4a90e2",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#4a90e2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  modalBody: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: "#4a90e2",
    padding: 16,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
})

