import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CSVImport from '../components/CSVImport';

const API_URL = 'http://192.168.0.176:8000'; // For Android emulator

const CourseScreen = ({ route, navigation }) => {
  const { courseId, courseTitle } = route.params;
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWords();
  }, []);

  const fetchWords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/words?course_id=${courseId}`);
      
      if (!response.ok) {
        throw new Error('获取单词列表失败');
      }
      
      const data = await response.json();
      setWords(data);
    } catch (error) {
      Alert.alert('错误', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportSuccess = () => {
    fetchWords();
  };

  const handleWordPress = (word) => {
    navigation.navigate('WordDetail', { word });
  };

  const renderWordItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.wordItem} 
      onPress={() => handleWordPress(item)}
    >
      <Text style={styles.wordText}>{item.word}</Text>
      <Text style={styles.pinyinText}>{item.pinyin}</Text>
      <Text style={styles.definitionText} numberOfLines={2}>{item.definition}</Text>
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={['#4B79A1', '#283E51']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{courseTitle}</Text>
        <Text style={styles.subtitle}>
          {words.length} 个单词
        </Text>
      </View>

      <CSVImport courseId={courseId} onImportSuccess={handleImportSuccess} />

      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>单词列表</Text>
        {words.length > 0 ? (
          <FlatList
            data={words}
            renderItem={renderWordItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              没有单词。请导入CSV文件添加单词。
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e0e0',
    marginTop: 4,
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  list: {
    paddingBottom: 20,
  },
  wordItem: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  wordText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pinyinText: {
    fontSize: 14,
    color: '#4A90E2',
    marginVertical: 4,
  },
  definitionText: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default CourseScreen;
