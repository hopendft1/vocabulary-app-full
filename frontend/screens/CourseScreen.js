import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Button } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://vocabulary-app-full.onrender.com';

const CourseScreen = ({ route, navigation }) => {
  const { courseId, courseTitle, isOffline = false } = route.params;
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const WORDS_PER_PAGE = 100;

  useEffect(() => {
    fetchWords();
  }, [page, courseId, isOffline]);

  const fetchWords = async () => {
    try {
      setLoading(true);
      const skip = (page - 1) * WORDS_PER_PAGE;
      let fetchedWords = [];
      const courseDir = `${FileSystem.documentDirectory}courses/${courseId}/`;
      const fileExists = (await FileSystem.getInfoAsync(`${courseDir}words.json`)).exists;

      if (fileExists) {
        const wordsJson = await FileSystem.readAsStringAsync(`${courseDir}words.json`);
        fetchedWords = JSON.parse(wordsJson).words; // 假设包含 timestamp 的结构
        console.log('Loaded offline words:', fetchedWords);
      } else if (!isOffline) {
        const response = await fetch(`${API_URL}/words?course_id=${courseId}&skip=${skip}&limit=${WORDS_PER_PAGE}`);
        if (!response.ok) throw new Error('获取单词列表失败');
        fetchedWords = await response.json();
        console.log('Loaded online words:', fetchedWords);
      }

      const paginatedWords = fetchedWords.slice(skip, skip + WORDS_PER_PAGE);
      setWords(paginatedWords);
      setTotalPages(Math.ceil(fetchedWords.length / WORDS_PER_PAGE));
    } catch (error) {
      Alert.alert('错误', error.message);
    } finally {
      setLoading(false);
    }
  };

  const parseCSV = (content) => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV 文件为空或格式不正确');
    const headers = lines[0].split(',').map(header => header.trim());
    const words = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(value => value.trim());
      if (values.length < headers.length) continue;
      const word = { course_id: courseId };
      headers.forEach((header, index) => word[header] = values[index] || '');
      word.id = word.id || `${courseId}-${i}`;
      word.is_learned = false;
      word.is_difficult = false;
      words.push(word);
    }
    if (words.length === 0) throw new Error('CSV 文件中没有有效数据');
    return words;
  };



  const handleUploadCSV = async () => {
    try {
      console.log('Starting file picker...');
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true, // 让它直接访问原始文件
      });

      console.log('DocumentPicker result:', JSON.stringify(result, null, 2));
            
      console.log('DocumentPicker result:', result);
      if (result.canceled) {
        Alert.alert('取消', '文件选择已取消，请检查存储权限');
        return;
      }
  
      const asset = result.assets ? result.assets[0] : { uri: result.uri, name: result.name };
        console.log('Selected file:', asset);
  
      const fileContent = await FileSystem.readAsStringAsync(asset.uri);
      const words = parseCSV(fileContent);
      console.log('Parsed words:', words);
  
      const courseDir = `${FileSystem.documentDirectory}courses/${courseId}/`;
      await FileSystem.makeDirectoryAsync(courseDir, { intermediates: true });
      const uploadData = { words, timestamp: Date.now() };
      await FileSystem.writeAsStringAsync(`${courseDir}words.json`, JSON.stringify(uploadData));
      console.log('Saved to words.json:', uploadData);
  
      if (!isOffline) {
        const response = await fetch(`${API_URL}/words/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(words.map(word => ({
            course_id: courseId,
            word: word.word,
            pinyin: word.pinyin,
            definition: word.definition,
            example: word.example || '',
            audio_link: word.audio_link || '',
          }))),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`同步失败: ${errorText}`);
        }
        console.log('Words synced to server');
      }
  
      const downloadedCoursesJson = await AsyncStorage.getItem('downloadedCourses');
      let downloadedCourses = downloadedCoursesJson ? JSON.parse(downloadedCoursesJson) : [];
      if (!downloadedCourses.some(c => c.id === courseId)) {
        downloadedCourses.push({ id: courseId, title: courseTitle });
        await AsyncStorage.setItem('downloadedCourses', JSON.stringify(downloadedCourses));
      }
  
      Alert.alert('成功', 'CSV 上传并同步成功');
      setPage(1);
      await fetchWords();
    } catch (error) {
      console.error('Upload error:', error);
      const courseDir = `${FileSystem.documentDirectory}courses/${courseId}/`;
      await FileSystem.deleteAsync(`${courseDir}words.json`, { idempotent: true });
      Alert.alert('错误', `上传失败: ${error.message}`);
    }
  };

  const handleDeleteWord = async (wordId) => {
    Alert.alert('确认删除', '确定删除此单词？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isOffline) {
              const courseDir = `${FileSystem.documentDirectory}courses/${courseId}/`;
              const wordsJson = await FileSystem.readAsStringAsync(`${courseDir}words.json`);
              let data = JSON.parse(wordsJson);
              data.words = data.words.filter(word => word.id !== wordId);
              await FileSystem.writeAsStringAsync(`${courseDir}words.json`, JSON.stringify(data));
            } else {
              const response = await fetch(`${API_URL}/words/${wordId}`, { method: 'DELETE' });
              if (!response.ok) throw new Error('删除单词失败');
            }
            await fetchWords();
          } catch (error) {
            Alert.alert('错误', error.message);
          }
        },
      },
    ]);
  };

  const renderWordItem = ({ item }) => (
    <View style={styles.wordItem}>
      <TouchableOpacity style={styles.wordContent} onPress={() => navigation.navigate('WordDetail', { word: item })}>
        <Text style={styles.wordText}>{item.word}</Text>
        <Text style={styles.pinyinText}>{item.pinyin}</Text>
        <Text style={styles.definitionText} numberOfLines={2}>{item.definition}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteWord(item.id)}>
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );

  if (loading) return <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}><Text style={styles.emptyText}>加载中...</Text></LinearGradient>;

  return (
    <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{courseTitle}</Text>
        <Text style={styles.subtitle}>{words.length} 个单词</Text>
      </View>
      <Button title="上传 CSV" onPress={handleUploadCSV} />
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>单词列表</Text>
        {words.length > 0 ? (
          <>
            <FlatList data={words} renderItem={renderWordItem} keyExtractor={item => item.id.toString()} contentContainerStyle={styles.list} />
            <View style={styles.pagination}>
              <Button title="上一页" disabled={page === 1} onPress={() => setPage(page - 1)} />
              <Text style={styles.pageText}>第 {page} 页 / 共 {totalPages} 页</Text>
              <Button title="下一页" disabled={page === totalPages} onPress={() => setPage(page + 1)} />
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>没有单词。请上传 CSV 文件添加单词。</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#e0e0e0', marginTop: 4 },
  listContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 16, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  list: { paddingBottom: 20 },
  wordItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 10 },
  wordContent: { flex: 1 },
  wordText: { fontSize: 18, fontWeight: 'bold' },
  pinyinText: { fontSize: 14, color: '#4A90E2', marginVertical: 4 },
  definitionText: { fontSize: 14, color: '#666' },
  deleteButton: { padding: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  pageText: { fontSize: 16, color: '#666' },
});

export default CourseScreen;