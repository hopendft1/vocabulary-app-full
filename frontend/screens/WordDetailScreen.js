import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const WordDetailScreen = ({ route, navigation }) => {
  const { word } = route.params;
  const [sound, setSound] = useState();
  const [showMemoryTip, setShowMemoryTip] = useState(false);
  const [memoryTip, setMemoryTip] = useState('');

  useEffect(() => {
    // Generate a simple memory tip based on the word
    generateMemoryTip(word.word, word.definition);
    
    // Clean up sound on unmount
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const generateMemoryTip = (word, definition) => {
    // 简单的记忆提示生成逻辑
    const tips = [
      `将"${word}"与"${definition.split(' ')[0]}"联想，创建一个生动的画面。`,
      `想象自己在使用"${word}"的场景，加深记忆印象。`,
      `将"${word}"拆分成更小的部分，逐个记忆。`,
      `找出"${word}"与你已知词汇的相似之处。`,
      `创建一个包含"${word}"的简短故事或场景。`
    ];
    
    // 随机选择一个提示
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    setMemoryTip(randomTip);
  };

  const playSound = async () => {
    // 如果有音频链接，播放音频
    if (word.audio_link) {
      try {
        if (sound) {
          await sound.unloadAsync();
        }
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: word.audio_link },
          { shouldPlay: true }
        );
        
        setSound(newSound);
      } catch (error) {
        console.error('Error playing sound:', error);
      }
    }
  };

  const toggleMemoryTip = () => {
    setShowMemoryTip(!showMemoryTip);
  };

  return (
    <LinearGradient
      colors={['#4B79A1', '#283E51']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.wordText}>{word.word}</Text>
          
          <View style={styles.pinyinContainer}>
            <Text style={styles.pinyinText}>{word.pinyin}</Text>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>释义</Text>
            <Text style={styles.definitionText}>{word.definition}</Text>
          </View>
          
          {word.example && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>例句</Text>
              <Text style={styles.exampleText}>{word.example}</Text>
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            {word.audio_link && (
              <TouchableOpacity style={styles.button} onPress={playSound}>
                <Ionicons name="volume-high" size={24} color="#fff" />
                <Text style={styles.buttonText}>播放发音</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.button} onPress={toggleMemoryTip}>
              <Ionicons name="bulb" size={24} color="#fff" />
              <Text style={styles.buttonText}>记忆提示</Text>
            </TouchableOpacity>
          </View>
          
          {showMemoryTip && (
            <View style={styles.memoryTipContainer}>
              <Text style={styles.memoryTipTitle}>记忆提示</Text>
              <Text style={styles.memoryTipText}>{memoryTip}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginVertical: 10,
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  button: {
    backgroundColor: '#4B79A1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 140,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
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

export default WordDetailScreen;
