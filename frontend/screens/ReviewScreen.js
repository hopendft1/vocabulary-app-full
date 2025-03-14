import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'http://192.168.0.176:8000'; // For Android emulator

const ReviewScreen = ({ navigation }) => {
  const [reviewWords, setReviewWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [sound, setSound] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    correct: 0,
    incorrect: 0,
  });
  
  // 动画值
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pinyinFadeAnim = useRef(new Animated.Value(0)).current;
  const pinyinBounceAnim = useRef(new Animated.Value(0.9)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchReviewWords();
    
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (reviewWords.length > 0 && currentWordIndex < reviewWords.length) {
      generateOptions();
      animateNewQuestion();
    }
  }, [reviewWords, currentWordIndex]);

  const fetchReviewWords = async () => {
    try {
      const response = await fetch(`${API_URL}/words/review/due`);
      
      if (!response.ok) {
        throw new Error('获取复习单词失败');
      }
      
      const data = await response.json();
      if (data.length > 0) {
        setReviewWords(data);
        setStats(prev => ({ ...prev, total: data.length }));
      } else {
        alert('没有需要复习的单词');
        navigation.goBack();
      }
    } catch (error) {
      alert(error.message);
      navigation.goBack();
    }
  };

  const generateOptions = () => {
    if (reviewWords.length < 4) return;
    
    const correctWord = reviewWords[currentWordIndex];
    let allOptions = [correctWord];
    
    // 从其他单词中随机选择3个作为错误选项
    const otherWords = reviewWords.filter((_, index) => index !== currentWordIndex);
    const shuffled = [...otherWords].sort(() => 0.5 - Math.random());
    allOptions = [...allOptions, ...shuffled.slice(0, 3)];
    
    // 打乱选项顺序
    setOptions(allOptions.sort(() => 0.5 - Math.random()));
  };

  const animateNewQuestion = () => {
    // 重置动画值
    fadeAnim.setValue(0);
    slideAnim.setValue(300);
    pinyinFadeAnim.setValue(0);
    pinyinBounceAnim.setValue(0.9);
    
    // 执行动画
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
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
      })
    ]).start();
    
    // 播放音频
    playSound();
  };

  const animateCorrectAnswer = () => {
    showPinyinAnimation();
  };

  const animateIncorrectAnswer = () => {
    showPinyinAnimation();
    
    // 抖动动画
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();
  };

  const playSound = async () => {
    if (reviewWords.length === 0 || currentWordIndex >= reviewWords.length) return;
    
    const currentWord = reviewWords[currentWordIndex];
    if (!currentWord.audio_link) return;
    
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: currentWord.audio_link },
        { shouldPlay: true }
      );
      
      setSound(newSound);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const handleOptionSelect = async (option) => {
    const correct = option.id === reviewWords[currentWordIndex].id;
    setIsCorrect(correct);
    
    if (correct) {
      animateCorrectAnswer();
      setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      animateIncorrectAnswer();
      setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }
    
    // 更新学习数据
    await updateLearningData(correct);
    
    // 延迟后移动到下一个问题
    setTimeout(() => {
      if (currentWordIndex < reviewWords.length - 1) {
        setCurrentWordIndex(currentWordIndex + 1);
        setIsCorrect(null);
      } else {
        setCompleted(true);
      }
    }, 2000);
  };

  const updateLearningData = async (correct) => {
    try {
      const currentWord = reviewWords[currentWordIndex];
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

  if (reviewWords.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (completed) {
    return (
      <LinearGradient
        colors={['#4B79A1', '#283E51']}
        style={styles.container}
      >
        <View style={styles.completedContainer}>
          <Text style={styles.completedTitle}>复习完成!</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>总计单词</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.correctValue]}>{stats.correct}</Text>
              <Text style={styles.statLabel}>正确</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.incorrectValue]}>{stats.incorrect}</Text>
              <Text style={styles.statLabel}>错误</Text>
            </View>
          </View>
          
          <View style={styles.accuracyContainer}>
            <Text style={styles.accuracyLabel}>正确率</Text>
            <Text style={styles.accuracyValue}>
              {Math.round((stats.correct / stats.total) * 100)}%
            </Text>
          </View>
          
          <Text style={styles.feedbackText}>
            {stats.correct === stats.total
              ? '太棒了！你已经完全掌握了这些单词。'
              : stats.correct > stats.total * 0.8
                ? '做得很好！继续保持，你已经掌握了大部分单词。'
                : stats.correct > stats.total * 0.6
                  ? '不错的表现！多加练习，你会做得更好。'
                  : '继续努力！多多练习这些单词，你会进步的。'}
          </Text>
          
          <View style={styles.nextReviewContainer}>
            <Text style={styles.nextReviewLabel}>下次复习</Text>
            <Text style={styles.nextReviewValue}>
              {stats.correct > stats.total * 0.8
                ? '3天后'
                : stats.correct > stats.total * 0.6
                  ? '1天后'
                  : '今天晚些时候'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const currentWord = reviewWords[currentWordIndex];

  return (
    <LinearGradient
      colors={['#4B79A1', '#283E51']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>今日复习</Text>
        <Text style={styles.progressText}>
          {currentWordIndex + 1} / {reviewWords.length}
        </Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View 
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { translateX: isCorrect === false ? shakeAnim : 0 }
              ]
            }
          ]}
        >
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>{currentWord.definition}</Text>
            
            <View style={styles.optionsContainer}>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    isCorrect !== null && option.id === currentWord.id ? styles.correctOption : {},
                    isCorrect === false && option.id === reviewWords[currentWordIndex].id ? styles.highlightCorrect : {}
                  ]}
                  onPress={() => isCorrect === null ? handleOptionSelect(option) : null}
                  disabled={isCorrect !== null}
                >
                  <Text style={[
                    styles.optionText,
                    isCorrect !== null && option.id === currentWord.id ? styles.correctOptionText : {}
                  ]}>
                    {option.word}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {isCorrect !== null && (
              <Animated.View 
                style={[
                  styles.pinyinContainer,
                  {
                    opacity: pinyinFadeAnim,
                    transform: [{ scale: pinyinBounceAnim }]
                  }
                ]}
              >
                <Text style={styles.pinyinText}>{currentWord.pinyin}</Text>
              </Animated.View>
            )}
            
            {isCorrect !== null && (
              <View style={styles.resultContainer}>
                <Ionicons 
                  name={isCorrect ? "checkmark-circle" : "close-circle"} 
                  size={24} 
                  color={isCorrect ? "#4CAF50" : "#FF5722"} 
                />
                <Text style={[
                  styles.resultText,
                  isCorrect ? styles.correctText : styles.incorrectText
                ]}>
                  {isCorrect ? "正确!" : "错误"}
                </Text>
              </View>
            )}
            
            {isCorrect !== null && currentWord.example && (
              <View style={styles.exampleContainer}>
                <Text style={styles.exampleLabel}>例句:</Text>
                <Text style={styles.exampleText}>{currentWord.example}</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
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
  questionContainer: {
    alignItems: 'center',
  },
  questionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
    lineHeight: 26,
  },
  optionsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionText: {
    fontSize: 18,
    color: '#333',
  },
  correctOption: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
    borderWidth: 1,
    transform: [{ scale: 1.05 }],
  },
  highlightCorrect: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  correctOptionText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  pinyinContainer: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    minWidth: 150,
    alignItems: 'center',
  },
  pinyinText: {
    fontSize: 20,
    color: '#4A90E2',
    textAlign: 'center',
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  correctText: {
    color: '#4CAF50',
  },
  incorrectText: {
    color: '#FF5722',
  },
  exampleContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  exampleLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 16,
    color: '#333',
    fontStyle: 'italic',
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
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  correctValue: {
    color: '#4CAF50',
  },
  incorrectValue: {
    color: '#FF5722',
  },
  statLabel: {
    fontSize: 14,
    color: '#e0e0e0',
  },
  accuracyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '80%',
    marginBottom: 24,
  },
  accuracyLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  accuracyValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  feedbackText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#e0e0e0',
    marginBottom: 24,
    lineHeight: 24,
  },
  nextReviewContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  nextReviewLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  nextReviewValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  button: {
    backgroundColor: '#FFC107',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  buttonText: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ReviewScreen;
