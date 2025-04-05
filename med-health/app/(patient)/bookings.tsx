import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function BookAppointment() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'doctor');

    if (error) {
      Alert.alert('Error', 'Failed to fetch doctors');
      console.error(error);
    } else {
      setDoctors(data || []);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !date || !paymentMethod) {
      return Alert.alert('Error', 'Please fill in all fields.');
    }

    setLoading(true);

    const { error } = await supabase.from('appointments').insert([
      {
        patient_id: user?.id,
        doctor_id: selectedDoctor,
        date: date.toISOString(),
        status: 'upcoming',
        payment_method: paymentMethod,
      },
    ]);

    setLoading(false);

    if (error) {
      Alert.alert('Error', 'Failed to book appointment.');
      console.error(error);
    } else {
      Alert.alert('Success', 'Appointment booked successfully!');
      // optionally reset form here
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Book Appointment</Text>

      <Card style={{ marginBottom: 16 }}>
        <Text style={styles.label}>Select Doctor</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedDoctor}
            onValueChange={(value) => setSelectedDoctor(value)}
          >
            <Picker.Item label="-- Choose Doctor --" value="" />
            {doctors.map((doc) => (
              <Picker.Item key={doc.id} label={doc.name} value={doc.id} />
            ))}
          </Picker>
        </View>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Text style={styles.label}>Choose Date & Time</Text>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
          <Text>{date.toLocaleString()}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'inline' : 'spinner'}
            onChange={(event, selectedDate) => {
              // For Android, check if the user dismissed the picker
              if (Platform.OS === 'android' && event?.type === 'dismissed') {
                setShowDatePicker(false);
                return;
              }
              setShowDatePicker(false);
              if (selectedDate) {
                setDate(selectedDate);
              }
            }}
          />
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Text style={styles.label}>Payment Method</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={paymentMethod}
            onValueChange={(value) => setPaymentMethod(value)}
          >
            <Picker.Item label="Mobile Money" value="mobile_money" />
            <Picker.Item label="Online Payment" value="online_payment" />
          </Picker>
        </View>
      </Card>

      <Button
        title={loading ? 'Booking...' : 'Book Appointment'}
        onPress={handleBookAppointment}
        style={{ marginTop: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f6f8fa',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#222',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  dateButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    marginTop: 8,
  },
});
