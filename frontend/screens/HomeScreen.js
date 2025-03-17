import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, Button } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://vocabulary-app-full.onrender.com';

const HomeScreen = ({ navigation }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [downloadingCourseId, setDownloadingCourseId] = useState(null);
  const [downloadedCourses, setDownloadedCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        const downloadedCoursesJson = await AsyncStorage.getItem('downloadedCourses');
        setDownloadedCourses(downloadedCoursesJson ? JSON.parse(downloadedCoursesJson) : []);
        await fetchCourses();
        await loadSelectedCourse();
      } catch (error) {
        console.error('初始化错误:', error);
      } finally {
        setLoading(false);
      }
    };
    initialize();
    const unsubscribe = navigation.addListener('focus', initialize);
    return unsubscribe;
  }, [navigation]);

  const fetchCourses = async () => {
    try {
      const response = await fetch(`${API_URL}/courses`);
      if (!response.ok) throw new Error('获取课程列表失败');
      const data = await response.json();
      setCourses(data);
    } catch (error) {
      Alert.alert('错误', error.message);
    }
  };

  const loadSelectedCourse = async () => {
    try {
      const selectedCourseJson = await AsyncStorage.getItem('selectedCourse');
      if (selectedCourseJson) setSelectedCourse(JSON.parse(selectedCourseJson));
    } catch (error) {
      console.error('加载选中课程失败:', error);
    }
  };

  const selectCourse = async (courseId) => {
    try {
      const course = courses.find(c => c.id === courseId);
      if (!course) return Alert.alert('错误', '未找到课程');
      const courseToSelect = { id: course.id, title: course.title };
      await AsyncStorage.setItem('selectedCourse', JSON.stringify(courseToSelect));
      setSelectedCourse(courseToSelect);
      navigation.navigate('Course', {
        courseId,
        courseTitle: course.title,
        isOffline: downloadedCourses.some(c => c.id === courseId),
      });
    } catch (error) {
      Alert.alert('错误', '选择课程失败');
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim()) return Alert.alert('错误', '课程名称不能为空');
    try {
      const response = await fetch(`${API_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newCourseTitle }),
      });
      if (!response.ok) throw new Error('创建课程失败');
      const newCourse = await response.json();
      setModalVisible(false);
      setNewCourseTitle('');
      await fetchCourses();
      if (!selectedCourse) selectCourse(newCourse.id);
    } catch (error) {
      Alert.alert('错误', error.message);
    }
  };

  const handleDownloadCourse = async (courseId, courseTitle) => {
    try {
      setDownloadingCourseId(courseId);
      if (downloadedCourses.some(c => c.id === courseId)) {
        Alert.alert('提示', '课程已下载');
        return;
      }
      const response = await fetch(`${API_URL}/words?course_id=${courseId}`);
      if (!response.ok) throw new Error('获取单词失败');
      const words = await response.json();
      if (!Array.isArray(words) || words.length === 0) {
        Alert.alert('提示', '该课程无单词可下载');
        return;
      }

      const courseDir = `${FileSystem.documentDirectory}courses/${courseId}/`;
      await FileSystem.makeDirectoryAsync(courseDir, { intermediates: true });
      const downloadData = { words, timestamp: Date.now() };
      await FileSystem.writeAsStringAsync(`${courseDir}words.json`, JSON.stringify(downloadData));

      const updatedDownloadedCourses = [...downloadedCourses, { id: courseId, title: courseTitle }];
      setDownloadedCourses(updatedDownloadedCourses);
      await AsyncStorage.setItem('downloadedCourses', JSON.stringify(updatedDownloadedCourses));
      Alert.alert('成功', '课程已下载');
    } catch (error) {
      Alert.alert('错误', error.message);
    } finally {
      setDownloadingCourseId(null);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    Alert.alert('确认删除', '删除课程将删除所有词汇，是否继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${API_URL}/courses/${courseId}`, { method: 'DELETE' });
            const courseDir = `${FileSystem.documentDirectory}courses/${courseId}/`;
            await FileSystem.deleteAsync(courseDir, { idempotent: true });
            const updatedDownloaded = downloadedCourses.filter(c => c.id !== courseId);
            setDownloadedCourses(updatedDownloaded);
            await AsyncStorage.setItem('downloadedCourses', JSON.stringify(updatedDownloaded));
            if (selectedCourse?.id === courseId) {
              setSelectedCourse(null);
              await AsyncStorage.removeItem('selectedCourse');
            }
            await fetchCourses();
          } catch (error) {
            Alert.alert('错误', error.message);
          }
        },
      },
    ]);
  };

  const renderCourseItem = ({ item }) => {
    const isDownloaded = downloadedCourses.some(c => c.id === item.id);
    const isSelected = selectedCourse?.id === item.id;
    return (
      <View style={[styles.courseItem, isSelected && styles.selectedCourseItem]}>
        <TouchableOpacity
          style={styles.courseContent}
          onPress={() => navigation.navigate('Course', {
            courseId: item.id,
            courseTitle: item.title,
            isOffline: isDownloaded,
          })}
        >
          <View style={styles.courseInfo}>
            <Text style={styles.courseTitle}>{item.title}</Text>
            <Text style={styles.courseSubtitle}>
              创建于 {new Date(item.created_at).toLocaleDateString()}
              {isDownloaded && ' • 已下载'}
              {isSelected && ' • 当前选中'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#4B79A1" />
        </TouchableOpacity>
        <View style={styles.actionButtons}>
          {!isSelected && (
            <TouchableOpacity style={styles.actionButton} onPress={() => selectCourse(item.id)}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#4CAF50" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDownloadCourse(item.id, item.title)}
            disabled={downloadingCourseId === item.id}
          >
            <Ionicons name={isDownloaded ? "cloud-done" : "cloud-download"} size={24} color={downloadingCourseId === item.id ? "#999" : "#4B79A1"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteCourse(item.id)}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>词汇学习</Text>
        <Text style={styles.subtitle}>选择一个课程开始学习，或创建新课程</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.coursesHeader}>
          <Text style={styles.sectionTitle}>我的课程</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>创建新课程</Text>
              <Text style={styles.label}>课程名称：</Text>
              <TextInput
                style={styles.input}
                value={newCourseTitle}
                onChangeText={setNewCourseTitle}
                placeholder="请输入课程名称"
              />
              <View style={styles.buttonContainer}>
                <Button title="取消" onPress={() => setModalVisible(false)} color="#666" />
                <Button title="确定" onPress={handleCreateCourse} />
              </View>
            </View>
          </View>
        </Modal>
        {selectedCourse && (
          <View style={styles.selectedCourseContainer}>
            <Text style={styles.selectedCourseTitle}>当前课程：{selectedCourse.title}</Text>
            <Text style={styles.selectedCourseSubtitle}>请选择下方选项卡开始学习。</Text>
          </View>
        )}
        {loading ? (
          <Text>加载中...</Text>
        ) : courses.length > 0 ? (
          <FlatList data={courses} renderItem={renderCourseItem} keyExtractor={item => item.id.toString()} />
        ) : (
          <Text style={styles.emptyText}>没有课程。点击"+"创建新课程。</Text>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#e0e0e0', marginTop: 8 },
  content: { flex: 1, backgroundColor: '#f5f5f5', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
  coursesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  addButton: { backgroundColor: '#4B79A1', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  courseItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  selectedCourseItem: { borderWidth: 2, borderColor: '#4CAF50' },
  courseContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseInfo: { flex: 1 },
  courseTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  courseSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { padding: 8, marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 10, width: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  label: { fontSize: 16, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 15 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  selectedCourseContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  selectedCourseTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  selectedCourseSubtitle: { fontSize: 14, color: '#666' },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
});

export default HomeScreen;