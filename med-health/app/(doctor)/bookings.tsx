"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native"
import { useAuth } from "../../context/auth-context"
import { supabase } from "../../lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"

type Appointment = {
  id: number
  patient_id: string
  patient_name: string
  date: string
  status: string
  payment_method: string | null
}

export default function DoctorBookingsScreen() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [newDate, setNewDate] = useState(new Date())

  useEffect(() => {
    fetchAppointments()
  }, [user])

  const fetchAppointments = async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          patient_id,
          date,
          status,
          payment_method,
          users:patient_id (name)
        `)
        .eq("doctor_id", user.id)
        .order("date", { ascending: true })

      if (error) throw error

      const formattedAppointments = data.map((item) => ({
        id: item.id,
        patient_id: item.patient_id,
        patient_name: item.users?.name || "Unknown Patient",
        date: item.date,
        status: item.status,
        payment_method: item.payment_method,
      }))

      setAppointments(formattedAppointments)
    } catch (error) {
      console.error("Error fetching appointments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setNewDate(new Date(appointment.date))
    setShowDatePicker(true)
  }

  const confirmReschedule = async () => {
    if (!selectedAppointment) return

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          date: newDate.toISOString(),
          status: "rescheduled",
        })
        .eq("id", selectedAppointment.id)

      if (error) throw error

      // Update local state
      setAppointments((prev) =>
        prev.map((app) =>
          app.id === selectedAppointment.id ? { ...app, date: newDate.toISOString(), status: "rescheduled" } : app,
        ),
      )

      Alert.alert("Success", "Appointment rescheduled successfully")
    } catch (error) {
      console.error("Error rescheduling appointment:", error)
      Alert.alert("Error", "Failed to reschedule appointment")
    }
  }

  const handleCancel = (appointment: Appointment) => {
    Alert.alert("Cancel Appointment", "Are you sure you want to cancel this appointment?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: () => cancelAppointment(appointment.id),
      },
    ])
  }

  const cancelAppointment = async (appointmentId: number) => {
    try {
      const { error } = await supabase.from("appointments").update({ status: "canceled" }).eq("id", appointmentId)

      if (error) throw error

      // Update local state
      setAppointments((prev) => prev.map((app) => (app.id === appointmentId ? { ...app, status: "canceled" } : app)))

      Alert.alert("Success", "Appointment canceled successfully")
    } catch (error) {
      console.error("Error canceling appointment:", error)
      Alert.alert("Error", "Failed to cancel appointment")
    }
  }

  const handleCompletePayment = (appointment: Appointment) => {
    Alert.alert("Complete Payment", "Mark this appointment as payment completed?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        onPress: () => completePayment(appointment.id),
      },
    ])
  }

  const completePayment = async (appointmentId: number) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "payment_completed" })
        .eq("id", appointmentId)

      if (error) throw error

      // Update local state
      setAppointments((prev) =>
        prev.map((app) => (app.id === appointmentId ? { ...app, status: "payment_completed" } : app)),
      )

      Alert.alert("Success", "Payment marked as completed")
    } catch (error) {
      console.error("Error updating payment status:", error)
      Alert.alert("Error", "Failed to update payment status")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming":
        return "#4caf50"
      case "rescheduled":
        return "#ff9800"
      case "canceled":
        return "#f44336"
      case "completed":
        return "#2196f3"
      case "payment_pending":
        return "#9c27b0"
      case "payment_completed":
        return "#009688"
      default:
        return "#757575"
    }
  }

  const renderAppointmentItem = ({ item }: { item: Appointment }) => (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <Text style={styles.patientName}>{item.patient_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace("_", " ").toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.appointmentDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color="#666" />
          <Text style={styles.detailText}>{new Date(item.date).toLocaleDateString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color="#666" />
          <Text style={styles.detailText}>
            {new Date(item.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        {item.payment_method && (
          <View style={styles.detailRow}>
            <Ionicons name="card" size={16} color="#666" />
            <Text style={styles.detailText}>
              {item.payment_method === "mobile_money" ? "Mobile Money" : "Online Payment"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        {item.status !== "canceled" && item.status !== "completed" && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.rescheduleButton]}
              onPress={() => handleReschedule(item)}
            >
              <Ionicons name="calendar" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Reschedule</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => handleCancel(item)}>
              <Ionicons name="close-circle" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {item.status === "payment_pending" && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleCompletePayment(item)}
          >
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Complete Payment</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Appointments</Text>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderAppointmentItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No appointments found</Text>
          </View>
        }
      />

      {showDatePicker && (
        <View style={styles.datePickerContainer}>
          <View style={styles.datePickerHeader}>
            <Text style={styles.datePickerTitle}>Reschedule Appointment</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={newDate}
            mode="datetime"
            display="spinner"
            onChange={(event, selectedDate) => {
              if (selectedDate) setNewDate(selectedDate)
            }}
          />

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => {
              confirmReschedule()
              setShowDatePicker(false)
            }}
          >
            <Text style={styles.confirmButtonText}>Confirm New Time</Text>
          </TouchableOpacity>
        </View>
      )}
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
  listContainer: {
    padding: 16,
  },
  appointmentCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  patientName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  appointmentDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#666",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  rescheduleButton: {
    backgroundColor: "#4a90e2",
  },
  cancelButton: {
    backgroundColor: "#f44336",
  },
  completeButton: {
    backgroundColor: "#4caf50",
  },
  actionButtonText: {
    color: "#fff",
    marginLeft: 4,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 16,
  },
  datePickerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  confirmButton: {
    backgroundColor: "#4a90e2",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
})

