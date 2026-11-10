import { addDays, set as setTime } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { fmtDuration, fmtRange } from '../lib/format';
import { parseDuration } from '../lib/parseDuration';
import type { SplitOverride } from '../scheduler';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { DateTimeField } from '../ui/fields';
import { Button, Chip, Input, Label, Row, Segmented } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { useTheme } from '../ui/theme';

type SplitChoice = 'auto' | SplitOverride;

const defaultDeadline = () => setTime(addDays(new Date(), 1), { hours: 17, minutes: 0, seconds: 0, milliseconds: 0 });

/** Summary of where a task landed, for the toast after saving. */
export function describePlacement(taskId: string): string {
  const s = useStore.getState();
  const warning = s.warnings.find((w) => w.taskId === taskId);
  const chunks = s.chunks.filter((c) => c.taskId === taskId);
  const parts: string[] = [];
  if (chunks.length) {
    const shown = chunks.slice(0, 2).map((c) => fmtRange(c.start, c.end));
    parts.push(`Scheduled: ${shown.join(', ')}${chunks.length > 2 ? ` +${chunks.length - 2} more` : ''}`);
  }
  if (warning) parts.push(`⚠ ${warning.message}`);
  if (s.notice) parts.push(s.notice);
  return parts.join(' · ') || 'Saved';
}

export function TaskEditor() {
  const t = useTheme();
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.close);
  const showToast = useUI((s) => s.showToast);
  const visible = sheet?.kind === 'task';
  const taskId = sheet?.kind === 'task' ? sheet.taskId : undefined;
  const existing = useStore((s) => s.tasks.find((x) => x.id === taskId));
  const { addTask, updateTask, deleteTask, setTaskDone, dismissNotice } = useStore.getState();

  const [title, setTitle] = useState('');
  const [durationText, setDurationText] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [split, setSplit] = useState<SplitChoice>('auto');
  const [useEarliest, setUseEarliest] = useState(false);
  const [earliest, setEarliest] = useState(() => new Date());
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (existing) {
      setTitle(existing.title);
      setDurationText(fmtDuration(existing.durationMinutes));
      setDeadline(new Date(existing.deadline));
      setPriority(existing.priority);
      setSplit(existing.splitOverride ?? 'auto');
      setUseEarliest(!!existing.earliestStart);
      setEarliest(existing.earliestStart ? new Date(existing.earliestStart) : new Date());
      setMore(!!existing.earliestStart || !!existing.splitOverride || existing.priority === 'high');
    } else {
      setTitle('');
      setDurationText('');
      setDeadline(defaultDeadline());
      setPriority('normal');
      setSplit('auto');
      setUseEarliest(false);
      setEarliest(new Date());
      setMore(false);
    }
    // Only reset when the sheet opens or switches task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, taskId]);

  const minutes = parseDuration(durationText);

  const save = () => {
    if (!title.trim()) return setError('Give the task a name.');
    if (!minutes) return setError('Enter how long it takes, e.g. 90m, 1.5h or 2h 30m.');
    if (useEarliest && earliest >= deadline) return setError('"Not before" must be before the deadline.');
    const data = {
      title: title.trim(),
      durationMinutes: minutes,
      deadline: deadline.toISOString(),
      priority,
      splitOverride: split === 'auto' ? undefined : split,
      earliestStart: useEarliest ? earliest.toISOString() : undefined,
    };
    dismissNotice();
    let id: string;
    if (existing) {
      updateTask(existing.id, data);
      id = existing.id;
    } else {
      id = addTask(data);
    }
    showToast(describePlacement(id));
    dismissNotice();
    close();
  };

  return (
    <Sheet
      visible={visible}
      title={existing ? 'Edit task' : 'New task'}
      onClose={close}
      footer={
        <>
          <Button title="Cancel" onPress={close} style={{ flex: 1 }} />
          <Button title={existing ? 'Save' : 'Add & schedule'} kind="primary" onPress={save} style={{ flex: 2 }} />
        </>
      }
    >
      <Label>Task</Label>
      <Input
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Write history essay"
        autoFocus={!existing}
        returnKeyType="next"
        accessibilityLabel="Task name"
      />

      <Label>How long</Label>
      <Input
        value={durationText}
        onChangeText={setDurationText}
        placeholder="e.g. 90m, 1.5h, 2h 30m"
        accessibilityLabel="Duration"
        autoCapitalize="none"
      />
      <Row style={{ marginTop: 8 }}>
        {['30m', '45m', '1h', '1.5h', '2h', '3h'].map((d) => (
          <Chip key={d} label={d} selected={durationText === d} onPress={() => setDurationText(d)} />
        ))}
      </Row>
      {durationText.length > 0 && (
        <Text style={{ color: minutes ? t.textMuted : t.warn, marginTop: 6 }}>
          {minutes ? `= ${fmtDuration(minutes)}` : 'Try 90m, 1.5h or 2h 30m'}
        </Text>
      )}

      <Label>Due by</Label>
      <DateTimeField value={deadline} onChange={setDeadline} />

      <View style={{ marginTop: 14 }}>
        <Button title={more ? 'Fewer options ▲' : 'More options ▼'} kind="ghost" small onPress={() => setMore(!more)} />
      </View>

      {more && (
        <View>
          <Label>Priority</Label>
          <Segmented
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
            ]}
            value={priority}
            onChange={setPriority}
          />

          <Label>Splitting</Label>
          <Segmented
            options={[
              { value: 'auto', label: 'Let app decide' },
              { value: 'one-sitting', label: 'One sitting' },
              { value: 'allow-split', label: 'Allow split' },
            ]}
            value={split}
            onChange={setSplit}
          />

          <Label>Don’t start before</Label>
          <Segmented
            options={[
              { value: 'no', label: 'Any time' },
              { value: 'yes', label: 'Set a time' },
            ]}
            value={useEarliest ? 'yes' : 'no'}
            onChange={(v) => setUseEarliest(v === 'yes')}
          />
          {useEarliest && (
            <View style={{ marginTop: 10 }}>
              <DateTimeField value={earliest} onChange={setEarliest} />
            </View>
          )}
        </View>
      )}

      {existing && (
        <View style={{ marginTop: 18, gap: 10 }}>
          {existing.minutesDone > 0 && (
            <Text style={{ color: t.textMuted }}>
              Progress: {fmtDuration(existing.minutesDone)} of {fmtDuration(existing.durationMinutes)} done
            </Text>
          )}
          <Row>
            <Button
              title={existing.done ? 'Mark not done' : 'Mark done ✓'}
              onPress={() => {
                setTaskDone(existing.id, !existing.done);
                close();
              }}
              style={{ flex: 1 }}
            />
            <Button
              title="Delete"
              kind="danger"
              onPress={() => {
                deleteTask(existing.id);
                close();
              }}
              style={{ flex: 1 }}
            />
          </Row>
        </View>
      )}

      {error && <Text style={{ color: t.danger, marginTop: 12, fontWeight: '600' }}>{error}</Text>}
    </Sheet>
  );
}
