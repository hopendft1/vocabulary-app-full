import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'https://vocabulary-app-full.onrender.com'; // For Android emulator

// 学习阶段枚举
const LearningStage = {
  PREVIEW: 'preview',
  ATTEMPT: 'attempt',
  VERIFY: 'verify'
};

const LearningScreen = ({ route, navigation }) => {
  const { courseId } = route.params;
  const [words, setWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [stage, setStage] = useState(LearningStage.PREVIEW);
  const [showMemoryTip, setShowMemoryTip] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(null);
  const [sound, setSound] = useState(null);
  const [options, setOptions] = useState([]);
  const [progress, setProgress] = useState(0);
  
  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pinyinFadeAnim = useRef(new Animated.Value(0)).current;
  const pinyinScaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    fetchWords();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    // 每次切换单词或阶段时，重置动画
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    pinyinFadeAnim.setValue(0);
    pinyinScaleAnim.setValue(0.9);
    
    // 淡入动画
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
    
    // 如果是验证阶段，显示拼音动画
    if (stage === LearningStage.VERIFY) {
      showPinyinAnimation();
    }
    
    // 如果是尝试阶段，生成选项
    if (stage === LearningStage.ATTEMPT && words.length > 0) {
      generateOptions();
    }
    
    // 更新进度
    updateProgress();
  }, [currentWordIndex, stage]);

  const updateProgress = () => {
    if (words.length === 0) return;
    
    const totalSteps = words.length * 3; // 每个单词有3个阶段
    const currentStep = currentWordIndex * 3 + getStageValue(stage);
    setProgress(currentStep / totalSteps);
  };
  
  const getStageValue = (stage) => {
    switch(stage) {
      case LearningStage.PREVIEW: return 0;
      case LearningStage.ATTEMPT: return 1;
      case LearningStage.VERIFY: return 2;
      default: return 0;
    }
  };

  const showPinyinAnimation = () => {
    // 拼音淡入弹跳动画
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(pinyinFadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(pinyinScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        })
      ])
    ]).start();
    
    // 播放音频
    playSound();
  };

  const fetchWords = async () => {
    try {
      const response = await fetch(`${API_URL}/words?course_id=${courseId}`);
      
      if (!response.ok) {
        throw new Error('获取单词列表失败');
      }
      
      const data = await response.json();
      if (data.length > 0) {
        setWords(data);
      } else {
        alert('该课程没有单词，请先导入单词。');
        navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs');
      }
    } catch (error) {
      alert(error.message);
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs');
    }
  };

  const handleDeleteWord = async (wordId) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个单词吗？您将不再学习此单词。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/words/${wordId}`, {
                method: 'DELETE',
              });

              if (!response.ok) {
                throw new Error('删除单词失败');
              }

              fetchWords();
              if (currentIndex >= words.length - 1) {
                setCurrentIndex(currentIndex - 1);
              }
            } catch (error) {
              Alert.alert('错误', error.message);
            }
          },
        },
      ]
    );
  };

  const handleMarkAsDifficult = async (wordId) => {
    try {
      const response = await fetch(`${API_URL}/words/${wordId}/mark-difficult`, {
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error('标记为难词失败');
      }

      fetchWords(); // 刷新单词列表
      Alert.alert('成功', '单词已标记为难词');
    } catch (error) {
      Alert.alert('错误', error.message);
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

  const handleNextStage = () => {
    if (stage === LearningStage.PREVIEW) {
      setStage(LearningStage.ATTEMPT);
    } else if (stage === LearningStage.ATTEMPT) {
      setStage(LearningStage.VERIFY);
    } else if (stage === LearningStage.VERIFY) {
      // 更新学习数据到后端
      updateLearningData(isCorrect);
      
      // 移动到下一个单词或完成学习
      if (currentWordIndex < words.length - 1) {
        setCurrentWordIndex(currentWordIndex + 1);
        setStage(LearningStage.PREVIEW);
        setIsCorrect(null);
        setUserAnswer('');
        setShowMemoryTip(false);
      } else {
        // 学习完成，返回课程页面
        alert('恭喜！你已完成本课程的学习。');
        navigation.goBack();
      }
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

  const handleOptionSelect = (option) => {
    setUserAnswer(option.word);
    setIsCorrect(option.id === words[currentWordIndex].id);
    setStage(LearningStage.VERIFY);
  };

  const toggleMemoryTip = () => {
    setShowMemoryTip(!showMemoryTip);
  };

  if (words.length === 0 || currentWordIndex >= words.length) {
    return (
      <View style={styles.container}>
        <Text>加载中...</Text>
      </View>
    );
  }

  const currentWord = words[currentWordIndex];
  
  // 生成记忆提示
  const memoryTip = `将"${currentWord.word}"与"${currentWord.definition.split(' ')[0]}"联想，创建一个生动的画面。`;

  return (
    <LinearGradient
      colors={['#4B79A1', '#283E51']}
      style={styles.container}
    >
      {/* 进度条 */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>
      
      <View style={styles.stageIndicator}>
        <Text style={styles.stageText}>
          {stage === LearningStage.PREVIEW ? '预览' : 
           stage === LearningStage.ATTEMPT ? '尝试' : '验证'}
        </Text>
        <Text style={styles.counterText}>
          {currentWordIndex + 1} / {words.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View 
          style={[
            styles.card,
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* 单词显示区域 */}
          <Text style={styles.wordText}>{currentWord.word}</Text>
          
          {/* 拼音区域 - 仅在预览和验证阶段显示 */}
          {(stage === LearningStage.PREVIEW || stage === LearningStage.VERIFY) && (
            <Animated.View 
              style={[
                styles.pinyinContainer,
                stage === LearningStage.VERIFY ? {
                  opacity: pinyinFadeAnim,
                  transform: [{ scale: pinyinScaleAnim }]
                } : {}
              ]}
            >
              <Text style={styles.pinyinText}>{currentWord.pinyin}</Text>
            </Animated.View>
          )}
          
          {/* 释义区域 - 仅在预览和验证阶段显示 */}
          {(stage === LearningStage.PREVIEW || stage === LearningStage.VERIFY) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>释义</Text>
              <Text style={styles.definitionText}>{currentWord.definition}</Text>
            </View>
          )}
          
          {/* 例句区域 - 仅在预览和验证阶段显示 */}
          {(stage === LearningStage.PREVIEW || stage === LearningStage.VERIFY) && currentWord.example && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>例句</Text>
              <Text style={styles.exampleText}>{currentWord.example}</Text>
            </View>
          )}
          
          {/* 尝试阶段 - 显示选择题 */}
          {stage === LearningStage.ATTEMPT && (
            <View style={styles.attemptContainer}>
              <Text style={styles.attemptTitle}>选择正确的单词</Text>
              <Text style={styles.attemptDescription}>{currentWord.definition}</Text>
              
              <View style={styles.optionsContainer}>
                {options.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.optionButton}
                    onPress={() => handleOptionSelect(option)}
                  >
                    <Text style={styles.optionText}>{option.word}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          
          {/* 验证阶段 - 显示答案反馈 */}
          {stage === LearningStage.VERIFY && (
            <View style={styles.verifyContainer}>
              <View style={[
                styles.resultContainer,
                isCorrect ? styles.correctResult : styles.incorrectResult
              ]}>
                <Ionicons 
                  name={isCorrect ? "checkmark-circle" : "close-circle"} 
                  size={24} 
                  color={isCorrect ? "#4CAF50" : "#FF5722"} 
                />
                <Text style={[
                  styles.resultText,
                  isCorrect ? styles.correctText : styles.incorrectText
                ]}>
                  {isCorrect ? "回答正确!" : "回答错误"}
                </Text>
              </View>
              
              {!isCorrect && (
                <View style={styles.correctAnswerContainer}>
                  <Text style={styles.correctAnswerLabel}>正确答案:</Text>
                  <Text style={styles.correctAnswerText}>{currentWord.word}</Text>
                </View>
              )}
            </View>
          )}
          
          {/* 按钮区域 */}
          <View style={styles.buttonContainer}>
            {stage === LearningStage.PREVIEW && (
              <>
                {currentWord.audio_link && (
                  <TouchableOpacity style={styles.button} onPress={playSound}>
                    <Ionicons name="volume-high" size={24} color="#fff" />
                    <Text style={styles.buttonText}>播放发音</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.button} onPress={toggleMemoryTip}>
                  <Ionicons name="bulb" size={24} color="#fff" />
                  <Text style={styles.buttonText}>记忆提示</Text>
                </TouchableOpacity>
              </>
            )}
            
            {stage === LearningStage.VERIFY && (
              <TouchableOpacity style={styles.button} onPress={playSound}>
                <Ionicons name="volume-high" size={24} color="#fff" />
                <Text style={styles.buttonText}>播放发音</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.button, styles.nextButton]} 
              onPress={handleNextStage}
            >
              <Text style={styles.buttonText}>
                {stage === LearningStage.VERIFY && currentWordIndex === words.length - 1
                  ? '完成学习'
                  : stage === LearningStage.VERIFY
                    ? '下一个单词'
                    : stage === LearningStage.PREVIEW
                      ? '开始练习'
                      : '查看答案'}
              </Text>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {/* 记忆提示区域 */}
          {showMemoryTip && stage === LearningStage.PREVIEW && (
            <View style={styles.memoryTipContainer}>
              <Text style={styles.memoryTipTitle}>记忆提示</Text>
              <Text style={styles.memoryTipText}>{memoryTip}</Text>
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
  progressContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFC107',
  },
  stageIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  stageText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  counterText: {
    color: '#fff',
    fontSize: 16,
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
  wordText: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  pinyinContainer: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
  },
  pinyinText: {
    fontSize: 20,
    color: '#4A90E2',
    textAlign: 'center',
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
  attemptContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  attemptTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  attemptDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
  },
  optionsContainer: {
    width: '100%',
  },
  optionButton: {
    backgroundColor: '#f0f7ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionText: {
    fontSize: 18,
    textAlign: 'center',
  },
  verifyContainer: {
    marginVertical: 20,
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  correctResult: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  incorrectResult: {
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
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
  correctAnswerContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
  },
  correctAnswerLabel: {
    fontSize: 14,
    color: '#666',
  },
  correctAnswerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: '#4B79A1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    minWidth: 140,
  },
  nextButton: {
    backgroundColor: '#283E51',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  memoryTipContainer: {
    backgroundColor: '#fffcf0',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  memoryTipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  memoryTipText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#555',
  },
});

export default LearningScreen;
