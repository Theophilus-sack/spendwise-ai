import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
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

  // strokeDashoffset is an SVG prop, not a transform/opacity style, so the
  // legacy Animated API could only drive it on the JS thread
  // (useNativeDriver: false). Reanimated's useAnimatedProps runs this on the
  // UI thread instead — same trick as BudgetBar's width fill.
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(score, { duration: 1200 });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference - (progress.value / 100) * circumference,
  }));

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Discipline score ${score.toFixed(0)} out of 100, grade ${grade}`}
    >
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
          animatedProps={animatedProps}
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
