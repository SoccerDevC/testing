import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  Modal, 
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/auth-context';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

type Appointment = {
  id: number;
  doctor_id: string;
  doctor_name: string;
  doctor_specialty?: string;
  date: string;
  status: string;
  payment_method: string | null;
};

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  experience: string;
};

export default function PatientBookingsScreen() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [appointmentDate, setAppointmentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'online_payment' | null>(null);

  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
  }, [user]);

  const fetchAppointments = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          doctor_id,
          date,
          status,
          payment_method,
          users:doctor_id (name),
          doctors:doctor_id (specialty)
        `)
        .eq('patient_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      const formattedAppointments = data.map((item: any) => ({
        id: item.id,
        doctor_id: item.doctor_id,
        doctor_name: item.users?.name || 'Unknown Doctor',
        doctor_specialty: item.doctors?.specialty,
        date: item.date,
        status: item.status,
        payment_method: item.payment_method,
      }));

      setAppointments(formattedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          doctors (specialty, experience)
        `)
        .eq('role', 'doctor');

      if (error) throw error;

      const formattedDoctors = data
        .filter((item: any) => item.doctors)
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          specialty: item.doctors.specialty,
          experience: item.doctors.experience,
        }));

      setDoctors(formattedDoctors);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleBookAppointment = () => {
    if (!selectedDoctor || !paymentMethod) {
      Alert.alert('Error', 'Please select a doctor and payment method');
      return;
    }

    // Ensure appointment is in the future
    const now = new Date();
    if (appointmentDate <= now) {
      Alert.alert('Error', 'Please select a future date and time');
      return;
    }

    Alert.alert(
      'Confirm Booking',
      `Book appointment with Dr. ${selectedDoctor.name} on ${appointmentDate.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: confirmBooking },
      ]
    );
  };

  const confirmBooking = async () => {
    if (!user?.id || !selectedDoctor) return;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert([
          {
            patient_id: user.id,
            doctor_id: selectedDoctor.id,
            date: appointmentDate.toISOString(),
            status: 'payment_pending',
            payment_method: paymentMethod,
          },
        ])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        const newAppointment: Appointment = {
          id: data[0].id,
          doctor_id: selectedDoctor.id,
          doctor_name: selectedDoctor.name,
          doctor_specialty: selectedDoctor.specialty,
          date: data[0].date,
          status: data[0].status,
          payment_method: data[0].payment_method,
        };

        setAppointments((prev) => [newAppointment, ...prev]);
        setShowBookingModal(false);
        resetBookingForm();
        Alert.alert('Success', 'Appointment booked successfully');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      Alert.alert('Error', 'Failed to book appointment');
    }
  };

  const resetBookingForm = () => {
    setSelectedDoctor(null);
    setAppointmentDate(new Date());
    setPaymentMethod(null);
  };

  const handleCancelAppointment = (appointmentId: number) => {
    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel this appointment?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => cancelAppointment(appointmentId),
      },
    ]);
  };

  const cancelAppointment = async (appointmentId: number) => {
    try {
      const { error } = await supabase.from('appointments').update({ status: 'canceled' }).eq('id', appointmentId);

      if (error) throw error;

      // Update local state
      setAppointments((prev) => prev.map((app) => (app.id === appointmentId ? { ...app, status: 'canceled' } : app)));

      Alert.alert('Success', 'Appointment canceled successfully');
    } catch (error) {
      console.error('Error canceling appointment:', error);
      Alert.alert('Error', 'Failed to cancel appointment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return '#4caf50';
      case 'rescheduled':
        return '#ff9800';
      case 'canceled':
        return '#f44336';
      case 'completed':
        return '#2196f3';
      case 'payment_pending':
        return '#9c27b0';
      case 'payment_completed':
        return '#009688';
      default:
        return '#757575';
    }
  };

  const renderAppointmentItem = ({ item }: { item: Appointment }) => (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <Text style={styles.doctorName}>{item.doctor_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>

      {item.doctor_specialty && (
        <Text style={styles.specialty}>{item.doctor_specialty}</Text>
      )}

      <View style={styles.appointmentDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color="#666" />
          <Text style={styles.detailText}>{new Date(item.date).toLocaleDateString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color="#666" />
          <Text style={styles.detailText}>
            {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {item.payment_method && (
          <View style={styles.detailRow}>
            <Ionicons name="card" size={16} color="#666" />
            <Text style={styles.detailText}>
              {item.payment_method === 'mobile_money' ? 'Mobile Money' : 'Online Payment'}
            </Text>
          </View>
        )}
      </View>

      {(item.status === 'upcoming' || item.status === 'rescheduled' || item.status === 'payment_pending') && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => handleCancelAppointment(item.id)}
        >
          <Ionicons name="close-circle" size={16} color="#fff" />
          <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Appointments</Text>
        <TouchableOpacity style={styles.bookButton} onPress={() => setShowBookingModal(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderAppointmentItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No appointments found</Text>
              <TouchableOpacity
                style={styles.bookNowButton}
                onPress={() => setShowBookingModal(true)}
              >
                <Text style={styles.bookNowText}>Book Now</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Booking Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showBookingModal}
        onRequestClose={() => setShowBookingModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book Appointment</Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.sectionTitle}>Select Doctor</Text>
              <View style={styles.doctorsList}>
                {doctors.map((doctor) => (
                  <TouchableOpacity
                    key={doctor.id}
                    style={[
                      styles.doctorItem,
                      selectedDoctor?.id === doctor.id && styles.selectedDoctorItem,
                    ]}
                    onPress={() => setSelectedDoctor(doctor)}
                  >
                    <View style={styles.doctorAvatar}>
                      <Text style={styles.doctorAvatarText}>{doctor.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.doctorItemInfo}>
                      <Text style={styles.doctorItemName}>{doctor.name}</Text>
                      <Text style={styles.doctorItemSpecialty}>{doctor.specialty}</Text>
                    </View>
                    {selectedDoctor?.id === doctor.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#4a90e2" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Select Date & Time</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color="#4a90e2" />
                <Text style={styles.datePickerButtonText}>
                  {appointmentDate.toLocaleString()}
                </Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Payment Method</Text>
              <View style={styles.paymentOptions}>
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === 'mobile_money' && styles.selectedPaymentOption,
                  ]}
                  onPress={() => setPaymentMethod('mobile_money')}
                >
                  <Ionicons
                    name="phone-portrait"
                    size={24}
                    color={paymentMethod === 'mobile_money' ? '#fff' : '#4a90e2'}
                  />
                  <Text
                    style={[
                      styles.paymentOptionText,
                      paymentMethod === 'mobile_money' && styles.selectedPaymentOptionText,
                    ]}
                  >
                    Mobile Money
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === 'online_payment' && styles.selectedPaymentOption,
                  ]}
                  onPress={() => setPaymentMethod('online_payment')}
                >
                  <Ionicons
                    name="card"
                    size={24}
                    color={paymentMethod === 'online_payment' ? '#fff' : '#4a90e2'}
                  />
                  <Text
                    style={[
                      styles.paymentOptionText,
                      paymentMethod === 'online_payment' && styles.selectedPaymentOptionText,
                    ]}
                  >
                    Online Payment
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.bookAppointmentButton}
              onPress={handleBookAppointment}
            >
              <Text style={styles.bookAppointmentButtonText}>Book Appointment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={appointmentDate}
          mode="datetime"
          display="spinner"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setAppointmentDate(selectedDate);
          }}
        />
      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  bookButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  specialty: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  appointmentDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  cancelButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
  },
  bookNowButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  bookNowText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 16,
  },
  doctorsList: {
    marginBottom: 16,
  },
  doctorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedDoctorItem: {
    borderColor: '#4a90e2',
    backgroundColor: '#f0f8ff',
  },
  doctorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  doctorItemInfo: {
    flex: 1,
  },
  doctorItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  doctorItemSpecialty: {
    fontSize: 14,
    color: '#666',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#4a90e2',
    borderRadius: 8,
    marginBottom: 16,
  },
  datePickerButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#4a90e2',
    borderRadius: 8,
    justifyContent: 'center',
  },
  selectedPaymentOption: {
    backgroundColor: '#4a90e2',
  },
  paymentOptionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4a90e2',
    fontWeight: '500',
  },
  selectedPaymentOptionText: {
    color: '#fff',
  },
  bookAppointmentButton: {
    backgroundColor: '#4a90e2',
    padding: 16,
    alignItems: 'center',
  },
  bookAppointmentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});