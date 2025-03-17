import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const API_URL = 'https://vocabulary-app-full.onrender.com'; // For Android emulator

const LearningMode = {
  SELECT_DEFINITION: 'select_definition',
  SELECT_WORD: 'select_word',
  SELECT_PRONUNCIATION: 'select_pronunciation',
  SPELL_WORD: 'spell_word'
};

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

const ReviewScreen = ({ navigation, route }) => {
  // Added missing state definitions
  const [courseId, setCourseId] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [downloadedCourses, setDownloadedCourses] = useState([]);
  const [loading, setLoading] = useState(true); // Added loading state
  const [reviewWords, setReviewWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [sound, setSound] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [showWordCard, setShowWordCard] = useState(false);
  const [learningMode, setLearningMode] = useState(LearningMode.SELECT_DEFINITION);
  const [candidateChars, setCandidateChars] = useState([]);
  const [selectedChars, setSelectedChars] = useState([]);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    correct: 0,
    incorrect: 0,
  });

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pinyinFadeAnim = useRef(new Animated.Value(0)).current;
  const pinyinBounceAnim = useRef(new Animated.Value(0.9)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

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

        setReviewWords(filteredWords);
        setStats(prev => ({ ...prev, total: filteredWords.length }));
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
    if (reviewWords.length > 0 && currentWordIndex < reviewWords.length) {
      selectLearningMode();

      if (learningMode === LearningMode.SELECT_DEFINITION ||
          learningMode === LearningMode.SELECT_WORD ||
          learningMode === LearningMode.SELECT_PRONUNCIATION) {
        generateOptions();
      } else if (learningMode === LearningMode.SPELL_WORD) {
        generateCandidateChars();
      }

      animateNewQuestion();
    }
  }, [reviewWords, currentWordIndex, learningMode]);

  const handleDeleteWord = async () => {
    const currentWord = reviewWords[currentWordIndex];
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
              const updatedWords = reviewWords.filter(w => w.id !== currentWord.id);
              setReviewWords(updatedWords);
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
    const currentWord = reviewWords[currentWordIndex];
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

  const selectLearningMode = () => {
    const currentWord = reviewWords[currentWordIndex];

    const availableModes = [
      LearningMode.SELECT_DEFINITION,
      LearningMode.SELECT_WORD,
      LearningMode.SPELL_WORD
    ];

    if (currentWord && currentWord.audio_link) {
      availableModes.push(LearningMode.SELECT_PRONUNCIATION);
    }

    const randomIndex = Math.floor(Math.random() * availableModes.length);
    setLearningMode(availableModes[randomIndex]);
  };

  const generateOptions = () => {
    if (reviewWords.length < 4) return;

    const correctWord = reviewWords[currentWordIndex];
    let allOptions = [correctWord];

    const otherWords = reviewWords.filter((_, index) => index !== currentWordIndex);
    const shuffled = [...otherWords].sort(() => 0.5 - Math.random());
    allOptions = [...allOptions, ...shuffled.slice(0, 3)];

    const shuffledOptions = allOptions.sort(() => 0.5 - Math.random());
    setOptions(shuffledOptions);

    const correctIndex = shuffledOptions.findIndex(option => option.id === correctWord.id);
    setCorrectOptionIndex(correctIndex);
    setSelectedOptionIndex(null);
  };

  const generateCandidateChars = () => {
    const currentWord = reviewWords[currentWordIndex];
    if (!currentWord) return;

    const wordChars = currentWord.word.split('');

    let candidatePool = [...wordChars];

    const allChars = reviewWords.reduce((chars, word) => {
      return chars.concat(word.word.split(''));
    }, []);

    const uniqueChars = [...new Set(allChars)];

    const randomChars = uniqueChars
      .filter(char => !wordChars.includes(char))
      .sort(() => 0.5 - Math.random())
      .slice(0, 10 - wordChars.length);

    candidatePool = candidatePool.concat(randomChars);

    while (candidatePool.length < 10) {
      candidatePool.push(randomChars[Math.floor(Math.random() * randomChars.length)]);
    }

    setCandidateChars(candidatePool.sort(() => 0.5 - Math.random()));
    setSelectedChars([]);
  };

  const animateNewQuestion = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(300);
    pinyinFadeAnim.setValue(0);
    pinyinBounceAnim.setValue(0.9);

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

    playSound();
  };

  const animateCorrectAnswer = () => {
    showPinyinAnimation();
  };

  const animateIncorrectAnswer = () => {
    showPinyinAnimation();

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
    const currentWord = reviewWords[currentWordIndex];
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

  const handleOptionSelect = async (option, index) => {
    let correct = false;

    if (learningMode === LearningMode.SELECT_DEFINITION ||
        learningMode === LearningMode.SELECT_PRONUNCIATION) {
      correct = option.id === reviewWords[currentWordIndex].id;
    } else if (learningMode === LearningMode.SELECT_WORD) {
      correct = option.word === reviewWords[currentWordIndex].word;
    }

    setIsCorrect(correct);
    setSelectedOptionIndex(index);

    if (correct) {
      animateCorrectAnswer();
      setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      animateIncorrectAnswer();
      setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
      setTimeout(() => {
        setShowWordCard(true);
      }, 1000);
    }

    await updateLearningData(correct);
  };

  const handleCharSelect = (char, index) => {
    const currentWord = reviewWords[currentWordIndex];
    if (selectedChars.length >= currentWord.word.length) return;

    setSelectedChars([...selectedChars, char]);

    const newCandidates = [...candidateChars];
    newCandidates.splice(index, 1);
    setCandidateChars(newCandidates);

    setTimeout(() => {
      const updatedSelected = [...selectedChars, char];
      if (updatedSelected.length === currentWord.word.length) {
        const spelled = updatedSelected.join('');
        const correct = spelled === currentWord.word;

        setIsCorrect(correct);

        if (correct) {
          animateCorrectAnswer();
          setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
        } else {
          animateIncorrectAnswer();
          setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
          setTimeout(() => {
            setShowWordCard(true);
          }, 1000);
        }

        updateLearningData(correct);
      }
    }, 100);
  };

  const handleNextWord = () => {
    if (showWordCard) {
      setShowWordCard(false);
      setTimeout(() => {
        moveToNextWord();
      }, 300);
    } else {
      moveToNextWord();
    }
  };

  const moveToNextWord = () => {
    if (currentWordIndex < reviewWords.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1);
      setIsCorrect(null);
      setSelectedOptionIndex(null);
    } else {
      setCompleted(true);
    }
  };

  const updateLearningData = async (correct) => {
    try {
      const currentWord = reviewWords[currentWordIndex];

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
    setIsCorrect(null);
    setShowWordCard(false);
    setCompleted(false);
    setStats({
      total: reviewWords.length,
      correct: 0,
      incorrect: 0,
    });

    setReviewWords(prev => [...prev].sort(() => 0.5 - Math.random()));
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

  if (reviewWords.length === 0) {
    return (
      <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
        <View style={styles.container}>
          <Text style={styles.loadingText}>没有已学单词可复习</Text>
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
          <Text style={styles.completedText}>复习完成！</Text>
          <Text style={styles.statsText}>
            总计: {stats.total} | 正确: {stats.correct} | 错误: {stats.incorrect}
          </Text>
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

  const currentWord = reviewWords[currentWordIndex];

  return (
    <LinearGradient
      colors={['#4B79A1', '#283E51']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {route.params?.screenTitle || '复习'}
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

      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${(currentWordIndex + 1) / reviewWords.length * 100}%` }]} />
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          正确: {stats.correct} | 错误: {stats.incorrect}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                { translateX: slideAnim },
                { translateX: shakeAnim }
              ]
            }
          ]}
        >
          <View style={styles.wordContainer}>
            <Text style={styles.wordText}>{currentWord.word}</Text>
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
          </View>

          {learningMode === LearningMode.SELECT_DEFINITION && (
            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>选择正确的释义</Text>
              <View style={styles.optionsContainer}>
                {options.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionButton,
                      selectedOptionIndex === index && styles.selectedOption,
                      isCorrect !== null && index === correctOptionIndex && styles.correctOption,
                      isCorrect !== null && selectedOptionIndex === index && isCorrect === false && styles.incorrectOption
                    ]}
                    onPress={() => handleOptionSelect(option, index)}
                    disabled={isCorrect !== null}
                  >
                    <Text style={styles.optionText}>{option.definition}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {learningMode === LearningMode.SELECT_WORD && (
            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>选择正确的单词</Text>
              <View style={styles.optionsContainer}>
                {options.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionButton,
                      selectedOptionIndex === index && styles.selectedOption,
                      isCorrect !== null && index === correctOptionIndex && styles.correctOption,
                      isCorrect !== null && selectedOptionIndex === index && isCorrect === false && styles.incorrectOption
                    ]}
                    onPress={() => handleOptionSelect(option, index)}
                    disabled={isCorrect !== null}
                  >
                    <Text style={styles.optionText}>{option.word}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {learningMode === LearningMode.SELECT_PRONUNCIATION && currentWord.audio_link && (
            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>选择正确的发音</Text>
              <View style={styles.optionsContainer}>
                {options.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionButton,
                      selectedOptionIndex === index && styles.selectedOption,
                      isCorrect !== null && index === correctOptionIndex && styles.correctOption,
                      isCorrect !== null && selectedOptionIndex === index && isCorrect === false && styles.incorrectOption
                    ]}
                    onPress={() => {
                      playSoundForOption(option, index);
                    }}
                    disabled={isCorrect !== null}
                  >
                    <Ionicons name="volume-high" size={24} color="#4B79A1" />
                    <Text style={styles.optionText}>发音 {index + 1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {learningMode === LearningMode.SPELL_WORD && (
            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>填写正确的汉字</Text>
              <View style={styles.spellingContainer}>
                {Array.from({ length: currentWord.word.length }).map((_, index) => (
                  <View key={index} style={styles.spellingSlot}>
                    <Text style={styles.spellingChar}>{selectedChars[index] || ''}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.candidateContainer}>
                {candidateChars.map((char, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.candidateButton}
                    onPress={() => handleCharSelect(char, index)}
                    disabled={isCorrect !== null}
                  >
                    <Text style={styles.candidateChar}>{char}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {showWordCard && (
            <View style={styles.wordCard}>
              <Text style={styles.wordCardText}>单词: {currentWord.word}</Text>
              <Text style={styles.wordCardText}>拼音: {currentWord.pinyin}</Text>
              <Text style={styles.wordCardText}>释义: {currentWord.definition}</Text>
              {currentWord.example && (
                <Text style={styles.wordCardText}>例句: {currentWord.example}</Text>
              )}
              {currentWord.audio_link && (
                <TouchableOpacity style={styles.playButton} onPress={playSound}>
                  <Ionicons name="volume-high" size={24} color="#fff" />
                  <Text style={styles.playButtonText}>播放发音</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.buttonContainer}>
            {currentWord.audio_link && (
              <TouchableOpacity style={styles.button} onPress={playSound}>
                <Ionicons name="volume-high" size={24} color="#fff" />
                <Text style={styles.buttonText}>播放发音</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, styles.nextButton]}
              onPress={handleNextWord}
              disabled={isCorrect === null}
            >
              <Text style={styles.buttonText}>下一个</Text>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
};

const playSoundForOption = async (option, index) => {
  const { sound, setSound } = useContext(SomeContext); // Assume a context for sound management
  if (sound) await sound.unloadAsync();

  let audioUri = option.audio_link;
  if (isOffline) {
    const audioFileName = option.audio_link.split('/').pop();
    audioUri = `${FileSystem.documentDirectory}courses/${courseId}/audio/${audioFileName}`;
  }

  const { sound: newSound } = await Audio.Sound.createAsync(
    { uri: audioUri },
    { shouldPlay: true }
  );
  setSound(newSound);
  handleOptionSelect(option, index);
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
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  statsContainer: {
    padding: 8,
    alignItems: 'center',
  },
  statsText: {
    color: '#fff',
    fontSize: 14,
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
  pinyinContainer: {
    marginTop: 8,
  },
  pinyinText: {
    fontSize: 18,
    color: '#4A90E2',
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedOption: {
    borderColor: '#4B79A1',
    borderWidth: 2,
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
    flex: 1,
  },
  spellingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 16,
  },
  spellingSlot: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    backgroundColor: '#f9f9f9',
  },
  spellingChar: {
    fontSize: 20,
    color: '#333',
  },
  candidateContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 16,
  },
  candidateButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#4B79A1',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    backgroundColor: '#f0f8ff',
  },
  candidateChar: {
    fontSize: 20,
    color: '#4B79A1',
  },
  wordCard: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  wordCardText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  playButton: {
    backgroundColor: '#4B79A1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  playButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    backgroundColor: '#4B79A1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  nextButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginHorizontal: 4,
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

export default ReviewScreen;