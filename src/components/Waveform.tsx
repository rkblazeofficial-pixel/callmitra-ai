import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { C } from '@/lib/theme';

export function Waveform({ active = true, bars = 21, height = 64, color = C.cyan }: { active?: boolean; bars?: number; height?: number; color?: string }) {
  const vals = useRef(Array.from({ length: bars }, () => new Animated.Value(0.2))).current;
  useEffect(() => {
    if (!active) { vals.forEach((v) => v.setValue(0.15)); return; }
    const loops = vals.map((v, i) => {
      const peak = 0.4 + 0.6 * Math.abs(Math.sin(i * 1.3));
      return Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: peak, duration: 380 + (i % 5) * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.15, duration: 380 + (i % 4) * 110, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]));
    });
    loops.forEach((l, i) => setTimeout(() => l.start(), i * 40));
    return () => loops.forEach((l) => l.stop());
  }, [active, vals]);
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={{ width: 5, height, borderRadius: 3, backgroundColor: i % 3 === 0 ? C.primary : color, transform: [{ scaleY: v }] }} />
      ))}
    </View>
  );
}
