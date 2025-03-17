import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './HomeScreen';
import LearningScreen from './LearningScreen';
import QuickPracticeScreen from './QuickPracticeScreen';
import DifficultWordsScreen from './DifficultWordsScreen';
import ReviewScreen from './ReviewScreen';
import StatsScreen from './StatsScreen';

const Tab = createBottomTabNavigator();

const MainTabScreen = ({ navigation }) => {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [downloadedCourses, setDownloadedCourses] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const selectedCourseJson = await AsyncStorage.getItem('selectedCourse');
        const downloadedCoursesJson = await AsyncStorage.getItem('downloadedCourses');
        setSelectedCourse(selectedCourseJson ? JSON.parse(selectedCourseJson) : null);
        setDownloadedCourses(downloadedCoursesJson ? JSON.parse(downloadedCoursesJson) : []);
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    };
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  const getCourseParams = () => {
    if (!selectedCourse) {
      console.log('No selected course');
      return { courseId: null, courseTitle: null, isOffline: false };
    }
    const isOffline = downloadedCourses.some(c => c.id === selectedCourse.id);
    return { courseId: selectedCourse.id, courseTitle: selectedCourse.title, isOffline };
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Courses') iconName = focused ? 'school' : 'school-outline';
          else if (route.name === 'Learn') iconName = focused ? 'book' : 'book-outline';
          else if (route.name === 'Practice') iconName = focused ? 'flash' : 'flash-outline';
          else if (route.name === 'Difficult') iconName = focused ? 'alert-circle' : 'alert-circle-outline';
          else if (route.name === 'Review') iconName = focused ? 'refresh-circle' : 'refresh-circle-outline';
          else if (route.name === 'Stats') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4B79A1',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Courses" component={HomeScreen} options={{ tabBarLabel: '我的课程' }} />
      <Tab.Screen name="Learn" component={LearningScreen} options={{ tabBarLabel: '学习', unmountOnBlur: true }} initialParams={getCourseParams()} />
      <Tab.Screen name="Practice" component={QuickPracticeScreen} options={{ tabBarLabel: '快速练习', unmountOnBlur: true }} initialParams={getCourseParams()} />
      <Tab.Screen name="Difficult" component={DifficultWordsScreen} options={{ tabBarLabel: '难词', unmountOnBlur: true }} initialParams={getCourseParams()} />
      <Tab.Screen name="Review" component={ReviewScreen} options={{ tabBarLabel: '复习', unmountOnBlur: true }} initialParams={getCourseParams()} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: '统计' }} />
    </Tab.Navigator>
  );
};

export default MainTabScreen;