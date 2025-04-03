import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { useAuth } from '../../context/auth-context';
import { supabase } from '../../lib/supabase';
import {
  Ionicons,
} from '@expo/vector-icons';

type Article = {
  id: number;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
};

export default function DoctorArticlesScreen() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    fetchArticles();
  }, [user]);

  const fetchArticles = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddArticle = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('articles')
        .insert([
          {
            doctor_id: user?.id,
            title: title.trim(),
            content: content.trim(),
            image_url: imageUrl.trim() || null,
          },
        ])
        .select();

      if (error) throw error;

      if (data) {
        setArticles((prev) => [data[0], ...prev]);
        setModalVisible(false);
        resetForm();
        Alert.alert('Success', 'Article published successfully');
      }
    } catch (error) {
      console.error('Error adding article:', error);
      Alert.alert('Error', 'Failed to publish article');
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setImageUrl('');
  };

  const renderArticleItem = ({ item }: { item: Article }) => (
    <View style={styles.articleCard}>
      {item.image_url && <Image source={{ uri: item.image_url }} style={styles.articleImage} resizeMode="cover" />}
      <View style={styles.articleContent}>
        <Text style={styles.articleTitle}>{item.title}</Text>
        <Text style={styles.articleDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        <Text style={styles.articleText} numberOfLines={3}>
          {item.content}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Articles</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={articles}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderArticleItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No articles yet</Text>
            <Text style={styles.emptySubtext}>Share your medical knowledge by adding articles</Text>
          </View>
        }
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Article</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter article title"
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Content *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Write your article content here..."
                  value={content}
                  onChangeText={setContent}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Image URL (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter image URL"
                  value={imageUrl}
                  onChangeText={setImageUrl}
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.publishButton} onPress={handleAddArticle}>
              <Text style={styles.publishButtonText}>Publish Article</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  articleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  articleImage: {
    width: '100%',
    height: 180,
  },
  articleContent: {
    padding: 16,
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  articleDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  articleText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
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
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 150,
  },
  publishButton: {
    backgroundColor: '#4a90e2',
    padding: 16,
    alignItems: 'center',
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});