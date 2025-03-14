import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'http://192.168.0.176:8000'; // For Android emulator

const DifficultWordsScreen = ({ navigation }) => {
  const [difficultWords, setDifficultWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sound, setSound] = useState(null);
  const [completed, setCompleted] = useState(false);
  
  // 动画值
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pinyinFadeAnim = useRef(new Animated.Value(0)).current;
  const pinyinBounceAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    fetchDifficultWords();
    
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, []);

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

  const fetchDifficultWords = async () => {
    try {
      const response = await fetch(`${API_URL}/words/difficult`);
      
      if (!response.ok) {
        throw new Error('获取难词列表失败');
      }
      
      const data = await response.json();
      if (data.length > 0) {
        setDifficultWords(data);
      } else {
        alert('没有难词需要练习');
        navigation.goBack();
      }
    } catch (error) {
      alert(error.message);
      navigation.goBack();
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
      })
    ]).start();
    
    // 播放音频
    playSound();
  };

  const playSound = async () => {
    if (difficultWords.length === 0 || currentWordIndex >= difficultWords.length) return;
    
    const currentWord = difficultWords[currentWordIndex];
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
    }
  };

  if (difficultWords.length === 0) {
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
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          <Text style={styles.completedTitle}>完成!</Text>
          <Text style={styles.completedText}>
            你已完成所有难词练习。继续保持!
          </Text>
          
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

  const currentWord = difficultWords[currentWordIndex];

  return (
    <LinearGradient
      colors={['#4B79A1', '#283E51']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>难词模式</Text>
        <Text style={styles.progressText}>
          {currentWordIndex + 1} / {difficultWords.length}
        </Text>
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
            
            {/* 拼音区域 - 点击后显示 */}
            {showAnswer && (
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
              这个词你已经错误{currentWord.learning_data?.error_count || 3}次。
              尝试将"{currentWord.word}"分解成更小的部分，逐个记忆。
            </Text>
          </View>
          
          <View style={styles.buttonContainer}>
            {!showAnswer ? (
              <TouchableOpacity 
                style={styles.button} 
                onPress={handleShowAnswer}
              >
                <Ionicons name="eye" size={24} color="#fff" />
                <Text style={styles.buttonText}>显示拼音</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.button} 
                onPress={playSound}
              >
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
