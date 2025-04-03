import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

type PatientChat = {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
};

export default function MessagesScreen() {
  const { user } = useAuth();
  const [chats, setChats] = useState<PatientChat[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (user?.id) {
      fetchChats();
      
      // Subscribe to new messages
      const subscription = supabase
        .channel('messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`,
          },
          () => {
            fetchChats(); // Refresh the list when new messages arrive
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchChats = async () => {
    if (!user?.id) return;
    
    try {
      // Get all patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'patient');
      
      if (patientsError) throw patientsError;
      
      // Get unread message counts for each patient
      const patientIds = patientsData?.map(p => p.id) || [];
      const unreadCounts = await Promise.all(
        patientIds.map(async (patientId) => {
          const { count, error } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', patientId)
            .eq('receiver_id', user.id)
            .eq('read', false);
          
          if (error) return { patientId, count: 0 };
          return { patientId, count: count || 0 };
        })
      );
      
      // Create a map of unread counts
      const unreadCountMap = new Map();
      unreadCounts.forEach(item => {
        unreadCountMap.set(item.patientId, item.count);
      });
      
      // Get last message for each patient
      const lastMessages = await Promise.all(
        patientIds.map(async (patientId) => {
          const { data, error } = await supabase
            .from('messages')
            .select('message, created_at')
            .or(
              `and(sender_id.eq.${user.id},receiver_id.eq.${patientId}),and(sender_id.eq.${patientId},receiver_id.eq.${user.id})`
            )
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (error || !data || data.length === 0) return { patientId, lastMessage: null, lastMessageTime: null };
          return { 
            patientId, 
            lastMessage: data[0].message, 
            lastMessageTime: data[0].created_at 
          };
        })
      );
      
      // Create a map of last messages
      const lastMessageMap = new Map();
      lastMessages.forEach(item => {
        if (item.lastMessage) {
          lastMessageMap.set(item.patientId, {
            message: item.lastMessage,
            time: item.lastMessageTime
          });
        }
      });
      
      // Combine all data
      const chatsWithDetails = patientsData?.map(patient => ({
        id: patient.id,
        name: patient.name,
        lastMessage: lastMessageMap.get(patient.id)?.message || 'No messages yet',
        lastMessageTime: lastMessageMap.get(patient.id)?.time || '',
        unreadCount: unreadCountMap.get(patient.id) || 0
      })) || [];
      
      // Sort by unread count (desc) and then by last message time (desc)
      chatsWithDetails.sort((a, b) => {
        if (a.unreadCount !== b.unreadCount) {
          return b.unreadCount - a.unreadCount;
        }
        
        if (a.lastMessageTime && b.lastMessageTime) {
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        }
        
        return 0;
      });
      
      setChats(chatsWithDetails);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToChat = (patientId: string, patientName: string) => {
    router.push({
      pathname: '/doctor/chat',
      params: { patientId, patientName }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>
      
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.chatItem}
            onPress={() => navigateToChat(item.id, item.name)}
          >
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.chatInfo}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatName}>{item.name}</Text>
                <Text style={styles.chatTime}>
                  {item.lastMessageTime ? new Date(item.lastMessageTime).toLocaleDateString() : ''}
                </Text>
              </View>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No messages yet</Text>
          </View>
        }
      />
    </SafeAreaView>
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
    padding: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF5252',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
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
  },
});