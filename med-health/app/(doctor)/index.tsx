import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useAuth } from '../../context/auth-context';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

type AppointmentData = {
  id: number;
  date: string;
  status: string;
  users: {
    name: string;
  } | null;
};

type Appointment = {
  id: number;
  patient_name: string;
  date: string;
  status: string;
};

type MessageData = {
  id: number;
  message: string;
  created_at: string;
  users: {
    name: string;
  } | null;
};

type Message = {
  id: number;
  sender_name: string;
  message: string;
  created_at: string;
};

export default function DoctorHomeScreen() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!user?.id) return;

    try {
      // Fetch upcoming appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          date,
          status,
          users:patient_id (name)
        `)
        .eq('doctor_id', user.id)
        .in('status', ['upcoming', 'rescheduled'])
        .order('date', { ascending: true })
        .limit(5);

      if (appointmentsError) throw appointmentsError;

      // Fetch unread messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          message,
          created_at,
          users:sender_id (name)
        `)
        .eq('receiver_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (messagesError) throw messagesError;

      // Count total patients who have appointments with this doctor
      const { count, error: countError } = await supabase
        .from('appointments')
        .select('patient_id', { count: 'exact', head: true })
        .eq('doctor_id', user.id);

      if (countError) throw countError;

      // Format the data
      const formattedAppointments = (appointmentsData as AppointmentData[]).map(item => ({
        id: item.id,
        patient_name: item.users?.name || 'Unknown Patient',
        date: new Date(item.date).toLocaleString(),
        status: item.status
      }));

      const formattedMessages = (messagesData as MessageData[]).map(item => ({
        id: item.id,
        sender_name: item.users?.name || 'Unknown Sender',
        message: item.message,
        created_at: new Date(item.created_at).toLocaleString()
      }));

      setAppointments(formattedAppointments);
      setMessages(formattedMessages);
      setPatientCount(count || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome, {user?.name || 'Doctor'}</Text>
      </View>

      <FlatList
        data={[1]} // Just a dummy item to render the content once
        keyExtractor={() => 'main-content'}
        renderItem={({ item }: { item: number }) => (
          <View>
            {/* Stats Cards */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="people" size={24} color="#4a90e2" />
                <Text style={styles.statNumber}>{patientCount}</Text>
                <Text style={styles.statLabel}>Patients</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="calendar" size={24} color="#4a90e2" />
                <Text style={styles.statNumber}>{appointments.length}</Text>
                <Text style={styles.statLabel}>Upcoming</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="chatbubbles" size={24} color="#4a90e2" />
                <Text style={styles.statNumber}>{messages.length}</Text>
                <Text style={styles.statLabel}>Unread</Text>
              </View>
            </View>

            {/* Upcoming Appointments */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              
              {appointments.length > 0 ? (
                appointments.map(appointment => (
                  <View key={appointment.id} style={styles.appointmentCard}>
                    <View style={styles.appointmentInfo}>
                      <Text style={styles.patientName}>{appointment.patient_name}</Text>
                      <Text style={styles.appointmentDate}>{appointment.date}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge, 
                      { backgroundColor: appointment.status === 'upcoming' ? '#e3f2fd' : '#fff9c4' }
                    ]}>
                      <Text style={[
                        styles.statusText, 
                        { color: appointment.status === 'upcoming' ? '#1976d2' : '#ffa000' }
                      ]}>
                        {appointment.status === 'upcoming' ? 'Upcoming' : 'Rescheduled'}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No upcoming appointments</Text>
              )}
            </View>

            {/* Recent Messages */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Messages</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              
              {messages.length > 0 ? (
                messages.map(message => (
                  <View key={message.id} style={styles.messageCard}>
                    <View style={styles.messageInfo}>
                      <Text style={styles.senderName}>{message.sender_name}</Text>
                      <Text style={styles.messagePreview} numberOfLines={1}>
                        {message.message}
                      </Text>
                    </View>
                    <Text style={styles.messageTime}>
                      {new Date(message.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No unread messages</Text>
              )}
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4a90e2',
    padding: 20,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: -30,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '30%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  sectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    marginTop: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4a90e2',
  },
  appointmentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  appointmentInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  appointmentDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  messageInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  messagePreview: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 16,
  },
});