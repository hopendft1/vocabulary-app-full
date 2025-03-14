import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'http://192.168.0.176:8000'; // For Android emulator

const HomeScreen = ({ navigation }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
    
    // Add listener to refresh courses when navigating back to this screen
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCourses();
    });

    return unsubscribe;
  }, [navigation]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/courses`);
      
      if (!response.ok) {
        throw new Error('获取课程列表失败');
      }
      
      const data = await response.json();
      setCourses(data);
    } catch (error) {
      Alert.alert('错误', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    try {
      // Simple prompt for course name
      Alert.prompt(
        '创建新课程',
        '请输入课程名称',
        [
          {
            text: '取消',
            style: 'cancel',
          },
          {
            text: '创建',
            onPress: async (title) => {
              if (!title || title.trim() === '') {
                Alert.alert('错误', '课程名称不能为空');
                return;
              }
              
              const response = await fetch(`${API_URL}/courses/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  title: title.trim(),
                  description: '',
                }),
              });
              
              if (!response.ok) {
                throw new Error('创建课程失败');
              }
              
              const newCourse = await response.json();
              fetchCourses();
              
              // Navigate to the new course
              navigation.navigate('Course', {
                courseId: newCourse.id,
                courseTitle: newCourse.title,
              });
            },
          },
        ],
        'plain-text'
      );
    } catch (error) {
      Alert.alert('错误', error.message);
    }
  };

  const renderCourseItem = ({ item }) => (
    <TouchableOpacity
      style={styles.courseItem}
      onPress={() => navigation.navigate('Course', {
        courseId: item.id,
        courseTitle: item.title,
      })}
    >
      <View style={styles.courseInfo}>
        <Text style={styles.courseTitle}>{item.title}</Text>
        <Text style={styles.courseSubtitle}>
          创建于 {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#4B79A1" />
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={['#4B79A1', '#283E51']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>词汇学习</Text>
        <Text style={styles.subtitle}>
          选择一个课程开始学习，或创建新课程
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.coursesHeader}>
          <Text style={styles.sectionTitle}>我的课程</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleCreateCourse}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {courses.length > 0 ? (
          <FlatList
            data={courses}
            renderItem={renderCourseItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              没有课程。点击"+"按钮创建新课程。
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
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e0e0',
    marginTop: 8,
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
  },
  coursesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#4B79A1',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingBottom: 20,
  },
  courseItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  courseInfo: {
    flex: 1,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  courseSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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

export default HomeScreen;
