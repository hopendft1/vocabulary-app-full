import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const API_URL = 'https://vocabulary-app-full.onrender.com'; // For Android emulator

// Function to fetch words for the selected course (online or offline)
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

const QuickPracticeScreen = ({ navigation, route }) => {
  // Added missing state definitions
  const [courseId, setCourseId] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [downloadedCourses, setDownloadedCourses] = useState([]);
  const [loading, setLoading] = useState(true); // Added loading state
  const [words, setWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [sound, setSound] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60); // 60秒倒计时
  const [timerRunning, setTimerRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initializeCourse = async () => {
      setLoading(true);
      try {
        const paramsCourseId = route?.params?.courseId;
        const paramsIsOffline = route?.params?.isOffline || false;

        if (paramsCourseId) {
          setCourseId(paramsCourseId);
          setIsOffline(paramsIsOffline);
        } else {
          const selectedCourseJson = await AsyncStorage.getItem('selectedCourse');
          const selectedCourse = selectedCourseJson ? JSON.parse(selectedCourseJson) : null;
          if (selectedCourse) {
            setCourseId(selectedCourse.id);
            const downloadedCoursesJson = await AsyncStorage.getItem('downloadedCourses');
            const downloaded = downloadedCoursesJson ? JSON.parse(downloadedCoursesJson) : [];
            setDownloadedCourses(downloaded);
            setIsOffline(downloaded.some(c => c.id === selectedCourse.id));
          } else {
            Alert.alert('错误', '未找到选中的课程，请在“我的课程”中选择一个课程');
            setLoading(false);
            navigation.goBack();
            return;
          }
        }
      } catch (error) {
        Alert.alert('错误', `初始化课程失败：${error.message}`);
        setLoading(false);
        navigation.goBack();
      }
    };

    initializeCourse();
  }, [route?.params, navigation]);

  useEffect(() => {
    const fetchWords = async () => {
      if (!courseId) {
        Alert.alert('错误', '请先在“我的课程”选项卡中选择一个课程');
        setLoading(false);
        navigation.goBack();
        return;
      }

      try {
        const storedDownloadedCourses = await AsyncStorage.getItem('downloadedCourses');
        const downloaded = storedDownloadedCourses ? JSON.parse(storedDownloadedCourses) : [];
        setDownloadedCourses(downloaded);

        const fetchedWords = await getSelectedCourseWords(courseId, isOffline, downloaded);
        if (fetchedWords.length === 0) {
          Alert.alert('提示', '该课程没有单词，请先添加单词');
          setLoading(false);
          navigation.goBack();
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
          setLoading(false);
          navigation.goBack();
          return;
        }

        setWords(filteredWords);
        startTimer(); // Start timer after words are loaded
      } catch (error) {
        Alert.alert('错误', `无法加载单词：${error.message}`);
        setLoading(false);
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      fetchWords();
    }
  }, [courseId, isOffline, route.name]);

  useEffect(() => {
    let timer;
    if (timerRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerRunning(false);
      setCompleted(true);
    }
    return () => clearInterval(timer);
  }, [timerRunning, timeLeft]);

  const startTimer = () => {
    setTimeLeft(60);
    setTimerRunning(true);
  };

  useEffect(() => {
    if (words.length > 0 && currentWordIndex < words.length) {
      generateOptions();
      animateNewQuestion();
    }
  }, [words, currentWordIndex]);

  const handleDeleteWord = async () => {
    const currentWord = words[currentWordIndex];
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
              const updatedWords = words.filter(w => w.id !== currentWord.id);
              setWords(updatedWords);
              if (currentWordIndex >= updatedWords.length) setCurrentWordIndex(updatedWords.length - 1);
            } catch (error) {
              Alert.alert('错误', error.message);
            }
          },
        },
      ]
    );
  };

  const handleMarkAsDifficult = async () => {
    const currentWord = words[currentWordIndex];
    if (!currentWord) return;

    try {
      if (!isOffline) {
        await fetch(`${API_URL}/words/${currentWord.id}/mark-difficult`, { method: 'PUT' });
      }
      Alert.alert('成功', '单词已标记为难词！');
    } catch (error) {
      Alert.alert('错误', error.message);
    }
  };

  const generateOptions = () => {
    if (words.length < 4) return;

    const correctWord = words[currentWordIndex];
    let allOptions = [correctWord];

    const otherWords = words.filter((_, index) => index !== currentWordIndex);
    const shuffled = [...otherWords].sort(() => 0.5 - Math.random());
    allOptions = [...allOptions, ...shuffled.slice(0, 3)];

    setOptions(allOptions.sort(() => 0.5 - Math.random()));
  };

  const animateNewQuestion = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const playSound = async () => {
    const currentWord = words[currentWordIndex];
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

  const handleOptionSelect = async (option) => {
    const correct = option.id === words[currentWordIndex].id;
    setIsCorrect(correct);

    if (correct) {
      setScore(prev => prev + 10);
    }

    await updateLearningData(correct);

    setTimeout(() => {
      if (currentWordIndex < words.length - 1) {
        setCurrentWordIndex(currentWordIndex + 1);
        setIsCorrect(null);
      } else {
        setTimerRunning(false);
        setCompleted(true);
      }
    }, 1000);
  };

  const updateLearningData = async (correct) => {
    try {
      const currentWord = words[currentWordIndex];

      if (isOffline) {
        return;
      }

      await fetch(`${API_URL}/words/${currentWord.id}/update-learning-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ correct }),
      });
    } catch (error) {
      console.error('Error updating learning data:', error);
    }
  };

  const handlePlayAgain = () => {
    setCurrentWordIndex(0);
    setScore(0);
    setCompleted(false);
    setWords(prev => [...prev].sort(() => 0.5 - Math.random()));
    startTimer();
  };

  if (loading) {
    return (
      <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
        <View style={styles.container}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (words.length === 0) {
    return (
      <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
        <View style={styles.container}>
          <Text style={styles.loadingText}>没有单词可练习</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (completed) {
    return (
      <LinearGradient
        colors={['#4B79A1', '#283E51']}
        style={styles.container}
      >
        <View style={styles.completedContainer}>
          <Text style={styles.completedText}>练习完成！</Text>
          <Text style={styles.scoreText}>得分: {score}</Text>
          <TouchableOpacity style={styles.button} onPress={handlePlayAgain}>
            <Text style={styles.buttonText}>再玩一次</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const currentWord = words[currentWordIndex];

  return (
    <LinearGradient
      colors={['#4B79A1', '#283E51']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {route.params?.screenTitle || '快速练习'}
        </Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleDeleteWord}>
            <Ionicons name="trash" size={24} color="#FF5722" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleMarkAsDifficult}>
            <Ionicons name="alert-circle" size={24} color="#FF9800" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>剩余时间: {timeLeft}s</Text>
      </View>

      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>得分: {score}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View
          style={[
            styles.card,
            { opacity: fadeAnim }
          ]}
        >
          <View style={styles.wordContainer}>
            <Text style={styles.wordText}>{currentWord.word}</Text>
          </View>

          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>选择正确的释义</Text>
            <View style={styles.optionsContainer}>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    isCorrect && option.id === currentWord.id && styles.correctOption,
                    isCorrect === false && styles.incorrectOption
                  ]}
                  onPress={() => handleOptionSelect(option)}
                  disabled={isCorrect !== null}
                >
                  <Text style={styles.optionText}>{option.definition}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {currentWord.audio_link && (
            <TouchableOpacity style={styles.button} onPress={playSound}>
              <Ionicons name="volume-high" size={24} color="#fff" />
              <Text style={styles.buttonText}>播放发音</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
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
  timerContainer: {
    padding: 8,
    alignItems: 'center',
  },
  timerText: {
    color: '#fff',
    fontSize: 16,
  },
  scoreContainer: {
    padding: 8,
    alignItems: 'center',
  },
  scoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  wordContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  wordText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  questionContainer: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  optionsContainer: {
    marginTop: 8,
  },
  optionButton: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  correctOption: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  incorrectOption: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FF5722',
    borderWidth: 2,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4B79A1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
  },
});

export default QuickPracticeScreen;