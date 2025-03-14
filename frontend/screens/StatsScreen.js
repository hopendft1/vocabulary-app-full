import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'https://vocabulary-app-full.onrender.com'; // For Android emulator

const StatsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWords: 0,
    learnedWords: 0,
    difficultWords: 0,
    averageAccuracy: 0,
    courses: []
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // 获取课程列表
      const coursesResponse = await fetch(`${API_URL}/courses`);
      if (!coursesResponse.ok) {
        throw new Error('获取课程数据失败');
      }
      const coursesData = await coursesResponse.json();
      
      // 获取所有单词
      const wordsResponse = await fetch(`${API_URL}/words`);
      if (!wordsResponse.ok) {
        throw new Error('获取单词数据失败');
      }
      const wordsData = await wordsResponse.json();
      
      // 获取难词
      const difficultResponse = await fetch(`${API_URL}/words/difficult`);
      if (!difficultResponse.ok) {
        throw new Error('获取难词数据失败');
      }
      const difficultData = await difficultResponse.json();
      
      // 计算统计数据
      const totalWords = wordsData.length;
      const difficultWords = difficultData.length;
      
      // 计算已学习的单词（至少复习过一次的单词）
      const learnedWords = wordsData.filter(word => 
        word.learning_data && word.learning_data.last_reviewed
      ).length;
      
      // 计算平均正确率
      let totalCorrect = 0;
      let totalAnswered = 0;
      
      wordsData.forEach(word => {
        if (word.learning_data) {
          const correct = word.learning_data.consecutive_correct;
          const errors = word.learning_data.error_count;
          if (correct > 0 || errors > 0) {
            totalCorrect += correct;
            totalAnswered += correct + errors;
          }
        }
      });
      
      const averageAccuracy = totalAnswered > 0 
        ? Math.round((totalCorrect / totalAnswered) * 100) 
        : 0;
      
      // 计算每个课程的统计数据
      const coursesWithStats = coursesData.map(course => {
        const courseWords = wordsData.filter(word => word.course_id === course.id);
        const courseWordCount = courseWords.length;
        
        const courseLearned = courseWords.filter(word => 
          word.learning_data && word.learning_data.last_reviewed
        ).length;
        
        const courseDifficult = courseWords.filter(word => 
          word.learning_data && word.learning_data.is_difficult
        ).length;
        
        let courseCorrect = 0;
        let courseAnswered = 0;
        
        courseWords.forEach(word => {
          if (word.learning_data) {
            const correct = word.learning_data.consecutive_correct;
            const errors = word.learning_data.error_count;
            if (correct > 0 || errors > 0) {
              courseCorrect += correct;
              courseAnswered += correct + errors;
            }
          }
        });
        
        const courseAccuracy = courseAnswered > 0 
          ? Math.round((courseCorrect / courseAnswered) * 100) 
          : 0;
        
        return {
          ...course,
          wordCount: courseWordCount,
          learned: courseLearned,
          difficult: courseDifficult,
          accuracy: courseAccuracy,
          progress: courseWordCount > 0 ? Math.round((courseLearned / courseWordCount) * 100) : 0
        };
      });
      
      setStats({
        totalWords,
        learnedWords,
        difficultWords,
        averageAccuracy,
        courses: coursesWithStats
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <LinearGradient
        colors={['#4B79A1', '#283E51']}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>加载统计数据...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#4B79A1', '#283E51']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>学习统计</Text>
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.statsOverview}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalWords}</Text>
            <Text style={styles.statLabel}>总单词数</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.learnedWords}</Text>
            <Text style={styles.statLabel}>已学习</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.difficultWords}</Text>
            <Text style={styles.statLabel}>难词数量</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.averageAccuracy}%</Text>
            <Text style={styles.statLabel}>平均正确率</Text>
          </View>
        </View>
        
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>学习进度</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${stats.totalWords > 0 ? (stats.learnedWords / stats.totalWords) * 100 : 0}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {stats.totalWords > 0 ? Math.round((stats.learnedWords / stats.totalWords) * 100) : 0}%
            </Text>
          </View>
        </View>
        
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>课程统计</Text>
          {stats.courses.map((course, index) => (
            <View key={index} style={styles.courseCard}>
              <Text style={styles.courseTitle}>{course.title}</Text>
              
              <View style={styles.courseStats}>
                <View style={styles.courseStat}>
                  <Ionicons name="book-outline" size={16} color="#4B79A1" />
                  <Text style={styles.courseStatText}>{course.wordCount} 个单词</Text>
                </View>
                
                <View style={styles.courseStat}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
                  <Text style={styles.courseStatText}>{course.learned} 已学习</Text>
                </View>
                
                <View style={styles.courseStat}>
                  <Ionicons name="alert-circle-outline" size={16} color="#FF5722" />
                  <Text style={styles.courseStatText}>{course.difficult} 难词</Text>
                </View>
              </View>
              
              <View style={styles.courseProgressContainer}>
                <View style={styles.courseProgressBar}>
                  <View 
                    style={[
                      styles.courseProgressFill, 
                      { width: `${course.progress}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.courseProgressText}>{course.progress}%</Text>
              </View>
              
              <View style={styles.courseAccuracyContainer}>
                <Text style={styles.courseAccuracyLabel}>正确率:</Text>
                <Text 
                  style={[
                    styles.courseAccuracyValue,
                    course.accuracy >= 80 ? styles.goodAccuracy :
                    course.accuracy >= 60 ? styles.mediumAccuracy :
                    styles.poorAccuracy
                  ]}
                >
                  {course.accuracy}%
                </Text>
              </View>
            </View>
          ))}
        </View>
        
        <View style={styles.tipContainer}>
          <Text style={styles.tipTitle}>
            <Ionicons name="bulb-outline" size={18} color="#FFC107" /> 学习提示
          </Text>
          <Text style={styles.tipText}>
            {stats.difficultWords > 10
              ? '你有较多的难词需要特别关注。建议使用难词模式进行针对性练习。'
              : stats.averageAccuracy < 60
                ? '你的平均正确率较低。尝试减慢学习速度，确保充分理解每个单词。'
                : stats.learnedWords === 0
                  ? '开始你的学习之旅吧！选择一个课程并开始学习新词。'
                  : '继续保持！定期复习可以显著提高记忆效果。'}
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    padding: 16,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  statsOverview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 10,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4B79A1',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  sectionContainer: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    width: 50,
    textAlign: 'right',
  },
  courseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  courseStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  courseStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courseStatText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  courseProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  courseProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  courseProgressFill: {
    height: '100%',
    backgroundColor: '#4B79A1',
  },
  courseProgressText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    width: 40,
    textAlign: 'right',
  },
  courseAccuracyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courseAccuracyLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  courseAccuracyValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  goodAccuracy: {
    color: '#4CAF50',
  },
  mediumAccuracy: {
    color: '#FFC107',
  },
  poorAccuracy: {
    color: '#FF5722',
  },
  tipContainer: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
});

export default StatsScreen;
