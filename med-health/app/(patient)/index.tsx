import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/auth-context';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";

type VerificationData = {
  medical_history: string;
  allergies: string;
  current_medications: string;
  emergency_contact: string;
  verified: boolean;
};

export default function PatientHomeScreen() {
  const { user } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [verificationData, setVerificationData] = useState<VerificationData>({
    medical_history: '',
    allergies: '',
    current_medications: '',
    emergency_contact: '',
    verified: false
  });
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const router = useRouter();

  
  useEffect(() => {
    if (user?.id) {
      checkVerificationStatus();
      fetchDashboardData();
    }
  }, [user]);

  const checkVerificationStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_verification')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setIsVerified(data.verified);
        setVerificationData({
          medical_history: data.medical_history || '',
          allergies: data.allergies || '',
          current_medications: data.current_medications || '',
          emergency_contact: data.emergency_contact || '',
          verified: data.verified
        });
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch upcoming appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          date,
          status,
          users:doctor_id (name)
        `)
        .eq('patient_id', user?.id)
        .in('status', ['upcoming', 'rescheduled'])
        .order('date', { ascending: true })
        .limit(3);

      if (appointmentsError) throw appointmentsError;

      // Count unread messages
      const { count, error: messagesError } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user?.id)
        .eq('read', false);

      if (messagesError) throw messagesError;

      setUpcomingAppointments(appointmentsData || []);
      setUnreadMessages(count || 0);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleVerificationSubmit = async () => {
    if (!verificationData.medical_history || !verificationData.emergency_contact) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('patient_verification')
        .upsert({
          id: user?.id,
          medical_history: verificationData.medical_history,
          allergies: verificationData.allergies,
          current_medications: verificationData.current_medications,
          emergency_contact: verificationData.emergency_contact,
          verified: false // Admin will verify later
        });

      if (error) throw error;

      Alert.alert(
        'Success', 
        'Your verification information has been submitted. A doctor will review your information shortly.'
      );
      setShowVerificationForm(false);
      checkVerificationStatus();
    } catch (error) {
      console.error('Error submitting verification:', error);
      Alert.alert('Error', 'Failed to submit verification information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome, {user?.name || 'Patient'}</Text>
      </View>

      {!isVerified && !showVerificationForm && (
        <View style={styles.verificationWarning}>
          <Ionicons name="alert-circle" size={24} color="#ff9800" />
          <Text style={styles.warningText}>
            Your account is not verified. Please complete your medical profile to access all features.
          </Text>
          <TouchableOpacity 
            style={styles.verifyButton}
            onPress={() => setShowVerificationForm(true)}
          >
            <Text style={styles.verifyButtonText}>Complete Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {showVerificationForm ? (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Medical Profile</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Medical History *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter your medical history"
              value={verificationData.medical_history}
              onChangeText={(text) => setVerificationData({...verificationData, medical_history: text})}
              multiline
              textAlignVertical="top"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Allergies (if any)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your allergies"
              value={verificationData.allergies}
              onChangeText={(text) => setVerificationData({...verificationData, allergies: text})}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Current Medications (if any)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your current medications"
              value={verificationData.current_medications}
              onChangeText={(text) => setVerificationData({...verificationData, current_medications: text})}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Emergency Contact *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter emergency contact information"
              value={verificationData.emergency_contact}
              onChangeText={(text) => setVerificationData({...verificationData, emergency_contact: text})}
            />
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowVerificationForm(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleVerificationSubmit}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="calendar" size={24} color="#4a90e2" />
              <Text style={styles.statNumber}>{upcomingAppointments.length}</Text>
              <Text style={styles.statLabel}>Appointments</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="chatbubbles" size={24} color="#4a90e2" />
              <Text style={styles.statNumber}>{unreadMessages}</Text>
              <Text style={styles.statLabel}>Unread</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name={isVerified ? "checkmark-circle" : "time"} size={24} color={isVerified ? "#4caf50" : "#ff9800"} />
              <Text style={styles.statLabel}>{isVerified ? "Verified" : "Pending"}</Text>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            
            {upcomingAppointments.length > 0 ? (
              upcomingAppointments.map((appointment: any) => (
                <View key={appointment.id} style={styles.appointmentCard}>
                  <View style={styles.appointmentInfo}>
                    <Text style={styles.doctorName}>{appointment.users?.name || 'Unknown Doctor'}</Text>
                    <Text style={styles.appointmentDate}>{new Date(appointment.date).toLocaleString()}</Text>
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

          <View style={styles.quickActionsContainer}>
            <Text style={styles.quickActionsTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>

                <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/book')} // or '/(tabs)/book' if it's nested
                >
                <Ionicons name="calendar" size={32} color="#4a90e2" />
                <Text style={styles.actionText}>Book Appointment</Text>
                </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="chatbubbles" size={32} color="#4a90e2" />
                <Text style={styles.actionText}>Message Doctor</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="document-text" size={32} color="#4a90e2" />
                <Text style={styles.actionText}>View Articles</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="medkit" size={32} color="#4a90e2" />
                <Text style={styles.actionText}>Medi Assist</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  verificationWarning: {
    backgroundColor: '#fff3e0',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'column',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  warningText: {
    fontSize: 14,
    color: '#e65100',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  verifyButton: {
    backgroundColor: '#ff9800',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  verifyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: '#333',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#4a90e2',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 8,
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
  doctorName: {
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
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 16,
  },
  quickActionsContainer: {
    margin: 16,
    marginTop: 8,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: '#fff',
    width: '48%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
});