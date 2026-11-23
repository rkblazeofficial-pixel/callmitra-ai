import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Waveform } from '@/components/Waveform';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

const W = Dimensions.get('window').width;
const PHASE_MS = 5500;

export default function Intro() {
  const { finishIntro } = useStore();
  const [phase, setPhase] = useState<1 | 2>(1);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    finishIntro();
    router.replace('/welcome');
  };

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(2), PHASE_MS);
    const t2 = setTimeout(finish, PHASE_MS * 2);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      {phase === 1 ? <IntroApp /> : <IntroBrand />}
      <Pressable onPress={finish} style={styles.skip} accessibilityLabel="Skip intro" accessibilityRole="button">
        <Text style={styles.skipTxt}>Skip</Text>
      </Pressable>
    </View>
  );
}

function IntroApp() {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
    Animated.sequence([
      Animated.delay(1800),
      Animated.timing(tag, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.delay(1700),
      Animated.timing(out, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fade, scale, glow, tag, out]);
  return (
    <Animated.View style={[styles.center, { opacity: out }]}>
      <Animated.View style={[styles.halo, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.12] }) }] }]} />
      <Animated.Image source={require('../../assets/images/callmitra-icon.png')} resizeMode="contain"
        style={{ width: W * 0.62, height: W * 0.62, opacity: fade, transform: [{ scale }] }} />
      <View style={{ marginTop: 28 }}><Waveform active bars={25} height={48} /></View>
      <Animated.Text style={[styles.tag, { opacity: tag, transform: [{ translateY: tag.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
        Your Personal AI Calling Companion.
      </Animated.Text>
    </Animated.View>
  );
}

function IntroBrand() {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1.15)).current;
  const shine = useRef(new Animated.Value(-1)).current;
  const sub = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 2600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(1500),
      Animated.timing(shine, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(2300),
      Animated.timing(sub, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.delay(1300),
      Animated.timing(out, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fade, scale, shine, sub, out]);
  const size = W * 0.78;
  return (
    <Animated.View style={[styles.center, { opacity: out }]}>
      <Animated.View style={{ opacity: fade, transform: [{ scale }], overflow: 'hidden', borderRadius: 12 }}>
        <Image source={require('../../assets/images/rash-logo.png')} resizeMode="contain" style={{ width: size, height: size * 0.56 }} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateX: shine.interpolate({ inputRange: [-1, 1], outputRange: [-size, size] }) }] }]}>
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.35)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: size * 0.4, height: '100%' }} />
        </Animated.View>
      </Animated.View>
      <Animated.Text style={[styles.sub, { opacity: sub }]}>PRESENTED BY RASH PRODUCTION</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  halo: { position: 'absolute', width: W * 0.9, height: W * 0.9, borderRadius: W, backgroundColor: C.primary, opacity: 0.4 },
  tag: { color: C.cyan, fontSize: 17, fontWeight: '600', marginTop: 22, textAlign: 'center' },
  sub: { color: '#C9A93A', letterSpacing: 3, fontSize: 12, fontWeight: '700', marginTop: 26 },
  skip: { position: 'absolute', top: 54, right: 20, padding: 10 },
  skipTxt: { color: C.muted, fontSize: 15, fontWeight: '600' },
});
