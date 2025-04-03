import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { decode } from 'base64-arraybuffer';

type Message = {
  id: number;
  sender_id: string;
  receiver_id: string;
  message: string;
  media_url?: string;
  media_type?: 'image' | 'video' | 'audio';
  created_at: string;
};

export default function DoctorChatScreen() {
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user?.id || !patientId) return;

    fetchMessages();
    markMessagesAsRead();

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
        (payload: any) => {
          if (payload.new.sender_id === patientId) {
            setMessages((prev) => [...prev, payload.new as Message]);
            markMessagesAsRead();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      if (recording) {
        stopRecording();
      }
    };
  }, [user, patientId]);

  const fetchMessages = async () => {
    if (!user?.id || !patientId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${patientId}),and(sender_id.eq.${patientId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user?.id || !patientId) return;

    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', patientId)
        .eq('receiver_id', user.id)
        .eq('read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !patientId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: user.id,
            receiver_id: patientId,
            message: newMessage.trim(),
            read: false,
          },
        ])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setMessages((prev) => [...prev, data[0] as Message]);
        setNewMessage('');

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await uploadAndSendMedia(
          asset.uri, 
          asset.type === 'video' ? 'video' : 'image'
        );
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      if (uri) {
        await uploadAndSendMedia(uri, 'audio');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const uploadAndSendMedia = async (uri: string, mediaType: 'image' | 'video' | 'audio') => {
    if (!user?.id || !patientId) return;
    
    setSendingMedia(true);
    
    try {
      const filename = uri.split('/').pop() || '';
      const extension = filename.split('.').pop()?.toLowerCase() || '';
      const contentType = 
        mediaType === 'image' ? `image/${extension === 'jpg' ? 'jpeg' : extension}` :
        mediaType === 'video' ? `video/${extension}` :
        `audio/${extension === 'caf' ? 'x-caf' : extension}`;
      
      // Fetch the file
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Convert to base64 for Supabase storage
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      const base64File = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            // Remove the data URL prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          } else {
            reject(new Error('Failed to convert file to base64'));
          }
        };
        reader.onerror = reject;
      });
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(
          `${user.id}/${Date.now()}-${filename}`,
          decode(base64File),
          { contentType }
        );
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = await supabase.storage
        .from('chat-media')
        .getPublicUrl(uploadData.path);
      
      // Send message with media
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: user.id,
            receiver_id: patientId,
            message: mediaType === 'audio' ? '🎤 Audio message' : 
                     mediaType === 'video' ? '🎬 Video' : '📷 Image',
            media_url: urlData.publicUrl,
            media_type: mediaType,
            read: false,
          },
        ])
        .select();
      
      if (error) throw error;
      
      if (data && data[0]) {
        setMessages((prev) => [...prev, data[0] as Message]);
        
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error uploading media:', error);
      Alert.alert('Error', 'Failed to send media');
    } finally {
      setSendingMedia(false);
    }
  };

  const renderMessageContent = (item: Message) => {
    if (item.media_type === 'image' && item.media_url) {
      return (
        <Image 
          source={{ uri: item.media_url }} 
          style={styles.mediaImage} 
          resizeMode="cover"
        />
      );
    } else if (item.media_type === 'video' && item.media_url) {
      return (
        <View style={styles.videoContainer}>
          <Ionicons name="videocam" size={40} color="#fff" />
          <Text style={styles.videoText}>Video</Text>
          <TouchableOpacity style={styles.playButton}>
            <Ionicons name="play-circle" size={50} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    } else if (item.media_type === 'audio' && item.media_url) {
      return (
        <View style={styles.audioContainer}>
          <Ionicons name="musical-note" size={24} color="#fff" />
          <Text style={styles.audioText}>Audio Message</Text>
          <TouchableOpacity style={styles.playAudioButton}>
            <Ionicons name="play" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <Text style={[
          styles.messageText, 
          item.sender_id === user?.id ? styles.myMessageText : styles.theirMessageText
        ]}>
          {item.message}
        </Text>
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{patientName}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4a90e2" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isMe = item.sender_id === user?.id;
              return (
                <View style={[
                  styles.messageBubble, 
                  isMe ? styles.myMessage : styles.theirMessage,
                  item.media_type ? styles.mediaBubble : null
                ]}>
                  {renderMessageContent(item)}
                  <Text style={[
                    styles.messageTime,
                    isMe ? styles.myMessageTime : styles.theirMessageTime
                  ]}>
                    {new Date(item.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Text>
                </View>
              );
            }}
          />
        )}

        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
              <Ionicons name="image" size={24} color="#4a90e2" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.mediaButton}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Ionicons 
                name="mic" 
                size={24} 
                color={isRecording ? "#FF5252" : "#4a90e2"} 
              />
            </TouchableOpacity>
            
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              editable={!sendingMedia}
            />
            
            {sendingMedia ? (
              <View style={styles.sendButton}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || sendingMedia}
              >
                <Ionicons name="send" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording audio...</Text>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
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
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  mediaBubble: {
    padding: 4,
    overflow: 'hidden',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4a90e2',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
    opacity: 0.7,
  },
  myMessageTime: {
    color: '#f0f0f0',
  },
  theirMessageTime: {
    color: '#999',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  mediaButton: {
    padding: 8,
    marginRight: 4,
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    marginRight: 8,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#b0c4de',
  },
  mediaImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  videoContainer: {
    width: 200,
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoText: {
    color: '#fff',
    marginTop: 8,
  },
  playButton: {
    position: 'absolute',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  audioText: {
    color: '#fff',
    marginLeft: 8,
    marginRight: 8,
  },
  playAudioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#ffebee',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5252',
    marginRight: 8,
  },
  recordingText: {
    color: '#FF5252',
    fontSize: 14,
  },
});
