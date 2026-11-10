import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtDuration, fmtRange } from '../lib/format';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { Button } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { useTheme } from '../ui/theme';

/** "Did you do it?" for sessions whose time has passed. */
export function CheckinPrompt({ hydrated }: { hydrated: boolean }) {
  const t = useTheme();
  const sheetOpen = useUI((s) => s.sheet !== null);
  const checkins = useStore((s) => s.checkins);
  const tasks = useStore((s) => s.tasks);
  const onboarded = useStore((s) => s.onboarded);
  const [snoozed, setSnoozed] = useState(false);
  const chunk = checkins[0];
  const task = chunk && tasks.find((x) => x.id === chunk.taskId);
  const visible = hydrated && onboarded && !sheetOpen && !snoozed && !!task;

  useEffect(() => {
    // Ask again when a new session finishes.
    setSnoozed(false);
  }, [checkins.length]);

  if (!chunk || !task) return null;
  const mins = Math.round((new Date(chunk.end).getTime() - new Date(chunk.start).getTime()) / 60000);
  const answer = (f: number) => useStore.getState().answerCheckin(chunk, f);

  return (
    <Sheet visible={visible} title="Did you do it?" onClose={() => setSnoozed(true)}>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>{task.title}</Text>
      <Text style={{ color: t.textMuted, marginTop: 4 }}>
        {fmtRange(chunk.start, chunk.end)} · {fmtDuration(mins)}
        {checkins.length > 1 ? ` · ${checkins.length - 1} more to check` : ''}
      </Text>
      <View style={{ gap: 10, marginTop: 16 }}>
        <Button title="Yes, did it all" kind="primary" onPress={() => answer(1)} />
        <Button title="Partly (about half)" onPress={() => answer(0.5)} />
        <Button title="No, reschedule it" onPress={() => answer(0)} />
        <Button
          title="Finished the whole task ✓"
          kind="ghost"
          onPress={() => useStore.getState().setTaskDone(task.id, true)}
        />
      </View>
    </Sheet>
  );
}

/** First-launch welcome. Nothing is pre-filled unless you choose the demo. */
export function Onboarding({ hydrated }: { hydrated: boolean }) {
  const t = useTheme();
  const onboarded = useStore((s) => s.onboarded);
  const { setOnboarded, loadDemo } = useStore.getState();
  const { setTab } = useUI.getState();
  const visible = hydrated && !onboarded;
  return (
    <Sheet visible={visible} title="Welcome 👋" onClose={setOnboarded}>
      <Text style={{ color: t.text, fontSize: 16, lineHeight: 23 }}>
        Block out the times you’re busy, then add tasks with how long they take and when they’re due. The app fits each task
        into your free time as early as it reasonably can.
      </Text>
      <Text style={{ color: t.textMuted, fontSize: 15, lineHeight: 22, marginTop: 10 }}>
        Nothing is assumed: until you add routines like sleep or work, every hour counts as free.
      </Text>
      <View style={{ gap: 10, marginTop: 18 }}>
        <Button
          title="Set up my routines"
          kind="primary"
          onPress={() => {
            setOnboarded();
            setTab('routines');
          }}
        />
        <Button title="Try it with demo data" onPress={loadDemo} />
        <Button title="Start with an empty timetable" kind="ghost" onPress={setOnboarded} />
      </View>
    </Sheet>
  );
}

/** Brief message at the bottom of the screen. */
export function Toast() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useUI((s) => s.toast);
  const notice = useStore((s) => s.notice);
  const message = toast ?? notice;
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: false }).start();
    const id = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => {
        useUI.getState().showToast(null);
        useStore.getState().dismissNotice();
      });
    }, 4500);
    return () => clearTimeout(id);
  }, [message, opacity]);

  if (!message) return null;
  return (
    <Animated.View style={[styles.toastWrap, { bottom: 76 + insets.bottom, opacity }]} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          useUI.getState().showToast(null);
          useStore.getState().dismissNotice();
        }}
        style={[styles.toast, { backgroundColor: t.text }]}
        accessibilityRole="alert"
      >
        <Text style={{ color: t.bg, fontSize: 14, fontWeight: '500' }}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, maxWidth: 560 },
});
