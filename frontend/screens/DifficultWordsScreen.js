import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://vocabulary-app-full.onrender.com'; // For Android emulator

const getSelectedCourseWords = async (courseId, isOffline, downloadedCourses) => {
  let words = [];
  if (isOffline || downloadedCourses.some(c => c.id === courseId)) {
    const courseDir = `${FileSystem.documentDirectory}courses/${courseId}/`;
    const wordsJson = await FileSystem.readAsStringAsync(`${courseDir}words.json`);
    words = JSON.parse(wordsJson);
  } else {
    const response = await fetch(`${API_URL}/words?course_id=${courseId}`);
    if (!response.ok) throw new Error('获取单词失败');
    words = await response.json();
  }
  return words;
};

const DifficultWordsScreen = ({ navigation }) => {
  const route = useRoute();
  const [difficultWords, setDifficultWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sound, setSound] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [courseId, setCourseId] = useState(null); // Add courseId state
  const [isOffline, setIsOffline] = useState(false); // Add isOffline state
  const [downloadedCourses, setDownloadedCourses] = useState([]); // Add downloadedCourses state
  const [loading, setLoading] = useState(true); // Add loading state

  // 动画值
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pinyinFadeAnim = useRef(new Animated.Value(0)).current;
  const pinyinBounceAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const initializeCourse = async () => {
      setLoading(true); // Start loading
      try {
        // Try to get courseId from route.params first
        const paramsCourseId = route?.params?.courseId;
        const paramsIsOffline = route?.params?.isOffline || false;

        if (paramsCourseId) {
          setCourseId(paramsCourseId);
          setIsOffline(paramsIsOffline);
        } else {
          // Fallback to AsyncStorage
          const selectedCourseJson = await AsyncStorage.getItem('selectedCourse');
          const selectedCourse = selectedCourseJson ? JSON.parse(selectedCourseJson) : null;
          if (selectedCourse && selectedCourse.id) {
            setCourseId(selectedCourse.id);
            const downloadedCoursesJson = await AsyncStorage.getItem('downloadedCourses');
            const downloaded = downloadedCoursesJson ? JSON.parse(downloadedCoursesJson) : [];
            setDownloadedCourses(downloaded);
            setIsOffline(downloaded.some(c => c.id === selectedCourse.id));
          } else {
            Alert.alert('错误', '未找到选中的课程，请在“我的课程”中选择一个课程');
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        Alert.alert('错误', `初始化课程失败：${error.message}`);
      } finally {
        setLoading(false); // End loading
      }
    };

    initializeCourse();
  }, [route?.params]);

  useEffect(() => {
    const fetchWords = async () => {
      if (!courseId || loading) return; // Skip if loading or no courseId

      try {
        const storedDownloadedCourses = await AsyncStorage.getItem('downloadedCourses');
        const downloaded = storedDownloadedCourses ? JSON.parse(storedDownloadedCourses) : [];
        setDownloadedCourses(downloaded);

        const fetchedWords = await getSelectedCourseWords(courseId, isOffline, downloaded);
        if (fetchedWords.length === 0) {
          Alert.alert('提示', '该课程没有单词，请先添加单词');
          return;
        }

        let filteredWords = fetchedWords;
        let noWordsMessage = '';

        switch (route.name) {
          case 'Learn':
            filteredWords = fetchedWords.filter(word => !word.is_learned);
            noWordsMessage = '没有新单词可学';
            break;
          case 'Review':
            filteredWords = fetchedWords.filter(word => word.is_learned);
            noWordsMessage = '没有已学单词可复习';
            break;
          case 'Difficult':
            filteredWords = fetchedWords.filter(word => word.is_difficult);
            noWordsMessage = '没有难词可练习';
            break;
          case 'Practice':
            filteredWords = fetchedWords.filter(word => word.is_learned && word.is_difficult);
            noWordsMessage = '没有已学且标记为难词的单词可练习';
            break;
          default:
            filteredWords = [];
            noWordsMessage = '未知的页面，无法加载单词';
        }

        if (filteredWords.length === 0) {
          Alert.alert('提示', noWordsMessage);
          navigation.goBack();
          return;
        }

        setDifficultWords(filteredWords); // Use setDifficultWords instead of setWords
      } catch (error) {
        Alert.alert('错误', `无法加载单词：${error.message}`);
      }
    };

    fetchWords();
  }, [courseId, isOffline, route.name, loading, navigation]);

  useEffect(() => {
    // 每次切换单词时，重置动画和状态
    fadeAnim.setValue(0);
    pinyinFadeAnim.setValue(0);
    pinyinBounceAnim.setValue(0.9);
    setShowAnswer(false);

    // 淡入动画
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [currentWordIndex]);

  const handleDeleteWord = async () => {
    const currentWord = difficultWords[currentWordIndex];
    if (!currentWord) return;

    Alert.alert(
      '确认删除',
      '确定要删除这个单词吗？此操作不可逆。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!isOffline) {
                await fetch(`${API_URL}/words/${currentWord.id}`, { method: 'DELETE' });
              }
              const updatedWords = difficultWords.filter(w => w.id !== currentWord.id);
              setDifficultWords(updatedWords);
              if (currentWordIndex >= updatedWords.length) {
                setCurrentWordIndex(Math.max(0, updatedWords.length - 1));
              }
              if (updatedWords.length === 0) {
                setCompleted(true);
              }
            } catch (error) {
              Alert.alert('错误', error.message);
            }
          },
        },
      ]
    );
  };

  const handleMarkAsDifficult = async () => {
    const currentWord = difficultWords[currentWordIndex];
    if (!currentWord) return;

    try {
      const response = await fetch(`${API_URL}/words/${currentWord.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_difficult: !currentWord.is_difficult }),
      });

      if (!response.ok) throw new Error('更新单词状态失败');

      const updatedWords = [...difficultWords];
      updatedWords[currentWordIndex].is_difficult = !currentWord.is_difficult;
      setDifficultWords(updatedWords);

      // If marking as not difficult, remove from list
      if (!updatedWords[currentWordIndex].is_difficult) {
        const newWords = updatedWords.filter(w => w.id !== currentWord.id);
        setDifficultWords(newWords);
        if (currentWordIndex >= newWords.length) {
          setCurrentWordIndex(Math.max(0, newWords.length - 1));
        }
        if (newWords.length === 0) {
          setCompleted(true);
        }
      }
    } catch (error) {
      Alert.alert('错误', error.message);
    }
  };

  const showPinyinAnimation = () => {
    // 拼音淡入弹跳动画
    Animated.parallel([
      Animated.timing(pinyinFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(pinyinBounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 播放音频
    playSound();
  };

  const playSound = async () => {
    const currentWord = difficultWords[currentWordIndex];
    if (!currentWord || !currentWord.audio_link) return;

    try {
      if (sound) await sound.unloadAsync();

      let audioUri = currentWord.audio_link;
      if (isOffline) {
        const audioFileName = currentWord.audio_link.split('/').pop();
        const filePath = `${FileSystem.documentDirectory}courses/${courseId}/audio/${audioFileName}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (!fileInfo.exists) {
          console.error('Audio file not found:', filePath);
          Alert.alert('错误', '音频文件未找到，请确保已下载离线资源。');
          return;
        }
        audioUri = filePath;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );
      setSound(newSound);
    } catch (error) {
      console.error('Error playing sound:', error);
      Alert.alert('错误', '播放音频失败，请检查网络或音频链接。');
    }
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    showPinyinAnimation();
  };

  const handleMarkAsLearned = async (correct) => {
    if (difficultWords.length === 0 || currentWordIndex >= difficultWords.length) return;

    try {
      const currentWord = difficultWords[currentWordIndex];
      await fetch(`${API_URL}/words/${currentWord.id}/update-learning-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ correct }),
      });

      // 移动到下一个单词或完成学习
      if (currentWordIndex < difficultWords.length - 1) {
        setCurrentWordIndex(currentWordIndex + 1);
      } else {
        setCompleted(true);
      }
    } catch (error) {
      console.error('Error updating learning data:', error);
      Alert.alert('错误', '更新学习数据失败');
    }
  };

  // Render loading state
  if (loading) {
    return (
      <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
        <ActivityIndicator size="large" color="#fff" style={styles.loadingIndicator} />
      </LinearGradient>
    );
  }

  // Render no difficult words state
  if (difficultWords.length === 0) {
    return (
      <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.loadingText}>没有难词需要练习</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // Render completion state
  if (completed) {
    return (
      <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
        <View style={styles.completedContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          <Text style={styles.completedTitle}>完成!</Text>
          <Text style={styles.completedText}>你已完成所有难词练习。继续保持!</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const currentWord = difficultWords[currentWordIndex];

  return (
    <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {route?.params?.screenTitle || '难词练习'}
        </Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleDeleteWord}>
            <Ionicons name="trash" size={24} color="#FF5722" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleMarkAsDifficult}>
            <Ionicons name="alert-circle" size={24} color="#FF9800" />
          </TouchableOpacity>
        </View>
        <Text style={styles.progressText}>
          {currentWordIndex + 1} / {difficultWords.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <View style={styles.wordContainer}>
            <Text style={styles.wordText}>{currentWord.word}</Text>
            {showAnswer && (
              <Animated.View
                style={[
                  styles.pinyinContainer,
                  {
                    opacity: pinyinFadeAnim,
                    transform: [{ scale: pinyinBounceAnim }],
                  },
                ]}
              >
                <Text style={styles.pinyinText}>{currentWord.pinyin}</Text>
              </Animated.View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>释义</Text>
            <Text style={styles.definitionText}>{currentWord.definition}</Text>
          </View>

          {currentWord.example && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>例句</Text>
              <Text style={styles.exampleText}>{currentWord.example}</Text>
            </View>
          )}

          <View style={styles.difficultySection}>
            <Text style={styles.difficultyTitle}>
              <Ionicons name="alert-circle" size={20} color="#FF5722" /> 难点提示
            </Text>
            <Text style={styles.difficultyText}>
              这个词你已经错误{currentWord.learning_data?.error_count || 3}次。尝试将"
              {currentWord.word}"分解成更小的部分，逐个记忆。
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            {!showAnswer ? (
              <TouchableOpacity style={styles.button} onPress={handleShowAnswer}>
                <Ionicons name="eye" size={24} color="#fff" />
                <Text style={styles.buttonText}>显示拼音</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.button} onPress={playSound}>
                <Ionicons name="volume-high" size={24} color="#fff" />
                <Text style={styles.buttonText}>播放发音</Text>
              </TouchableOpacity>
            )}
          </View>

          {showAnswer && (
            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackTitle}>记住了吗?</Text>
              <View style={styles.feedbackButtons}>
                <TouchableOpacity
                  style={[styles.feedbackButton, styles.incorrectButton]}
                  onPress={() => handleMarkAsLearned(false)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                  <Text style={styles.feedbackButtonText}>还没记住</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.feedbackButton, styles.correctButton]}
                  onPress={() => handleMarkAsLearned(true)}
                >
                  <Ionicons name="checkmark" size={24} color="#fff" />
                  <Text style={styles.feedbackButtonText}>已记住</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressText: {
    fontSize: 16,
    color: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  wordContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  wordText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  pinyinContainer: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 10,
    minWidth: 150,
    alignItems: 'center',
  },
  pinyinText: {
    fontSize: 20,
    color: '#4A90E2',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  definitionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
  },
  exampleText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
    fontStyle: 'italic',
  },
  difficultySection: {
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  difficultyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#FF5722',
    flexDirection: 'row',
    alignItems: 'center',
  },
  difficultyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#555',
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4B79A1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 180,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  feedbackContainer: {
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  feedbackButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 6,
  },
  incorrectButton: {
    backgroundColor: '#FF5722',
  },
  correctButton: {
    backgroundColor: '#4CAF50',
  },
  feedbackButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  completedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
  },
  completedText: {
    fontSize: 18,
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 32,
  },
});

export default DifficultWordsScreen;