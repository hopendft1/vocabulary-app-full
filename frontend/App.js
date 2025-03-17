import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import screens
import MainTabScreen from './screens/MainTabScreen';
import CourseScreen from './screens/CourseScreen';
import WordDetailScreen from './screens/WordDetailScreen';

// Create navigation stack
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="MainTabs"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#042634',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen 
            name="MainTabs" 
            component={MainTabScreen} 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="Course" 
            component={CourseScreen} 
            options={({ route }) => ({ 
              title: route.params.courseTitle,
            })} 
          />
          <Stack.Screen 
            name="WordDetail" 
            component={WordDetailScreen} 
            options={{ 
              title: '单词详情',
            }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
