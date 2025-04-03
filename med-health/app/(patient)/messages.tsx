import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/auth-context';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type Doctor = {
  id: string;
  name: string;
  specialty?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  hasUnread: boolean;
};

export default function PatientMessagesScreen() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchDoctors();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDoctors(doctors);
    } else {
      const filtered = doctors.filter(doctor => 
        doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doctor.specialty && doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredDoctors(filtered);
    }
  }, [searchQuery, doctors]);

  const fetchDoctors = async () => {
    if (!user?.id) return;

    try {
      // Get all doctors from the database
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('users')
        .select(`
          id, 
          name,
          doctors (specialty)
        `)
        .eq('role', 'doctor');

      if (doctorsError) throw doctorsError;

      // Get last messages for each doctor
      const doctorsList = await Promise.all(
        doctorsData.map(async (doctor: any) => {
          // Get the last message between patient and doctor
          const { data: messageData, error: messageError } = await supabase
            .from('messages')
            .select('message, created_at, read')
            .or(`sender_id.eq.${doctor.id},receiver_id.eq.${doctor.id}`)
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(1);

          if (messageError) throw messageError;

          // Check if there are any unread messages from this doctor
          const { count, error: unreadError } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('sender_id', doctor.id)
            .eq('receiver_id', user.id)
            .eq('read', false);

          if (unreadError) throw unreadError;

          return {
            id: doctor.id,
            name: doctor.name,
            specialty: doctor.doctors?.specialty,
            lastMessage: messageData[0]?.message,
            lastMessageTime: messageData[0]?.created_at,
            hasUnread: count ? count > 0 : false
          };
        })
      );

      // Sort doctors: those with unread messages first, then by last message time
      const sortedDoctors = doctorsList.sort((a: any, b: any) => {
        if (a.hasUnread && !b.hasUnread) return -1;
        if (!a.hasUnread && b.hasUnread) return 1;
        
        if (a.lastMessageTime && b.lastMessageTime) {
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        }
        
        return 0;
      });

      setDoctors(sortedDoctors);
      setFilteredDoctors(sortedDoctors);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToChat = (doctorId: string, doctorName: string) => {
    router.push({
      pathname: '/(patient)/chat',
      params: { doctorId, doctorName }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search doctors..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
        </View>
      ) : (
        <FlatList
          data={filteredDoctors}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.doctorCard}
              onPress={() => navigateToChat(item.id, item.name)}
            >
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
                {item.hasUnread && <View style={styles.unreadBadge} />}
              </View>
              <View style={styles.doctorInfo}>
                <Text style={styles.doctorName}>{item.name}</Text>
                {item.specialty && (
                  <Text style={styles.specialty}>{item.specialty}</Text>
                )}
                {item.lastMessage ? (
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                ) : (
                  <Text style={styles.noMessages}>No messages yet</Text>
                )}
              </View>
              {item.lastMessageTime && (
                <Text style={styles.timeText}>
                  {new Date(item.lastMessageTime).toLocaleDateString()}
                </Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No doctors found</Text>
            </View>
          }
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ff6b6b',
    borderWidth: 2,
    borderColor: '#fff',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  specialty: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  noMessages: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});