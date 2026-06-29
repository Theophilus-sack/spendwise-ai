import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Typography } from '@/theme';
import { fdsGradeColor } from '@spendwise/shared';
import type { FDSResult } from '@spendwise/shared';

interface ScoreRingProps {
  score: number;
  grade: FDSResult['grade'];
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function ScoreRing({
  score, grade, size = 80, strokeWidth = 8, showLabel = true,
}: ScoreRingProps) {
  const radius      = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color       = fdsGradeColor(grade);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: score,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={Colors.border} strokeWidth={strokeWidth}
        />
        {/* Animated progress */}
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90" origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.label}>
        <Text style={[styles.score, { color }]}>{score.toFixed(0)}</Text>
        {showLabel && <Text style={[styles.grade, { color }]}>{grade}</Text>}
      </View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  label:     { position: 'absolute', alignItems: 'center' },
  score:     { fontSize: Typography.lg, fontWeight: Typography.bold },
  grade:     { fontSize: Typography.xs, fontWeight: Typography.semibold },
});
