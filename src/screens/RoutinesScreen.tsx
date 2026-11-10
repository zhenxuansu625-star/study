import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fmtDays, fmtDuration } from '../lib/format';
import { parseHM } from '../scheduler';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { Button, Card, Row } from '../ui/primitives';
import { useTheme } from '../ui/theme';

const SUGGESTIONS = [
  { label: 'Sleep', days: [0, 1, 2, 3, 4, 5, 6], startTime: '23:00', endTime: '07:00' },
  { label: 'Work', days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' },
  { label: 'School', days: [1, 2, 3, 4, 5], startTime: '08:30', endTime: '15:30' },
  { label: 'Meals', days: [0, 1, 2, 3, 4, 5, 6], startTime: '18:30', endTime: '19:15' },
];

function length(start: string, end: string) {
  const s = parseHM(start);
  const e = parseHM(end);
  let m = e.hours * 60 + e.minutes - (s.hours * 60 + s.minutes);
  if (m <= 0) m += 1440;
  return m;
}

export function RoutinesScreen() {
  const t = useTheme();
  const routines = useStore((s) => s.routines);
  const open = useUI((s) => s.open);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.h1, { color: t.text }]}>Routines</Text>
      <Text style={{ color: t.textMuted, marginBottom: 14, lineHeight: 20 }}>
        Times you’re busy every week, like work or sleep. Tasks are never scheduled during these.
      </Text>

      {routines.map((r) => (
        <Card key={r.id} onPress={() => open({ kind: 'routine', routineId: r.id })} style={{ marginBottom: 10 }}>
          <Row style={{ flexWrap: 'nowrap' }}>
            <View style={[styles.dot, { backgroundColor: r.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{r.label}</Text>
              <Text style={{ color: t.textMuted, marginTop: 2 }}>
                {fmtDays(r.days)} · {r.startTime}–{r.endTime} ({fmtDuration(length(r.startTime, r.endTime))})
                {r.skipDates.length ? ` · ${r.skipDates.length} skipped` : ''}
              </Text>
            </View>
            <Text style={{ color: t.textMuted, fontSize: 18 }}>›</Text>
          </Row>
        </Card>
      ))}

      <Button title="＋ New routine" kind="primary" onPress={() => open({ kind: 'routine' })} style={{ marginTop: 4 }} />

      <Text style={[styles.h2, { color: t.text }]}>Quick start</Text>
      <Text style={{ color: t.textMuted, marginBottom: 10 }}>Tap one to open it pre-filled. You can change anything before saving.</Text>
      <Row>
        {SUGGESTIONS.map((s) => (
          <Button
            key={s.label}
            small
            title={`${s.label} · ${fmtDays(s.days)} ${s.startTime}–${s.endTime}`}
            onPress={() => open({ kind: 'routine', preset: s })}
          />
        ))}
      </Row>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110, width: '100%', maxWidth: 720, alignSelf: 'center' },
  h1: { fontSize: 26, fontWeight: '800', marginBottom: 6 },
  h2: { fontSize: 18, fontWeight: '700', marginTop: 26, marginBottom: 4 },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
