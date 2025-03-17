import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import AnimatedFeedback from '../components/AnimatedFeedback';

const API_URL = 'https://vocabulary-app-full.onrender.com';

const LearningStage = { PREVIEW: 'preview', ATTEMPT: 'attempt', VERIFY: 'verify' };
const LearningMode = { SELECT_DEFINITION: 'select_definition', SELECT_WORD: 'select_word', SELECT_PRONUNCIATION: 'select_pronunciation', SPELL_WORD: 'spell_word' };

const getSelectedCourseWords = async (courseId, isOffline, downloadedCourses, forceRefresh = false) => {
  let words = [];
  try {
    const courseDir = `${FileSystem.documentDirectory}courses/${courseId}/`;
    const filePath = `${courseDir}words.json`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (fileInfo.exists && !forceRefresh) {
      try {
        const wordsJson = await FileSystem.readAsStringAsync(filePath);
        const data = JSON.parse(wordsJson);
        words = data.words; // 假设包含 timestamp 的结构
        if (!Array.isArray(words) || words.length === 0) throw new Error('本地单词数据无效');
        console.log('Loaded offline words:', words);
      } catch (parseError) {
        console.error('解析 words.json 失败:', parseError);
        throw new Error('本地数据损坏');
      }
    } else if (!isOffline) {
      const response = await fetch(`${API_URL}/words?course_id=${courseId}`);
      if (!response.ok) throw new Error('获取单词失败');
      words = await response.json();
      console.log('Loaded online words:', words);
      await FileSystem.makeDirectoryAsync(courseDir, { intermediates: true });
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify({ words, timestamp: Date.now() }));
    }

    if (!Array.isArray(words) || words.length === 0) throw new Error('单词数据为空');
    return words.map(word => ({
      ...word,
      is_learned: word.is_learned ?? false,
      id: word.id || `${courseId}-${Math.random().toString(36).substr(2)}`,
    }));
  } catch (error) {
    console.error('获取单词错误:', error.message);
    throw error;
  }
};

