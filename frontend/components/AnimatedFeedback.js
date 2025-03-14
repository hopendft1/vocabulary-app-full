import React, { useRef, useEffect } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AnimatedFeedback = ({ isCorrect, visible = true, style = {} }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (isCorrect) {
        // 正确答案动画：淡入放大
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1.1,
            friction: 4,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            })
          ])
        ]).start();
      } else {
        // 错误答案动画：淡入抖动
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
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
      }
    } else {
      // 重置动画值
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      shakeAnim.setValue(0);
    }
  }, [visible, isCorrect]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        isCorrect ? styles.correctContainer : styles.incorrectContainer,
        {
          opacity: fadeAnim,
          transform: [
            { scale: isCorrect ? scaleAnim : 1 },
            { translateX: isCorrect ? 0 : shakeAnim }
          ]
        },
        style
      ]}
    >
      <Ionicons 
        name={isCorrect ? "checkmark-circle" : "close-circle"} 
        size={24} 
        color={isCorrect ? "#fff" : "#fff"} 
      />
      <Text style={styles.feedbackText}>
        {isCorrect ? "正确!" : "错误"}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
  },
  correctContainer: {
    backgroundColor: '#4CAF50',
  },
  incorrectContainer: {
    backgroundColor: '#FF5722',
  },
  feedbackText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  }
});

export default AnimatedFeedback;
