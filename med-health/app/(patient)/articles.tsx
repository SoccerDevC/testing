import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  Modal,
  ScrollView
} from 'react-native';
import { useAuth } from '../../context/auth-context';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

type Article = {
  id: number;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
  doctor_id: string;
  doctor_name?: string;
  doctor_specialty?: string;
};

export default function PatientArticlesScreen() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select(`
          *,
          users:doctor_id (name),
          doctors:doctor_id (specialty)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedArticles = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        image_url: item.image_url,
        created_at: item.created_at,
        doctor_id: item.doctor_id,
        doctor_name: item.users?.name,
        doctor_specialty: item.doctors?.specialty
      }));

      setArticles(formattedArticles);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArticlePress = (article: Article) => {
    setSelectedArticle(article);
    setModalVisible(true);
  };

  const renderArticleItem = ({ item }: { item: Article }) => (
    <TouchableOpacity 
      style={styles.articleCard}
      onPress={() => handleArticlePress(item)}
    >
      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.articleImage} resizeMode="cover" />
      )}
      <View style={styles.articleContent}>
        <Text style={styles.articleTitle}>{item.title}</Text>
        <View style={styles.articleMeta}>
          <Text style={styles.doctorName}>By {item.doctor_name || 'Unknown Doctor'}</Text>
          <Text style={styles.articleDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.articlePreview} numberOfLines={3}>
          {item.content}
        </Text>
        <Text style={styles.readMore}>Read more</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Health Articles</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderArticleItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No articles available</Text>
            </View>
          }
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        {selectedArticle && (
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Article</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView style={styles.modalBody}>
                {selectedArticle.image_url && (
                  <Image 
                    source={{ uri: selectedArticle.image_url }} 
                    style={styles.modalImage} 
                    resizeMode="cover" 
                  />
                )}
                <Text style={styles.modalArticleTitle}>{selectedArticle.title}</Text>
                <View style={styles.modalArticleMeta}>
                  <Text style={styles.modalDoctorName}>
                    By {selectedArticle.doctor_name || 'Unknown Doctor'}
                    {selectedArticle.doctor_specialty && ` • ${selectedArticle.doctor_specialty}`}
                  </Text>
                  <Text style={styles.modalArticleDate}>
                    {new Date(selectedArticle.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.modalArticleContent}>{selectedArticle.content}</Text>
              </ScrollView>
            </View>
          </View>
        )}
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
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
  articleMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  doctorName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  articleDate: {
    fontSize: 12,
    color: '#999',
  },
  articlePreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  readMore: {
    fontSize: 14,
    color: '#4a90e2',
    fontWeight: '500',
    marginTop: 8,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    flex: 1,
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
    flex: 1,
  },
  modalImage: {
    width: '100%',
    height: 200,
  },
  modalArticleTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    margin: 16,
    marginBottom: 8,
  },
  modalArticleMeta: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  modalDoctorName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  modalArticleDate: {
    fontSize: 12,
    color: '#999',
  },
  modalArticleContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    margin: 16,
  },
});