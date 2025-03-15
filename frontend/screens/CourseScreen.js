import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Button } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system'


const API_URL = 'https://vocabulary-app-full.onrender.com';

const CourseScreen = ({ route, navigation }) => {
  const { courseId, courseTitle } = route.params;
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const WORDS_PER_PAGE = 100;

  useEffect(() => {
    fetchWords();
  }, [page]);

  const fetchWords = async () => {
    try {
      setLoading(true);
      const skip = (page - 1) * WORDS_PER_PAGE;
      const response = await fetch(`${API_URL}/words?course_id=${courseId}&skip=${skip}&limit=${WORDS_PER_PAGE}`);
      
      if (!response.ok) {
        throw new Error('获取单词列表失败');
      }
      
      const data = await response.json();
      setWords(data);

      const totalWordsResponse = await fetch(`${API_URL}/words?course_id=${courseId}`);
      const totalWordsData = await totalWordsResponse.json();
      const total = totalWordsData.length;
      setTotalPages(Math.ceil(total / WORDS_PER_PAGE));
    } catch (error) {
      Alert.alert('错误', error.message);
    } finally {
      setLoading(false);
    }
  };

  


const API_URL = 'https://vocabulary-app-full.onrender.com'; // Adjust this to your backend URL

const handleUploadCSV = async () => {
  try {
    console.log('Starting CSV upload process...');

    // Step 1: Pick the CSV file
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'text/comma-separated-values',
        'application/csv',
        'application/vnd.ms-excel',
        'application/octet-stream',
        'text/plain',
      ],
      copyToCacheDirectory: true,
    });

    console.log('Document Picker Result:', JSON.stringify(result, null, 2));

    if (result.canceled) {
      console.log('File selection canceled by user.');
      Alert.alert('提示', '文件选择已取消');
      return;
    }

    const asset = result.assets[0];
    const fileName = asset.name.toLowerCase();

    // Step 2: Validate file extension
    if (!fileName.endsWith('.csv')) {
      console.log('Invalid file type selected:', fileName);
      Alert.alert('错误', '请选择一个 CSV 文件');
      return;
    }

    // Step 3: Read file content (for debugging)
    const fileContent = await FileSystem.readAsStringAsync(asset.uri);
    console.log('File Content Preview (first 500 characters):', fileContent.substring(0, 500));

    // Step 4: Prepare FormData for upload
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      name: asset.name || 'uploaded_file.csv',
      type: 'text/csv',
    });

    const uploadUrl = `${API_URL}/courses/${courseId}/upload-csv`;
    console.log('Uploading to URL:', uploadUrl);

    // Step 5: Send the request and log the raw response
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // Log the HTTP status and headers
    console.log('Response Status:', response.status);
    console.log('Response Headers:', JSON.stringify([...response.headers], null, 2));

    // Get the raw response text
    const responseText = await response.text();
    console.log('Raw Backend Response:', responseText);

    // Step 6: Check if the response is OK
    if (!response.ok) {
      console.log('Upload failed with status:', response.status);
      throw new Error(`Upload failed: ${responseText}`);
    }

    // Step 7: Try to parse the response as JSON
    try {
      const jsonResponse = JSON.parse(responseText);
      console.log('Parsed JSON Response:', JSON.stringify(jsonResponse, null, 2));
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError.message);
      throw new Error(`JSON Parse Error: ${parseError.message}`);
    }

    // Step 8: If everything is good, show success
    Alert.alert('成功', 'CSV 上传成功');
    fetchWords(); // Refresh the word list (assuming this is a function in your component)

  } catch (error) {
    console.error('Upload Error:', error.message);
    Alert.alert('错误', '上传失败: ' + error.message);
  }
};
  
  

  const handleDeleteWord = async (wordId) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个单词吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/words/${wordId}`, {
                method: 'DELETE',
              });

              if (!response.ok) {
                throw new Error('删除单词失败');
              }

              fetchWords(); // 刷新单词列表
            } catch (error) {
              Alert.alert('错误', error.message);
            }
          },
        },
      ]
    );
  };

  const handleWordPress = (word) => {
    navigation.navigate('WordDetail', { word });
  };

  const renderWordItem = ({ item }) => (
    <View style={styles.wordItem}>
      <TouchableOpacity 
        style={styles.wordContent}
        onPress={() => handleWordPress(item)}
      >
        <Text style={styles.wordText}>{item.word}</Text>
        <Text style={styles.pinyinText}>{item.pinyin}</Text>
        <Text style={styles.definitionText} numberOfLines={2}>{item.definition}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteWord(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </View>
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

      <Button title="上传 CSV" onPress={handleUploadCSV} />

      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>单词列表</Text>
        {words.length > 0 ? (
          <>
            <FlatList
              data={words}
              renderItem={renderWordItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.list}
            />
            <View style={styles.pagination}>
              <Button
                title="上一页"
                disabled={page === 1}
                onPress={() => setPage(page - 1)}
              />
              <Text style={styles.pageText}>第 {page} 页 / 共 {totalPages} 页</Text>
              <Button
                title="下一页"
                disabled={page === totalPages}
                onPress={() => setPage(page + 1)}
              />
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              没有单词。请上传 CSV 文件添加单词。
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  wordContent: {
    flex: 1,
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
  deleteButton: {
    padding: 8,
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
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  pageText: {
    fontSize: 16,
    color: '#666',
  },
});

export default CourseScreen;