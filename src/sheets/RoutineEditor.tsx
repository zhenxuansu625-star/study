import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { DAY_NAMES, fmtDuration } from '../lib/format';
import { parseHM } from '../scheduler';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { ClockField, ColorPicker } from '../ui/fields';
import { Button, Chip, Input, Label, Row } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { BLOCK_COLORS, useTheme } from '../ui/theme';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function RoutineEditor() {
  const t = useTheme();
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.close);
  const showToast = useUI((s) => s.showToast);
  const visible = sheet?.kind === 'routine';
  const routineId = sheet?.kind === 'routine' ? sheet.routineId : undefined;
  const preset = sheet?.kind === 'routine' ? sheet.preset : undefined;
  const existing = useStore((s) => s.routines.find((r) => r.id === routineId));

  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [color, setColor] = useState(BLOCK_COLORS[3]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    const src = existing ?? preset;
    setLabel(src?.label ?? '');
    setDays(src?.days ?? [1, 2, 3, 4, 5]);
    setStartTime(src?.startTime ?? '09:00');
    setEndTime(src?.endTime ?? '17:00');
    setColor(existing?.color ?? (preset?.label === 'Sleep' ? BLOCK_COLORS[0] : BLOCK_COLORS[3]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, routineId, preset]);

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

  const s = parseHM(startTime);
  const e = parseHM(endTime);
  let mins = e.hours * 60 + e.minutes - (s.hours * 60 + s.minutes);
  const overnight = mins <= 0;
  if (overnight) mins += 1440;

  const save = () => {
    if (!label.trim()) return setError('Give it a label, e.g. “Work” or “Sleep”.');
    if (days.length === 0) return setError('Pick at least one day.');
    const { addRoutine, updateRoutine, dismissNotice } = useStore.getState();
    dismissNotice();
    const data = { label: label.trim(), days: [...days].sort(), startTime, endTime, color };
    if (existing) updateRoutine(existing.id, data);
    else addRoutine({ ...data, activeFrom: format(new Date(), 'yyyy-MM-dd') });
    showToast(useStore.getState().notice ?? 'Routine saved');
    dismissNotice();
    close();
  };

  return (
    <Sheet
      visible={visible}
      title={existing ? 'Edit routine' : 'New routine'}
      onClose={close}
      footer={
        <>
          <Button title="Cancel" onPress={close} style={{ flex: 1 }} />
          <Button title="Save" kind="primary" onPress={save} style={{ flex: 2 }} />
        </>
      }
    >
      <Label>Label</Label>
      <Input value={label} onChangeText={setLabel} placeholder="e.g. Work, Sleep, School" accessibilityLabel="Label" />

      <Label>Days</Label>
      <Row>
        <Chip label="Weekdays" selected={same(days, [1, 2, 3, 4, 5])} onPress={() => setDays([1, 2, 3, 4, 5])} />
        <Chip label="Weekends" selected={same(days, [0, 6])} onPress={() => setDays([0, 6])} />
        <Chip label="Every day" selected={days.length === 7} onPress={() => setDays([0, 1, 2, 3, 4, 5, 6])} />
      </Row>
      <Row style={{ marginTop: 8 }}>
        {WEEK_ORDER.map((d) => (
          <Chip key={d} label={DAY_NAMES[d]} selected={days.includes(d)} onPress={() => toggleDay(d)} />
        ))}
      </Row>

      <Label>From</Label>
      <ClockField value={startTime} onChange={setStartTime} />
      <Label>Until</Label>
      <ClockField value={endTime} onChange={setEndTime} />
      <Text style={{ color: t.textMuted, marginTop: 6 }}>
        {fmtDuration(mins)}
        {overnight ? ' · ends the next morning' : ''}
      </Text>

      <Label>Colour</Label>
      <ColorPicker value={color} onChange={setColor} />

      {existing && (
        <View style={{ marginTop: 18, gap: 10 }}>
          {existing.skipDates.length > 0 && (
            <Button
              title={`Restore ${existing.skipDates.length} skipped day${existing.skipDates.length === 1 ? '' : 's'}`}
              onPress={() => useStore.getState().updateRoutine(existing.id, { skipDates: [] })}
            />
          )}
          <Button
            title="Delete routine"
            kind="danger"
            onPress={() => {
              useStore.getState().deleteRoutine(existing.id);
              close();
            }}
          />
        </View>
      )}

      {error && <Text style={{ color: t.danger, marginTop: 12, fontWeight: '600' }}>{error}</Text>}
    </Sheet>
  );
}
