import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';

const API_URL = 'http://10.0.2.2:8000'; // For Android emulator

const CSVImport = ({ courseId, onImportSuccess }) => {
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return;
      }

      const { uri } = result.assets[0];
      uploadCSV(uri);
    } catch (error) {
      Alert.alert('错误', '选择文件时出错: ' + error.message);
    }
  };

  const uploadCSV = async (uri) => {
    try {
      setLoading(true);

      // Create form data
      const formData = new FormData();
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      formData.append('file', {
        uri: uri,
        name: uri.split('/').pop(),
        type: 'text/csv'
      });

      // Upload to server
      const response = await fetch(`${API_URL}/courses/${courseId}/upload-csv`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '上传失败');
      }

      const data = await response.json();
      Alert.alert('成功', '词汇已成功导入!');
      
      if (onImportSuccess) {
        onImportSuccess(data);
      }
    } catch (error) {
      Alert.alert('导入错误', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>导入词汇</Text>
      <Text style={styles.description}>
        上传CSV文件，格式：单词, 拼音, 释义, 例句, 音频链接
      </Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={pickDocument}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>选择CSV文件</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4B79A1',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CSVImport;
