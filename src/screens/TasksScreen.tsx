import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fmtDayTime, fmtDuration, fmtRange, fmtSpan } from '../lib/format';
import type { Task } from '../scheduler';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { Badge, Button, Card, Row } from '../ui/primitives';
import { useTheme } from '../ui/theme';

export function TasksScreen() {
  const t = useTheme();
  const tasks = useStore((s) => s.tasks);
  const [showDone, setShowDone] = useState(false);
  const open = useUI((s) => s.open);

  const byDeadline = (a: Task, b: Task) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  const todo = tasks.filter((x) => !x.done).sort(byDeadline);
  const done = tasks.filter((x) => x.done).sort(byDeadline);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.h1, { color: t.text }]}>Tasks</Text>
      {todo.length === 0 && (
        <Card>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Nothing to do yet</Text>
          <Text style={{ color: t.textMuted, marginTop: 4, lineHeight: 20 }}>
            Tap ＋ to add a task with how long it takes and when it’s due. It will be slotted into your free time
            automatically.
          </Text>
          <Button title="Add a task" kind="primary" onPress={() => open({ kind: 'task' })} style={{ marginTop: 12 }} />
        </Card>
      )}
      {todo.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}

      {done.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Button
            title={`${showDone ? 'Hide' : 'Show'} ${done.length} done`}
            kind="ghost"
            small
            onPress={() => setShowDone(!showDone)}
          />
          {showDone && done.map((task) => <TaskCard key={task.id} task={task} />)}
        </View>
      )}
    </ScrollView>
  );
}

function TaskCard({ task }: { task: Task }) {
  const t = useTheme();
  const open = useUI((s) => s.open);
  const allChunks = useStore((s) => s.chunks);
  const checkins = useStore((s) => s.checkins);
  const chunks = allChunks.filter((c) => c.taskId === task.id);
  const pending = checkins.filter((c) => c.taskId === task.id).length;
  const warning = useStore((s) => s.warnings.find((w) => w.taskId === task.id));
  const plan = useStore((s) => s.plans[task.id]);

  let status: React.ReactNode;
  if (task.done) status = <Badge text="✔ Done" tone="muted" />;
  else if (warning?.kind === 'overdue') status = <Badge text="⚠ Overdue" tone="warn" />;
  else if (warning) status = <Badge text="⚠ Can’t fit" tone="warn" />;
  else if (chunks.length) status = <Badge text="✅ Scheduled" tone="ok" />;
  else status = <Badge text="Not scheduled" tone="muted" />;

  return (
    <Card onPress={() => open({ kind: 'task', taskId: task.id })} style={{ marginBottom: 10, opacity: task.done ? 0.7 : 1 }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <Text
          style={{
            color: t.text,
            fontSize: 16,
            fontWeight: '600',
            flex: 1,
            textDecorationLine: task.done ? 'line-through' : 'none',
          }}
          numberOfLines={2}
        >
          {task.priority === 'high' ? '‼ ' : ''}
          {task.title}
        </Text>
        {status}
      </Row>
      <Text style={{ color: t.textMuted, marginTop: 4 }}>
        {fmtDuration(task.durationMinutes)} · due {fmtDayTime(task.deadline)}
        {task.minutesDone > 0 && !task.done ? ` · ${fmtDuration(task.minutesDone)} done` : ''}
      </Text>

      {!task.done && chunks.length > 0 && (
        <View style={{ marginTop: 8, gap: 2 }}>
          {chunks.map((c) => (
            <Text key={c.start} style={{ color: t.text, fontSize: 14 }}>
              {c.locked ? '🔒 ' : '• '}
              {fmtRange(c.start, c.end)}
            </Text>
          ))}
        </View>
      )}
      {!task.done && warning && <Text style={{ color: t.warn, marginTop: 8, fontWeight: '600' }}>{warning.message}</Text>}
      {!task.done && pending > 0 && (
        <Text style={{ color: t.warn, marginTop: 6 }}>
          {pending} past session{pending === 1 ? '' : 's'} to check in
        </Text>
      )}
      {!task.done && !warning && plan?.spareMinutes !== undefined && (
        <Text style={{ color: t.success, marginTop: 6, fontSize: 13, fontWeight: '600' }}>
          Finishes with {fmtSpan(plan.spareMinutes)} to spare
          {plan.split ? ' · split by the app' : ''}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110, width: '100%', maxWidth: 720, alignSelf: 'center' },
  h1: { fontSize: 26, fontWeight: '800', marginBottom: 12 },
});
