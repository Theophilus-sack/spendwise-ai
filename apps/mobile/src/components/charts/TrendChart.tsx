import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { Colors } from '@/theme';

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendChartProps {
  points: TrendPoint[];
  width: number;
  height?: number;
  color?: string;
}

/** A simple filled line chart — no external charting library, just an SVG
 *  path scaled to the data's own range so it works for any series length. */
export function TrendChart({ points, width, height = 120, color = Colors.primary }: TrendChartProps) {
  if (points.length === 0) return <View style={{ width, height }} />;

  const values = points.map(p => p.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: points.length > 1 ? i * stepX : width / 2,
    y: height - ((p.value - min) / range) * height,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const zeroY = height - ((0 - min) / range) * height;

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke={Colors.border} strokeWidth={1} />
      <Path d={areaPath} fill={color} fillOpacity={0.14} />
      <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
