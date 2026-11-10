import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { RoutinesScreen } from './src/screens/RoutinesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { BlockEditor } from './src/sheets/BlockEditor';
import { ChunkSheet, OccurrenceSheet } from './src/sheets/ItemSheets';
import { CheckinPrompt, Onboarding, Toast } from './src/sheets/Prompts';
import { RoutineEditor } from './src/sheets/RoutineEditor';
import { TaskEditor } from './src/sheets/TaskEditor';
import { useStore } from './src/state/store';
import { useUI, type Tab } from './src/state/ui';
import { useTheme } from './src/ui/theme';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'calendar', label: 'Calendar', icon: '▦' },
  { key: 'tasks', label: 'Tasks', icon: '☑' },
  { key: 'routines', label: 'Routines', icon: '↻' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
];

function useHydrated() {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}

function Shell() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const open = useUI((s) => s.open);
  const hydrated = useHydrated();
  const taskCount = useStore((s) => s.tasks.filter((x) => !x.done).length);
  const warnCount = useStore((s) => s.warnings.length);

  // Keep the plan current as time passes and when the app comes back to the foreground.
  useEffect(() => {
    const tick = () => useStore.getState().reschedule();
    const id = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && tick());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <StatusBar style="auto" />
      <View style={{ flex: 1 }}>
        {tab === 'calendar' && <CalendarScreen />}
        {tab === 'tasks' && <TasksScreen />}
        {tab === 'routines' && <RoutinesScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      {(tab === 'calendar' || tab === 'tasks') && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add task"
          onPress={() => open({ kind: 'task' })}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: t.accent, bottom: 72 + insets.bottom, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.fabText, { color: t.onAccent }]}>＋ Task</Text>
        </Pressable>
      )}

      <View style={[styles.tabBar, { backgroundColor: t.surface, borderColor: t.border, paddingBottom: insets.bottom }]}>
        {TABS.map((x) => {
          const sel = x.key === tab;
          const badge = x.key === 'tasks' ? (warnCount ? '⚠' : taskCount ? String(taskCount) : '') : '';
          return (
            <Pressable
              key={x.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={x.label}
              onPress={() => setTab(x.key)}
              style={styles.tab}
            >
              <Text style={{ fontSize: 20, color: sel ? t.accent : t.textMuted }}>{x.icon}</Text>
              <Text style={{ fontSize: 11, fontWeight: sel ? '700' : '500', color: sel ? t.accent : t.textMuted }}>
                {x.label}
                {badge ? ` · ${badge}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TaskEditor />
      <BlockEditor />
      <RoutineEditor />
      <ChunkSheet />
      <OccurrenceSheet />
      <CheckinPrompt hydrated={hydrated} />
      <Onboarding hydrated={hydrated} />
      <Toast />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 8, gap: 2 },
  fab: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 18,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fabText: { fontSize: 16, fontWeight: '700' },
});
