import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Button, Text } from 'react-native';

// Import screens
import MainTabScreen from './screens/MainTabScreen';
import CourseScreen from './screens/CourseScreen';
import WordDetailScreen from './screens/WordDetailScreen';
import API_URL from './config/apiConfig';

// Create navigation stack
const Stack = createNativeStackNavigator();

export default function App() {
  const [message, setMessage] = useState('');
  const [courseId, setCourseId] = useState('1'); // 默认 course_id 为 1

  const uploadCSV = async () => {
    console.log('Upload CSV button clicked');
    const result = await DocumentPicker.getDocumentAsync({ type: 'text/csv' });
    console.log('DocumentPicker result:', result);
    if (result.type === 'success') {
      console.log('File selected:', result.uri);
      const formData = new FormData();
      formData.append('file', {
        uri: result.uri,
        name: result.name,
        type: 'text/csv',
      });

      try {
        const uploadUrl = `${API_URL}/courses/${courseId}/upload-csv`;
        console.log('Sending fetch request to:', uploadUrl);
        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        console.log('Upload response:', data);
        setMessage(data.message || 'Upload successful');
      } catch (error) {
        console.log('Upload error:', error.message);
        setMessage('Network error: ' + error.message);
      }
    } else {
      console.log('DocumentPicker cancelled or failed');
      setMessage('File selection cancelled');
    }
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="MainTabs"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#4B79A1',
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
        <Button title="Upload CSV" onPress={uploadCSV} />
        <Text>{message}</Text>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}