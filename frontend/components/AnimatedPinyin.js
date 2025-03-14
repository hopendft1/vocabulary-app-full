import React, { useRef, useEffect } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';

const AnimatedPinyin = ({ pinyin, visible = true, style = {} }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      // 淡入弹跳动画
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      // 重置动画值
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible, pinyin]);

  if (!pinyin) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        },
        style
      ]}
    >
      <Text style={styles.pinyinText}>{pinyin}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginVertical: 10,
  },
  pinyinText: {
    fontSize: 20,
    color: '#4A90E2',
    textAlign: 'center',
  },
});

export default AnimatedPinyin;