const LearningScreen = ({ route, navigation }) => {
  const [courseId, setCourseId] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [downloadedCourses, setDownloadedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState([]);
  const [newWords, setNewWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [stage, setStage] = useState(LearningStage.PREVIEW);
  const [showMemoryTip, setShowMemoryTip] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(null);
  const [sound, setSound] = useState(null);
  const [options, setOptions] = useState([]);
  const [progress, setProgress] = useState(0);
  const [learningMode, setLearningMode] = useState(LearningMode.SELECT_DEFINITION);
  const [correctAnswerCount, setCorrectAnswerCount] = useState(0);
  const [wordCorrectCount, setWordCorrectCount] = useState({});
  const [candidateChars, setCandidateChars] = useState([]);
  const [selectedChars, setSelectedChars] = useState([]);
  const [showHint, setShowHint] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pinyinFadeAnim = useRef(new Animated.Value(0)).current;
  const pinyinScaleAnim = useRef(new Animated.Value(0.9)).current;

  

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
            Alert.alert('错误', '未找到选中的课程，请在“我的课程”中选择');
            navigation.goBack();
            return;
          }
        }
      } catch (error) {
        Alert.alert('错误', '初始化课程失败');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    initializeCourse();
  }, [route?.params, navigation]);

  useEffect(() => {
    const fetchWords = async (forceRefresh = false) => {
      if (!courseId) return;
      try {
        const fetchedWords = await getSelectedCourseWords(courseId, isOffline, downloadedCourses, forceRefresh);
        let filteredWords = fetchedWords.filter(word => !word.is_learned);
        if (filteredWords.length === 0) {
          Alert.alert('提示', '没有新单词可学', [
            { text: '返回', onPress: () => navigation.goBack() },
            { text: '刷新', onPress: () => fetchWords(true) },
          ]);
          return;
        }
        setWords(filteredWords);
        selectNewWords();
      } catch (error) {
        Alert.alert('错误', '加载单词失败: ' + error.message, [
          { text: '返回', onPress: () => navigation.goBack() },
          { text: '重试', onPress: () => fetchWords() },
        ]);
      }
    };
    if (courseId) fetchWords();
  }, [courseId, isOffline, route.name]);

  useEffect(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    pinyinFadeAnim.setValue(0);
    pinyinScaleAnim.setValue(0.9);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    if (stage === LearningStage.VERIFY) showPinyinAnimation();
    if (stage === LearningStage.ATTEMPT && newWords.length > 0) {
      if (learningMode === LearningMode.SELECT_DEFINITION || learningMode === LearningMode.SELECT_WORD || learningMode === LearningMode.SELECT_PRONUNCIATION) {
        generateOptions();
      } else if (learningMode === LearningMode.SPELL_WORD) {
        generateCandidateChars();
      }
    }
    updateProgress();
    if (stage === LearningStage.PREVIEW && newWords.length > 0) playSound();
  }, [currentWordIndex, stage, learningMode, newWords]);

  const updateProgress = () => {
    if (newWords.length === 0) return;
    const totalSteps = newWords.length * 3;
    const currentStep = currentWordIndex * 3 + (stage === LearningStage.PREVIEW ? 0 : stage === LearningStage.ATTEMPT ? 1 : 2);
    setProgress(currentStep / totalSteps);
  };

  const handleDeleteWord = async () => {
    const currentWord = newWords[currentWordIndex];
    if (!currentWord) return;
    Alert.alert('确认删除', '确定删除此单词？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!isOffline) await fetch(`${API_URL}/words/${currentWord.id}`, { method: 'DELETE' });
            const updatedWords = newWords.filter(w => w.id !== currentWord.id);
            setNewWords(updatedWords);
            if (currentWordIndex >= updatedWords.length) setCurrentWordIndex(updatedWords.length - 1);
          } catch (error) {
            Alert.alert('错误', error.message);
          }
        },
      },
    ]);
  };

  const handleMarkAsDifficult = async () => {
    const currentWord = newWords[currentWordIndex];
    if (!currentWord) return;
    try {
      if (!isOffline) await fetch(`${API_URL}/words/${currentWord.id}/mark-difficult`, { method: 'PUT' });
      Alert.alert('成功', '单词已标记为难词');
    } catch (error) {
      Alert.alert('错误', error.message);
    }
  };

  const showPinyinAnimation = () => {
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(pinyinFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(pinyinScaleAnim, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
      ]),
    ]).start();
    playSound();
  };

  const selectNewWords = () => {
    const shuffled = [...words].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    setNewWords(selected);
    const initialCounts = {};
    selected.forEach(word => initialCounts[word.id] = 0);
    setWordCorrectCount(initialCounts);
    selectRandomLearningMode();
  };

  const selectRandomLearningMode = () => {
    const currentWord = newWords[currentWordIndex];
    const modes = [LearningMode.SELECT_DEFINITION, LearningMode.SELECT_WORD];
    if (currentWord?.audio_link) modes.push(LearningMode.SELECT_PRONUNCIATION);
    modes.push(LearningMode.SPELL_WORD);
    setLearningMode(modes[Math.floor(Math.random() * modes.length)]);
  };

  const generateOptions = () => {
    if (newWords.length < 4) return;
    const correctWord = newWords[currentWordIndex];
    let allOptions = [correctWord];
    const otherWords = newWords.filter((_, i) => i !== currentWordIndex);
    const shuffled = [...otherWords].sort(() => 0.5 - Math.random());
    allOptions = [...allOptions, ...shuffled.slice(0, 3)];
    setOptions(allOptions.sort(() => 0.5 - Math.random()));
  };

  const generateCandidateChars = () => {
    const currentWord = newWords[currentWordIndex];
    if (!currentWord) return;
    const wordChars = currentWord.word.split('');
    let candidatePool = [...wordChars];
    const allChars = words.reduce((chars, w) => chars.concat(w.word.split('')), []);
    const uniqueChars = [...new Set(allChars)];
    const randomChars = uniqueChars.filter(c => !wordChars.includes(c)).sort(() => 0.5 - Math.random()).slice(0, 10 - wordChars.length);
    candidatePool = [...candidatePool, ...randomChars];
    while (candidatePool.length < 10) candidatePool.push(randomChars[Math.floor(Math.random() * randomChars.length)]);
    setCandidateChars(candidatePool.sort(() => 0.5 - Math.random()));
    setSelectedChars([]);
    setShowHint(false);
  };

  const playSound = async () => {
    const currentWord = newWords[currentWordIndex];
    if (!currentWord?.audio_link) return;
    try {
      if (sound) await sound.unloadAsync();
      let audioUri = currentWord.audio_link;
      if (isOffline) {
        const audioFileName = currentWord.audio_link.split('/').pop();
        audioUri = `${FileSystem.documentDirectory}courses/${courseId}/audio/${audioFileName}`;
      }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: true });
      setSound(newSound);
    } catch (error) {
      Alert.alert('错误', '播放音频失败');
    }
  };

  const handleNextStage = () => {
    if (stage === LearningStage.PREVIEW) {
      setStage(LearningStage.ATTEMPT);
    } else if (stage === LearningStage.ATTEMPT) {
      setStage(LearningStage.VERIFY);
    } else if (stage === LearningStage.VERIFY) {
      if (currentWordIndex < newWords.length - 1) {
        setCurrentWordIndex(currentWordIndex + 1);
        setStage(LearningStage.PREVIEW);
        setIsCorrect(null);
        setUserAnswer('');
        setShowMemoryTip(false);
        setFeedbackVisible(false);
        selectRandomLearningMode();
      } else {
        const allCompleted = Object.values(wordCorrectCount).every(count => count >= 5);
        if (allCompleted) {
          addWordsToReviewLibrary();
          Alert.alert('恭喜！', '学习完成，已添加到复习库');
          navigation.goBack();
        } else {
          Alert.alert('提示', `需所有单词答对5次，目前完成${Object.values(wordCorrectCount).filter(c => c >= 5).length}个`);
          resetLearning();
        }
      }
    }
  };

  const resetLearning = () => {
    setCurrentWordIndex(0);
    setStage(LearningStage.PREVIEW);
    setIsCorrect(null);
    setUserAnswer('');
    setShowMemoryTip(false);
    setFeedbackVisible(false);
    const initialCounts = {};
    newWords.forEach(word => initialCounts[word.id] = 0);
    setWordCorrectCount(initialCounts);
    selectRandomLearningMode();
  };

  const addWordsToReviewLibrary = async () => {
    try {
      const completedWordIds = Object.entries(wordCorrectCount).filter(([_, count]) => count >= 5).map(([id]) => id);
      if (isOffline) {
        const reviewLibraryJson = await AsyncStorage.getItem('reviewLibrary') || '[]';
        const reviewLibrary = JSON.parse(reviewLibraryJson);
        const completedWords = newWords.filter(w => completedWordIds.includes(w.id));
        await AsyncStorage.setItem('reviewLibrary', JSON.stringify([...reviewLibrary, ...completedWords]));
      } else {
        for (const wordId of completedWordIds) {
          await fetch(`${API_URL}/words/${wordId}/add-to-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        }
      }
    } catch (error) {
      console.error('添加到复习库失败:', error);
    }
  };

  const updateLearningData = async (correct) => {
    try {
      const currentWord = newWords[currentWordIndex];
      if (correct) setWordCorrectCount(prev => ({ ...prev, [currentWord.id]: prev[currentWord.id] + 1 }));
      if (!isOffline) {
        await fetch(`${API_URL}/words/${currentWord.id}/update-learning-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correct }),
        });
      }
    } catch (error) {
      console.error('更新学习数据失败:', error);
    }
  };

  const handleOptionSelect = (option) => {
    let correct = false;
    if (learningMode === LearningMode.SELECT_DEFINITION || learningMode === LearningMode.SELECT_PRONUNCIATION) {
      correct = option.id === newWords[currentWordIndex].id;
      setUserAnswer(option.word);
    } else if (learningMode === LearningMode.SELECT_WORD) {
      correct = option.word === newWords[currentWordIndex].word;
      setUserAnswer(option.word);
    }
    setIsCorrect(correct);
    setFeedbackVisible(true);
    updateLearningData(correct);
    setTimeout(() => setStage(LearningStage.VERIFY), 1000);
  };

  const handleCharSelect = (char, index) => {
    const currentWord = newWords[currentWordIndex];
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
        setFeedbackVisible(true);
        updateLearningData(correct);
        setTimeout(() => setStage(LearningStage.VERIFY), 1000);
      }
    }, 100);
  };

  const handleShowHint = () => {
    const currentWord = newWords[currentWordIndex];
    const nextCharIndex = selectedChars.length;
    if (nextCharIndex >= currentWord.word.length) return;
    const nextChar = currentWord.word[nextCharIndex];
    const charIndex = candidateChars.findIndex(c => c === nextChar);
    if (charIndex === -1) return;
    setSelectedChars([...selectedChars, nextChar]);
    const newCandidates = [...candidateChars];
    newCandidates.splice(charIndex, 1);
    setCandidateChars(newCandidates);
    setShowHint(true);
    setTimeout(() => {
      const updatedSelected = [...selectedChars, nextChar];
      if (updatedSelected.length === currentWord.word.length) {
        const spelled = updatedSelected.join('');
        const correct = spelled === currentWord.word;
        setIsCorrect(correct);
        setFeedbackVisible(true);
        updateLearningData(correct);
        setTimeout(() => setStage(LearningStage.VERIFY), 1000);
      }
    }, 100);
  };

  const handleDontKnow = () => {
    const currentWord = newWords[currentWordIndex];
    if (learningMode === LearningMode.SPELL_WORD) {
      setSelectedChars(currentWord.word.split(''));
      setCandidateChars([]);
    }
    setIsCorrect(false);
    setFeedbackVisible(true);
    updateLearningData(false);
    setTimeout(() => setStage(LearningStage.VERIFY), 1000);
  };

  const toggleMemoryTip = () => setShowMemoryTip(!showMemoryTip);

  if (loading) return <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}><Text style={styles.loadingText}>加载中...</Text></LinearGradient>;
  if (newWords.length === 0 || currentWordIndex >= newWords.length) return (
    <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
      <View style={styles.container}>
        <Text style={styles.loadingText}>没有新单词可学</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}><Text style={styles.buttonText}>返回</Text></TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const currentWord = newWords[currentWordIndex];
  const memoryTip = `将"${currentWord.word}"与"${currentWord.definition.split(' ')[0]}"联想，创建一个生动的画面。`;
  const currentWordCorrectCount = wordCorrectCount[currentWord.id] || 0;

  return (
    <LinearGradient colors={['#4B79A1', '#283E51']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{route.params?.screenTitle || '学习'}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleDeleteWord}><Ionicons name="trash" size={24} color="#FF5722" /></TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleMarkAsDifficult}><Ionicons name="alert-circle" size={24} color="#FF9800" /></TouchableOpacity>
        </View>
      </View>
      <View style={styles.progressContainer}><View style={[styles.progressBar, { width: `${progress * 100}%` }]} /></View>
      <View style={styles.stageIndicator}>
        <Text style={styles.stageText}>{stage === LearningStage.PREVIEW ? '预览' : stage === LearningStage.ATTEMPT ? '尝试' : '验证'}</Text>
        <Text style={styles.counterText}>{currentWordIndex + 1} / {newWords.length}</Text>
      </View>
      <View style={styles.correctCountContainer}><Text style={styles.correctCountText}>正确次数: {currentWordCorrectCount}/5</Text></View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          {(stage === LearningStage.PREVIEW || stage === LearningStage.VERIFY) && (
            <View style={styles.wordContainer}>
              <Text style={styles.wordText}>{currentWord.word}</Text>
              {stage === LearningStage.VERIFY && (
                <Animated.View style={[styles.pinyinContainer, { opacity: pinyinFadeAnim, transform: [{ scale: pinyinScaleAnim }] }]}>
                  <Text style={styles.pinyinText}>{currentWord.pinyin}</Text>
                </Animated.View>
              )}
            </View>
          )}
          {(stage === LearningStage.PREVIEW || stage === LearningStage.VERIFY || (stage === LearningStage.ATTEMPT && (learningMode === LearningMode.SELECT_WORD || learningMode === LearningMode.SPELL_WORD))) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>释义</Text>
              <Text style={styles.definitionText}>{currentWord.definition}</Text>
            </View>
          )}
          {(stage === LearningStage.PREVIEW || stage === LearningStage.VERIFY) && currentWord.example && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>例句</Text>
              <Text style={styles.exampleText}>{currentWord.example}</Text>
            </View>
          )}
          {stage === LearningStage.ATTEMPT && (
            <>
              {learningMode === LearningMode.SELECT_DEFINITION && (
                <View style={styles.attemptContainer}>
                  <Text style={styles.attemptTitle}>选择正确释义</Text>
                  <Text style={styles.attemptDescription}>{currentWord.word}</Text>
                  <View style={styles.optionsContainer}>
                    {options.map((option, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.optionButton,
                          feedbackVisible && option.id === currentWord.id && styles.correctOption,
                          feedbackVisible && isCorrect === false && option.id === options.find(o => o.id === currentWord.id)?.id && styles.correctOption,
                          feedbackVisible && isCorrect === false && option.id === options.find(o => o.word === userAnswer)?.id && styles.incorrectOption,
                        ]}
                        onPress={() => handleOptionSelect(option)}
                        disabled={feedbackVisible}
                      >
                        <Text style={[
                          styles.optionText,
                          feedbackVisible && option.id === currentWord.id && styles.correctOptionText,
                          feedbackVisible && isCorrect === false && option.id === options.find(o => o.word === userAnswer)?.id && styles.incorrectOptionText,
                        ]}>
                          {option.definition}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {feedbackVisible && <AnimatedFeedback isCorrect={isCorrect} />}
                </View>
              )}
              {learningMode === LearningMode.SELECT_WORD && (
                <View style={styles.attemptContainer}>
                  <Text style={styles.attemptTitle}>选择正确单词</Text>
                  <View style={styles.optionsContainer}>
                    {options.map((option, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.optionButton,
                          feedbackVisible && option.word === currentWord.word && styles.correctOption,
                          feedbackVisible && isCorrect === false && option.word === userAnswer && styles.incorrectOption,
                        ]}
                        onPress={() => handleOptionSelect(option)}
                        disabled={feedbackVisible}
                      >
                        <Text style={[
                          styles.optionText,
                          feedbackVisible && option.word === currentWord.word && styles.correctOptionText,
                          feedbackVisible && isCorrect === false && option.word === userAnswer && styles.incorrectOptionText,
                        ]}>
                          {option.word}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {feedbackVisible && <AnimatedFeedback isCorrect={isCorrect} />}
                </View>
              )}
              {learningMode === LearningMode.SELECT_PRONUNCIATION && currentWord.audio_link && (
                <View style={styles.attemptContainer}>
                  <Text style={styles.attemptTitle}>选择正确发音</Text>
                  <Text style={styles.attemptDescription}>{currentWord.word}</Text>
                  <View style={styles.optionsContainer}>
                    {options.map((option, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.optionButton,
                          feedbackVisible && option.id === currentWord.id && styles.correctOption,
                          feedbackVisible && isCorrect === false && option.id === options.find(o => o.word === userAnswer)?.id && styles.incorrectOption,
                        ]}
                        onPress={() => {
                          const playOptionSound = async () => {
                            try {
                              if (sound) await sound.unloadAsync();
                              let audioUri = option.audio_link;
                              if (isOffline) audioUri = `${FileSystem.documentDirectory}courses/${courseId}/audio/${option.audio_link.split('/').pop()}`;
                              const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: true });
                              setSound(newSound);
                              newSound.setOnPlaybackStatusUpdate(status => { if (status.didJustFinish) handleOptionSelect(option); });
                            } catch (error) {
                              handleOptionSelect(option);
                            }
                          };
                          playOptionSound();
                        }}
                        disabled={feedbackVisible}
                      >
                        <Ionicons name="volume-high" size={24} color="#4B79A1" />
                        <Text style={styles.optionText}>发音 {index + 1}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {feedbackVisible && <AnimatedFeedback isCorrect={isCorrect} />}
                </View>
              )}
              {learningMode === LearningMode.SPELL_WORD && (
                <View style={styles.attemptContainer}>
                <Text style={styles.attemptTitle}>填写正确汉字</Text>
                <View style={styles.spellingContainer}>
                  {Array.from({ length: currentWord.word.length }).map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.spellingSlot,
                        feedbackVisible && isCorrect && styles.correctSpellingSlot,
                        feedbackVisible && !isCorrect && styles.incorrectSpellingSlot,
                      ]}
                    >
                      <Text
                        style={[
                          styles.spellingChar,
                          feedbackVisible && isCorrect && styles.correctSpellingChar,
                          feedbackVisible && !isCorrect && styles.incorrectSpellingChar,
                        ]}
                      >
                        {selectedChars[index] || ''}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.candidateContainer}>
                  {candidateChars.map((char, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.candidateButton}
                      onPress={() => handleCharSelect(char, index)} // 修正为 handleCharSelect
                      disabled={feedbackVisible}
                    >
                      <Text style={styles.candidateChar}>{char}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.spellingButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.spellingButton, feedbackVisible && isCorrect && styles.correctButton]}
                    onPress={handleShowHint}
                    disabled={feedbackVisible || selectedChars.length >= currentWord.word.length}
                  >
                    <Text style={styles.spellingButtonText}>{feedbackVisible && isCorrect ? '正确！' : '提示'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.spellingButton}
                    onPress={handleDontKnow}
                    disabled={feedbackVisible}
                  >
                    <Text style={styles.spellingButtonText}>我不知道</Text>
                  </TouchableOpacity>
                </View>
                  {feedbackVisible && <AnimatedFeedback isCorrect={isCorrect} />}
                </View>
              )}
            </>
          )}
          {stage === LearningStage.VERIFY && (
            <View style={styles.verifyContainer}>
              {isCorrect ? (
                <View style={styles.resultContainer}>
                  <Text style={[styles.resultText, styles.correctResultText]}>你答对了！</Text>
                </View>
              ) : (
                <View style={styles.resultContainer}>
                  <Text style={[styles.resultText, styles.incorrectResultText]}>答案错误</Text>
                  <Text style={styles.correctAnswerText}>正确答案是：{learningMode === LearningMode.SPELL_WORD ? currentWord.word : currentWord.definition}</Text>
                </View>
              )}
              <Animated.View style={[styles.pinyinContainer, { opacity: pinyinFadeAnim, transform: [{ scale: pinyinScaleAnim }] }]}>
                <Text style={styles.pinyinText}>{currentWord.pinyin}</Text>
              </Animated.View>
              <TouchableOpacity style={[styles.button, styles.nextButton]} onPress={handleNextStage}>
                <Text style={styles.buttonText}>下一个</Text>
                <Ionicons name="arrow-forward" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
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
                <TouchableOpacity style={[styles.button, styles.nextButton]} onPress={handleNextStage}>
                  <Text style={styles.buttonText}>开始学习</Text>
                  <Ionicons name="arrow-forward" size={24} color="#fff" />
                </TouchableOpacity>
              </>
            )}
            {(stage === LearningStage.ATTEMPT || stage === LearningStage.VERIFY) && currentWord.audio_link && (
              <TouchableOpacity style={styles.button} onPress={playSound}>
                <Ionicons name="volume-high" size={24} color="#fff" />
                <Text style={styles.buttonText}>播放发音</Text>
              </TouchableOpacity>
            )}
            {stage === LearningStage.ATTEMPT && (
              <TouchableOpacity
                style={[styles.button, styles.nextButton]}
                onPress={() => {
                  setUserAnswer(learningMode === LearningMode.SELECT_DEFINITION ? currentWord.definition : currentWord.word);
                  setIsCorrect(false);
                  setFeedbackVisible(true);
                  setTimeout(() => setStage(LearningStage.VERIFY), 1000);
                }}
                disabled={feedbackVisible}
              >
                <Text style={styles.buttonText}>查看答案</Text>
                <Ionicons name="eye" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  actionButtons: { flexDirection: 'row' },
  actionButton: { padding: 8, marginLeft: 8 },
  progressContainer: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', width: '100%' },
  progressBar: { height: '100%', backgroundColor: '#4CAF50' },
  stageIndicator: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, paddingTop: 8 },
  stageText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  counterText: { color: '#fff', fontSize: 16 },
  correctCountContainer: { alignItems: 'center', marginBottom: 8 },
  correctCountText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  scrollContent: { flexGrow: 1, padding: 16, paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  wordContainer: { alignItems: 'center', marginBottom: 20 },
  wordText: { fontSize: 36, fontWeight: 'bold', color: '#333' },
  pinyinContainer: { marginTop: 8 },
  pinyinText: { fontSize: 18, color: '#4A90E2' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  definitionText: { fontSize: 16, color: '#555', lineHeight: 24 },
  exampleText: { fontSize: 16, color: '#555', fontStyle: 'italic', lineHeight: 24 },
  attemptContainer: { marginBottom: 20 },
  attemptTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign: 'center' },
  attemptDescription: { fontSize: 24, color: '#333', marginBottom: 16, textAlign: 'center' },
  optionsContainer: { marginTop: 8 },
  optionButton: { backgroundColor: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  correctOption: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50', borderWidth: 1 },
  incorrectOption: { backgroundColor: '#FFEBEE', borderColor: '#FF5722', borderWidth: 1 },
  optionText: { fontSize: 16, color: '#333', flex: 1 },
  correctOptionText: { color: '#4CAF50', fontWeight: 'bold' },
  incorrectOptionText: { color: '#FF5722', fontWeight: 'bold' },
  verifyContainer: { marginBottom: 20 },
  resultContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 8, marginBottom: 16 },
  correctResultText: { fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: '#4CAF50' },
  incorrectResultText: { fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: '#FF5722' },
  resultText: { fontSize: 18, fontWeight: 'bold' },
  correctAnswerText: { fontSize: 16, color: '#333', fontWeight: 'bold' },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap' },
  button: { backgroundColor: '#4B79A1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, flex: 1, marginHorizontal: 4, marginVertical: 4 },
  nextButton: { backgroundColor: '#4CAF50' },
  buttonText: { color: '#fff', fontWeight: 'bold', marginHorizontal: 4 },
  memoryTipContainer: { backgroundColor: '#FFF9C4', padding: 16, borderRadius: 8, marginTop: 16 },
  memoryTipTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  memoryTipText: { fontSize: 14, color: '#555', lineHeight: 20 },
  spellingContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 16 },
  spellingSlot: { width: 40, height: 40, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, justifyContent: 'center', alignItems: 'center', margin: 4, backgroundColor: '#f9f9f9' },
  correctSpellingSlot: { borderColor: '#4CAF50', backgroundColor: '#E8F5E9' },
  incorrectSpellingSlot: { borderColor: '#FF5722', backgroundColor: '#FFEBEE' },
  spellingChar: { fontSize: 20, color: '#333' },
  correctSpellingChar: { color: '#4CAF50' },
  incorrectSpellingChar: { color: '#FF5722' },
  candidateContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 16 },
  candidateButton: { width: 40, height: 40, borderWidth: 1, borderColor: '#4B79A1', borderRadius: 4, justifyContent: 'center', alignItems: 'center', margin: 4, backgroundColor: '#f0f8ff' },
  candidateChar: { fontSize: 20, color: '#4B79A1' },
  spellingButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  spellingButton: { backgroundColor: '#4B79A1', padding: 12, borderRadius: 8, flex: 1, marginHorizontal: 4, alignItems: 'center' },
  correctButton: { backgroundColor: '#4CAF50' },
  spellingButtonText: { color: '#fff', fontWeight: 'bold' },
  loadingText: { fontSize: 18, color: '#fff', textAlign: 'center' },
});

export default LearningScreen;