import { addDays, addMinutes, format, setHours, setMinutes, startOfDay } from 'date-fns';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fmtDay } from '../lib/format';
import { Chip, Row, StepButton } from './primitives';
import { BLOCK_COLORS, useTheme } from './theme';

/** Date + time picker made of steppers, so it works the same on every platform. */
export function DateTimeField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const t = useTheme();
  const today = startOfDay(new Date());
  const setDay = (day: Date) => {
    const d = new Date(day);
    d.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(d);
  };
  return (
    <View style={{ gap: 8 }}>
      <Row>
        <StepButton label="◀" accessibilityLabel="Previous day" onPress={() => onChange(addDays(value, -1))} />
        <Text style={[styles.value, { color: t.text }]}>
          {fmtDay(value)}
          {fmtDay(value) !== format(value, 'EEE d MMM') ? ` · ${format(value, 'EEE d MMM')}` : ''}
        </Text>
        <StepButton label="▶" accessibilityLabel="Next day" onPress={() => onChange(addDays(value, 1))} />
      </Row>
      <Row>
        <Chip label="Today" onPress={() => setDay(today)} />
        <Chip label="Tomorrow" onPress={() => setDay(addDays(today, 1))} />
        <Chip label="+1 week" onPress={() => onChange(addDays(value, 7))} />
      </Row>
      <TimeStepper value={value} onChange={onChange} />
    </View>
  );
}

/** Time stepper over a Date (changes can roll into the next/previous day). */
export function TimeStepper({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Row>
        <StepButton label="−1h" onPress={() => onChange(addMinutes(value, -60))} />
        <StepButton label="−15" accessibilityLabel="Minus 15 minutes" onPress={() => onChange(addMinutes(value, -15))} />
        <Text style={[styles.time, { color: t.text }]}>{format(value, 'HH:mm')}</Text>
        <StepButton label="+15" accessibilityLabel="Plus 15 minutes" onPress={() => onChange(addMinutes(value, 15))} />
        <StepButton label="+1h" onPress={() => onChange(addMinutes(value, 60))} />
      </Row>
      <Row>
        {[9, 12, 17, 21].map((h) => (
          <Chip key={h} label={`${h}:00`} onPress={() => onChange(setMinutes(setHours(value, h), 0))} />
        ))}
      </Row>
    </View>
  );
}

/** Stepper for a "HH:mm" wall-clock time (wraps around midnight). */
export function ClockField({ value, onChange }: { value: string; onChange: (hm: string) => void }) {
  const t = useTheme();
  const [h, m] = value.split(':').map(Number);
  const shift = (delta: number) => {
    const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
    onChange(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
  };
  return (
    <Row>
      <StepButton label="−1h" onPress={() => shift(-60)} />
      <StepButton label="−15" accessibilityLabel="Minus 15 minutes" onPress={() => shift(-15)} />
      <Text style={[styles.time, { color: t.text }]}>{value}</Text>
      <StepButton label="+15" accessibilityLabel="Plus 15 minutes" onPress={() => shift(15)} />
      <StepButton label="+1h" onPress={() => shift(60)} />
    </Row>
  );
}

export function NumberStepper({
  value,
  onChange,
  step,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  step: number;
  min: number;
  max: number;
  suffix: string;
}) {
  const t = useTheme();
  return (
    <Row>
      <StepButton label="−" accessibilityLabel="Decrease" onPress={() => onChange(Math.max(min, value - step))} />
      <Text style={[styles.time, { color: t.text }]}>
        {value} {suffix}
      </Text>
      <StepButton label="+" accessibilityLabel="Increase" onPress={() => onChange(Math.min(max, value + step))} />
    </Row>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const t = useTheme();
  return (
    <Row>
      {BLOCK_COLORS.map((c) => (
        <Pressable
          key={c}
          accessibilityRole="button"
          accessibilityLabel={`Colour ${c}`}
          accessibilityState={{ selected: c === value }}
          onPress={() => onChange(c)}
          style={[
            styles.swatch,
            { backgroundColor: c, borderColor: c === value ? t.text : 'transparent' },
          ]}
        />
      ))}
    </Row>
  );
}

const styles = StyleSheet.create({
  value: { fontSize: 16, fontWeight: '600', minWidth: 150, textAlign: 'center', flexShrink: 1 },
  time: { fontSize: 20, fontWeight: '700', minWidth: 74, textAlign: 'center', fontVariant: ['tabular-nums'] },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
});
