"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useAuth } from "../../context/auth-context"
import { supabase } from "../../lib/supabase"
import { Ionicons } from "@expo/vector-icons"

type Message = {
  id: number
  sender_id: string
  receiver_id: string
  message: string
  created_at: string
}

export default function ChatScreen() {
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName: string }>()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    if (!user?.id || !patientId) return

    fetchMessages()
    markMessagesAsRead()

    // Subscribe to new messages
    const subscription = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.sender_id === patientId) {
            setMessages((prev) => [...prev, payload.new as Message])
            markMessagesAsRead()
          }
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, patientId])

  const fetchMessages = async () => {
    if (!user?.id || !patientId) return

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${patientId}),and(sender_id.eq.${patientId},receiver_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error("Error fetching messages:", error)
    } finally {
      setLoading(false)
    }
  }

  const markMessagesAsRead = async () => {
    if (!user?.id || !patientId) return

    try {
      await supabase
        .from("messages")
        .update({ read: true })
        .eq("sender_id", patientId)
        .eq("receiver_id", user.id)
        .eq("read", false)
    } catch (error) {
      console.error("Error marking messages as read:", error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !patientId) return

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            sender_id: user.id,
            receiver_id: patientId,
            message: newMessage.trim(),
            read: false,
          },
        ])
        .select()

      if (error) throw error

      if (data && data[0]) {
        setMessages((prev) => [...prev, data[0] as Message])
        setNewMessage("")

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true })
        }, 100)
      }
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{patientName}</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMe = item.sender_id === user?.id
            return (
              <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                  {item.message}
                </Text>
                <Text style={styles.messageTime}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            )
          }}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim()}
          >
            <Ionicons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  messagesList: {
    padding: 16,
    paddingBottom: 16,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#4a90e2",
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: "#fff",
  },
  theirMessageText: {
    color: "#333",
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
    opacity: 0.7,
    color: "#f0f0f0",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  input: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4a90e2",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#b0c4de",
  },
})

