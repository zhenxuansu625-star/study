import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from './theme';

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  kind = 'secondary',
  disabled,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? 'transparent' : kind === 'ghost' ? 'transparent' : t.surfaceAlt;
  const fg = kind === 'primary' ? t.onAccent : kind === 'danger' ? t.danger : kind === 'ghost' ? t.accent : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        kind === 'danger' && { borderWidth: 1, borderColor: t.danger },
        style,
      ]}
    >
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.accent : t.surfaceAlt,
          borderColor: selected ? t.accent : t.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={{ color: selected ? t.onAccent : t.text, fontSize: 14, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.surfaceAlt }]}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, sel && { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1 }]}
          >
            <Text style={{ color: sel ? t.text : t.textMuted, fontWeight: sel ? '600' : '500', fontSize: 14 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.label, { color: t.textMuted }]}>{children}</Text>;
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.textMuted}
      {...props}
      style={[styles.input, { color: t.text, backgroundColor: t.surfaceAlt, borderColor: t.border }, props.style]}
    />
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function StepButton({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.step,
        { backgroundColor: t.surfaceAlt, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const t = useTheme();
  const base = [styles.card, { backgroundColor: t.surface, borderColor: t.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Badge({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'muted' | 'accent' }) {
  const t = useTheme();
  const map = {
    ok: { bg: t.successSoft, fg: t.success },
    warn: { bg: t.warnSoft, fg: t.warn },
    muted: { bg: t.surfaceAlt, fg: t.textMuted },
    accent: { bg: t.accentSoft, fg: t.accent },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={{ color: map.fg, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  step: { minWidth: 44, height: 40, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
});
