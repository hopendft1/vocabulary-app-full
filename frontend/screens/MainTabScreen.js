import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import HomeScreen from './HomeScreen';
import LearningScreen from './LearningScreen';
import QuickPracticeScreen from './QuickPracticeScreen';
import DifficultWordsScreen from './DifficultWordsScreen';
import ReviewScreen from './ReviewScreen';
import StatsScreen from './StatsScreen';

const Tab = createBottomTabNavigator();

const MainTabScreen = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Learn') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Practice') {
            iconName = focused ? 'flash' : 'flash-outline';
          } else if (route.name === 'Difficult') {
            iconName = focused ? 'alert-circle' : 'alert-circle-outline';
          } else if (route.name === 'Review') {
            iconName = focused ? 'refresh-circle' : 'refresh-circle-outline';
          } else if (route.name === 'Stats') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4B79A1',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ tabBarLabel: '首页' }}
      />
      <Tab.Screen 
        name="Learn" 
        component={LearningScreen} 
        options={{ 
          tabBarLabel: '学习',
          unmountOnBlur: true // 每次离开时卸载组件
        }}
        initialParams={{ courseId: 1 }} // 默认参数，实际使用时会被覆盖
      />
      <Tab.Screen 
        name="Practice" 
        component={QuickPracticeScreen} 
        options={{ 
          tabBarLabel: '快速练习',
          unmountOnBlur: true
        }}
        initialParams={{ courseId: 1 }}
      />
      <Tab.Screen 
        name="Difficult" 
        component={DifficultWordsScreen} 
        options={{ 
          tabBarLabel: '难词',
          unmountOnBlur: true
        }}
      />
      <Tab.Screen 
        name="Review" 
        component={ReviewScreen} 
        options={{ 
          tabBarLabel: '复习',
          unmountOnBlur: true
        }}
      />
      <Tab.Screen 
        name="Stats" 
        component={StatsScreen} 
        options={{ tabBarLabel: '统计' }}
      />
    </Tab.Navigator>
  );
};

export default MainTabScreen;
