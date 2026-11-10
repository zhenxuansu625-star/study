import React from 'react';
import { Text, View } from 'react-native';
import { fmtDayTime, fmtDays, fmtDuration, fmtRange, fmtTime } from '../lib/format';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { Badge, Button, Row } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { useTheme } from '../ui/theme';

/** Tapped a scheduled task session on the calendar. */
export function ChunkSheet() {
  const t = useTheme();
  const sheet = useUI((s) => s.sheet);
  const { close, open } = useUI.getState();
  const visible = sheet?.kind === 'chunk';
  const taskId = sheet?.kind === 'chunk' ? sheet.taskId : '';
  const start = sheet?.kind === 'chunk' ? sheet.start : '';
  const task = useStore((s) => s.tasks.find((x) => x.id === taskId));
  const chunk = useStore((s) => s.chunks.find((c) => c.taskId === taskId && c.start === start));
  const allChunks = useStore((s) => s.chunks);
  const all = allChunks.filter((c) => c.taskId === taskId);
  const warning = useStore((s) => s.warnings.find((w) => w.taskId === taskId));
  const plan = useStore((s) => s.plans[taskId]);

  if (!visible) return null;
  if (!task || !chunk) {
    return (
      <Sheet visible title="Session moved" onClose={close}>
        <Text style={{ color: t.textMuted }}>This session was rescheduled. Check the calendar for its new time.</Text>
      </Sheet>
    );
  }
  const index = all.findIndex((c) => c.start === chunk.start) + 1;

  return (
    <Sheet visible title={task.title} onClose={close}>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{fmtRange(chunk.start, chunk.end)}</Text>
      <Text style={{ color: t.textMuted, marginTop: 4 }}>
        {all.length > 1 ? `Session ${index} of ${all.length} · ` : ''}
        {fmtDuration(task.durationMinutes)} total · due {fmtDayTime(task.deadline)}
      </Text>
      <Row style={{ marginTop: 10 }}>
        {chunk.locked && <Badge text="🔒 Locked" tone="accent" />}
        {plan?.split && <Badge text="Split by the app" tone="muted" />}
        {plan?.spareMinutes !== undefined && plan.spareMinutes >= 0 && !warning && (
          <Badge text={`${fmtDuration(plan.spareMinutes)} spare before deadline`} tone="ok" />
        )}
      </Row>
      {warning && <Text style={{ color: t.warn, marginTop: 10, fontWeight: '600' }}>⚠ {warning.message}</Text>}
      <Text style={{ color: t.textMuted, marginTop: 12, fontSize: 13 }}>
        {chunk.locked
          ? 'Locked sessions stay put, even when other plans change.'
          : 'The app may move this session if your plans change. Lock it to keep it here.'}
      </Text>

      <View style={{ gap: 10, marginTop: 16 }}>
        <Button
          title={chunk.locked ? 'Unlock' : '🔒 Lock this time'}
          onPress={() => {
            useStore.getState().toggleLock(chunk.taskId, chunk.start);
            close();
          }}
        />
        <Button
          title="Mark whole task done ✓"
          onPress={() => {
            useStore.getState().setTaskDone(task.id, true);
            close();
          }}
        />
        <Button title="Edit task" kind="ghost" onPress={() => open({ kind: 'task', taskId: task.id })} />
      </View>
    </Sheet>
  );
}

/** Tapped one occurrence of a routine on the calendar. */
export function OccurrenceSheet() {
  const t = useTheme();
  const sheet = useUI((s) => s.sheet);
  const { close, open, showToast } = useUI.getState();
  const visible = sheet?.kind === 'occurrence';
  const occ = sheet?.kind === 'occurrence' ? sheet : null;
  const routine = useStore((s) => s.routines.find((r) => r.id === occ?.routineId));

  if (!visible || !occ) return null;
  if (!routine) return null;

  return (
    <Sheet visible title={routine.label} onClose={close}>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{fmtRange(occ.start, occ.end)}</Text>
      <Text style={{ color: t.textMuted, marginTop: 4 }}>
        Routine · {fmtDays(routine.days)} · {fmtTime(occ.start)}–{fmtTime(occ.end)}
      </Text>
      <View style={{ gap: 10, marginTop: 16 }}>
        <Button
          title="Skip just this one"
          onPress={() => {
            const st = useStore.getState();
            st.dismissNotice();
            st.skipOccurrence(routine.id, occ.dateKey);
            showToast(useStore.getState().notice ?? 'Skipped. That time is free now.');
            st.dismissNotice();
            close();
          }}
        />
        <Button title="Edit routine (all days)" onPress={() => open({ kind: 'routine', routineId: routine.id })} />
      </View>
    </Sheet>
  );
}
