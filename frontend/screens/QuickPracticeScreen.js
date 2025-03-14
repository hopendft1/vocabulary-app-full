import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'http://192.168.0.176:8000'; // For Android emulator
const PRACTICE_TIME = 60; // 60秒限时
const PRACTICE_QUESTIONS = 50; // 50题目标

const QuickPracticeScreen = ({ route, navigation }) => {
  const { courseId } = route.params;
  const [words, setWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PRACTICE_TIME);
  const [isCorrect, setIsCorrect] = useState(null);
  const [sound, setSound] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  
  // 动画值
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const pinyinFadeAnim = useRef(new Animated.Value(0)).current;
  const pinyinBounceAnim = useRef(new Animated.Value(0.9)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // 计时器
  const timerRef = useRef(null);

  useEffect(() => {
    fetchWords();
    startTimer();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (sound) sound.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (words.length > 0 && currentWordIndex < words.length) {
      generateOptions();
      animateNewQuestion();
    }
  }, [words, currentWordIndex]);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchWords = async () => {
    try {
      // 获取复习单词或课程单词
      let endpoint = `/words/review/due?limit=${PRACTICE_QUESTIONS}`;
      if (courseId) {
        endpoint = `/words?course_id=${courseId}&limit=${PRACTICE_QUESTIONS}`;
      }
      
      const response = await fetch(`${API_URL}${endpoint}`);
      
      if (!response.ok) {
        throw new Error('获取单词失败');
      }
      
      const data = await response.json();
      if (data.length > 0) {
        // 随机打乱单词顺序
        setWords(data.sort(() => 0.5 - Math.random()));
      } else {
        alert('没有可练习的单词');
        navigation.goBack();
      }
    } catch (error) {
      alert(error.message);
      navigation.goBack();
    }
  };

  const generateOptions = () => {
    if (words.length < 4) return;
    
    const correctWord = words[currentWordIndex];
    let allOptions = [correctWord];
    
    // 从其他单词中随机选择3个作为错误选项
    const otherWords = words.filter((_, index) => index !== currentWordIndex);
    const shuffled = [...otherWords].sort(() => 0.5 - Math.random());
    allOptions = [...allOptions, ...shuffled.slice(0, 3)];
    
    // 打乱选项顺序
    setOptions(allOptions.sort(() => 0.5 - Math.random()));
  };

  const animateNewQuestion = () => {
    // 重置动画值
    fadeAnim.setValue(0);
    slideAnim.setValue(Dimensions.get('window').width);
    
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

  const animateCorrectAnswer = () => {
    // 拼音淡入弹跳动画
    Animated.parallel([
      Animated.timing(pinyinFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(pinyinBounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      // 分数增加动画
      Animated.sequence([
        Animated.timing(scoreAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scoreAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ])
    ]).start();
  };

  const animateIncorrectAnswer = () => {
    // 拼音淡入弹跳动画
    Animated.parallel([
      Animated.timing(pinyinFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(pinyinBounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
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
      ])
    ]).start();
  };

  const handleOptionSelect = async (option) => {
    const correct = option.id === words[currentWordIndex].id;
    setIsCorrect(correct);
    
    // 重置拼音动画值
    pinyinFadeAnim.setValue(0);
    pinyinBounceAnim.setValue(0.9);
    
    if (correct) {
      setScore(prev => prev + 10);
      animateCorrectAnswer();
    } else {
      animateIncorrectAnswer();
    }
    
    // 播放发音
    playSound();
    
    // 更新学习数据
    updateLearningData(correct);
    
    // 增加回答问题数
    setQuestionsAnswered(prev => prev + 1);
    
    // 延迟后移动到下一个问题
    setTimeout(() => {
      if (currentWordIndex < words.length - 1 && questionsAnswered < PRACTICE_QUESTIONS - 1 && timeLeft > 0) {
        setCurrentWordIndex(currentWordIndex + 1);
        setIsCorrect(null);
      } else {
        setGameOver(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 1200);
  };

  const playSound = async () => {
    const currentWord = words[currentWordIndex];
    if (!currentWord || !currentWord.audio_link) return;
    
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

  const updateLearningData = async (correct) => {
    try {
      const currentWord = words[currentWordIndex];
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
    setTimeLeft(PRACTICE_TIME);
    setGameOver(false);
    setQuestionsAnswered(0);
    fetchWords();
    startTimer();
  };

  if (words.length === 0 || currentWordIndex >= words.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  const currentWord = words[currentWordIndex];

  if (gameOver) {
    return (
      <LinearGradient
        colors={['#4B79A1', '#283E51']}
        style={styles.container}
      >
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverTitle}>练习结束!</Text>
          <Text style={styles.gameOverScore}>得分: {score}</Text>
          <Text style={styles.gameOverStat}>回答问题数: {questionsAnswered}</Text>
          <Text style={styles.gameOverStat}>
            正确率: {questionsAnswered > 0 ? Math.round((score / questionsAnswered) * 10) + '%' : '0%'}
          </Text>
          
          <TouchableOpacity style={styles.button} onPress={handlePlayAgain}>
            <Text style={styles.buttonText}>再来一次</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#4B79A1', '#283E51']}
      style={styles.container}
    >
      {/* 状态栏 */}
      <View style={styles.statusBar}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>得分</Text>
          <View style={styles.scoreValueContainer}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Animated.View 
              style={[
                styles.scorePopup,
                {
                  opacity: scoreAnim,
                  transform: [
                    { translateY: scoreAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -20]
                    })}
                  ]
                }
              ]}
            >
              <Text style={styles.scorePopupText}>+10</Text>
            </Animated.View>
          </View>
        </View>
        
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>时间</Text>
          <Text style={[
            styles.timerValue,
            timeLeft <= 10 ? styles.timerWarning : {}
          ]}>
            {timeLeft}
          </Text>
        </View>
      </View>
      
      {/* 问题计数 */}
      <View style={styles.questionCounter}>
        <Text style={styles.questionCounterText}>
          {questionsAnswered + 1} / {Math.min(words.length, PRACTICE_QUESTIONS)}
        </Text>
      </View>
      
      {/* 主要内容 */}
      <Animated.View 
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateX: slideAnim },
              { translateX: isCorrect === false ? shakeAnim : 0 }
            ]
          }
        ]}
      >
        <View style={styles.definitionContainer}>
          <Text style={styles.definitionText}>{currentWord.definition}</Text>
        </View>
        
        {/* 选项 */}
        <View style={styles.optionsContainer}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                isCorrect !== null && option.id === currentWord.id ? styles.correctOption : {},
                isCorrect === false && option.id === words[currentWordIndex].id ? styles.highlightCorrect : {}
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
        
        {/* 拼音显示 - 在回答后显示 */}
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
      </Animated.View>
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
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#fff',
    fontSize: 14,
  },
  scoreValueContainer: {
    position: 'relative',
  },
  scoreValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  scorePopup: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scorePopupText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 16,
  },
  timerContainer: {
    alignItems: 'center',
  },
  timerLabel: {
    color: '#fff',
    fontSize: 14,
  },
  timerValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  timerWarning: {
    color: '#FF5722',
  },
  questionCounter: {
    alignItems: 'center',
    marginBottom: 10,
  },
  questionCounterText: {
    color: '#fff',
    fontSize: 16,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  definitionContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  definitionText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#333',
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
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
    marginBottom: 20,
    alignItems: 'center',
  },
  pinyinText: {
    fontSize: 20,
    color: '#4A90E2',
    textAlign: 'center',
  },
  gameOverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  gameOverTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  gameOverScore: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 10,
  },
  gameOverStat: {
    fontSize: 18,
    color: '#e0e0e0',
    marginBottom: 6,
  },
  button: {
    backgroundColor: '#FFC107',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default QuickPracticeScreen;
