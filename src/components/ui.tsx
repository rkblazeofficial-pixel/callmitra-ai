import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp,
  StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, GRADIENT, R } from '@/lib/theme';

export function Screen({ children, scroll = true, pad = true, bottomInset = true, style }: {
  children: React.ReactNode; scroll?: boolean; pad?: boolean; bottomInset?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const i = useSafeAreaInsets();
  const inner = [{ paddingTop: i.top + 8, paddingBottom: bottomInset ? i.bottom + 24 : 8 }, pad && { paddingHorizontal: 20 }, style];
  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView style={s.fill} contentContainerStyle={inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[s.fill, ...inner]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

export const H1 = ({ children, style }: { children: React.ReactNode; style?: any }) => <Text style={[s.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }: { children: React.ReactNode; style?: any }) => <Text style={[s.h2, style]}>{children}</Text>;
export const Muted = ({ children, style }: { children: React.ReactNode; style?: any }) => <Text style={[s.muted, style]}>{children}</Text>;
export const Label = ({ children }: { children: React.ReactNode }) => <Text style={s.label}>{children}</Text>;

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const Comp: any = onPress ? Pressable : View;
  return <Comp onPress={onPress} style={[s.card, style]}>{children}</Comp>;
}

export function Btn({ title, onPress, variant = 'primary', icon, disabled, loading, style }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'ghost' | 'danger'; icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  const content = (
    <View style={s.btnIn}>
      {loading ? <ActivityIndicator color="#fff" /> : icon ? <Ionicons name={icon} size={20} color="#fff" /> : null}
      <Text style={s.btnTxt}>{title}</Text>
    </View>
  );
  return (
    <Pressable onPress={off ? undefined : onPress} style={({ pressed }) => [{ opacity: off ? 0.45 : pressed ? 0.85 : 1 }, style]}
      accessibilityRole="button" accessibilityState={{ disabled: !!off }}>
      {variant === 'primary' ? (
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>{content}</LinearGradient>
      ) : (
        <View style={[s.btn, variant === 'ghost' ? s.ghost : s.dangerBtn]}>{content}</View>
      )}
    </Pressable>
  );
}

export function Field({ label, error, style, ...p }: TextInputProps & { label?: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput placeholderTextColor="#6A72B0" {...p}
        style={[s.input, p.multiline && { minHeight: 110, textAlignVertical: 'top' }, error ? { borderColor: C.danger } : null, style]} />
      {error ? <Text style={s.err}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      {icon ? <Ionicons name={icon} size={16} color={active ? '#fff' : C.cyan} /> : null}
      <Text style={[s.chipTxt, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function DemoBanner({ text }: { text?: string }) {
  return (
    <View style={s.demo}>
      <Ionicons name="flask-outline" size={18} color={C.warn} />
      <Text style={s.demoTxt}>{text ?? 'DEMO MODE: no real calls are placed. Live calling is switched off until the cloud backend and phone provider are connected.'}</Text>
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 28 }}>
      <Ionicons name={icon} size={44} color={C.border} />
      <Text style={[s.h2, { marginTop: 10 }]}>{title}</Text>
      <Text style={[s.muted, { textAlign: 'center', marginTop: 4 }]}>{body}</Text>
    </View>
  );
}

export function Back({ onPress, title }: { onPress: () => void; title?: string }) {
  return (
    <Pressable onPress={onPress} style={s.back} accessibilityLabel="Go back" accessibilityRole="button">
      <Ionicons name="chevron-back" size={24} color="#fff" />
      {title ? <Text style={s.h2}>{title}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  h1: { color: C.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  h2: { color: C.text, fontSize: 18, fontWeight: '700' },
  muted: { color: C.muted, fontSize: 15, lineHeight: 22 },
  label: { color: C.muted, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  btn: { minHeight: 54, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnIn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ghost: { borderWidth: 1.5, borderColor: C.border, backgroundColor: 'transparent' },
  dangerBtn: { backgroundColor: C.danger },
  input: { backgroundColor: C.bg2, color: C.text, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  err: { color: C.danger, fontSize: 13, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipTxt: { color: C.muted, fontSize: 15, fontWeight: '600' },
  demo: { flexDirection: 'row', gap: 10, backgroundColor: '#2A2410', borderColor: '#5C4A12', borderWidth: 1, borderRadius: R.md, padding: 12, marginBottom: 14, alignItems: 'flex-start' },
  demoTxt: { color: C.warn, fontSize: 13, lineHeight: 19, flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, marginLeft: -6 },
});
