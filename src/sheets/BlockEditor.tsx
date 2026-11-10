import { addMinutes, differenceInMinutes, format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { fmtDuration } from '../lib/format';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { ColorPicker, DateTimeField, TimeStepper } from '../ui/fields';
import { Button, Chip, Input, Label, Row, Segmented } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { BLOCK_COLORS, useTheme } from '../ui/theme';

/** Create or edit a one-off busy block (optionally turning it into a weekly routine). */
export function BlockEditor() {
  const t = useTheme();
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.close);
  const showToast = useUI((s) => s.showToast);
  const visible = sheet?.kind === 'block';
  const blockId = sheet?.kind === 'block' ? sheet.blockId : undefined;
  const presetStart = sheet?.kind === 'block' ? sheet.start : undefined;
  const existing = useStore((s) => s.blocks.find((b) => b.id === blockId));

  const [label, setLabel] = useState('');
  const [start, setStart] = useState(() => new Date());
  const [end, setEnd] = useState(() => addMinutes(new Date(), 60));
  const [color, setColor] = useState(BLOCK_COLORS[0]);
  const [weekly, setWeekly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setWeekly(false);
    if (existing) {
      setLabel(existing.label);
      setStart(new Date(existing.start));
      setEnd(new Date(existing.end));
      setColor(existing.color);
    } else {
      const s = presetStart ? new Date(presetStart) : new Date();
      if (!presetStart) s.setMinutes(Math.ceil(s.getMinutes() / 15) * 15, 0, 0);
      setLabel('');
      setStart(s);
      setEnd(addMinutes(s, 60));
      setColor(BLOCK_COLORS[1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, blockId, presetStart]);

  const length = differenceInMinutes(end, start);

  const changeStart = (d: Date) => {
    // Keep the same length when the start moves.
    setEnd(addMinutes(d, Math.max(15, length)));
    setStart(d);
  };

  const save = () => {
    if (!label.trim()) return setError('Give it a label, e.g. “Lecture” or “Dentist”.');
    if (end <= start) return setError('The end must be after the start.');
    const { addBlock, updateBlock, deleteBlock, addRoutine, dismissNotice } = useStore.getState();
    dismissNotice();
    if (weekly) {
      addRoutine({
        label: label.trim(),
        days: [start.getDay()],
        startTime: format(start, 'HH:mm'),
        endTime: format(end, 'HH:mm'),
        color,
        activeFrom: format(start, 'yyyy-MM-dd'),
      });
      if (existing) deleteBlock(existing.id);
    } else if (existing) {
      updateBlock(existing.id, { label: label.trim(), start: start.toISOString(), end: end.toISOString(), color });
    } else {
      addBlock({ label: label.trim(), start: start.toISOString(), end: end.toISOString(), color });
    }
    showToast(useStore.getState().notice ?? (weekly ? 'Added as a weekly routine' : 'Busy time saved'));
    dismissNotice();
    close();
  };

  return (
    <Sheet
      visible={visible}
      title={existing ? 'Edit busy time' : 'Add busy time'}
      onClose={close}
      footer={
        <>
          <Button title="Cancel" onPress={close} style={{ flex: 1 }} />
          <Button title="Save" kind="primary" onPress={save} style={{ flex: 2 }} />
        </>
      }
    >
      <Label>Label</Label>
      <Input
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Lecture, Dentist, Shift"
        autoFocus={!existing}
        accessibilityLabel="Label"
      />

      <Label>Starts</Label>
      <DateTimeField value={start} onChange={changeStart} />

      <Label>Ends</Label>
      <TimeStepper value={end} onChange={setEnd} />
      <Row style={{ marginTop: 8 }}>
        {[30, 60, 90, 120, 180, 480].map((m) => (
          <Chip key={m} label={fmtDuration(m)} selected={length === m} onPress={() => setEnd(addMinutes(start, m))} />
        ))}
      </Row>
      <Text style={{ color: length > 0 ? t.textMuted : t.danger, marginTop: 6 }}>
        {length > 0 ? `${fmtDuration(length)}, until ${format(end, 'EEE HH:mm')}` : 'Ends before it starts'}
      </Text>

      <Label>Colour</Label>
      <ColorPicker value={color} onChange={setColor} />

      <Label>Repeat</Label>
      <Segmented
        options={[
          { value: 'once', label: 'Just once' },
          { value: 'weekly', label: `Every ${format(start, 'EEEE')}` },
        ]}
        value={weekly ? 'weekly' : 'once'}
        onChange={(v) => setWeekly(v === 'weekly')}
      />

      {existing && (
        <View style={{ marginTop: 18 }}>
          <Button
            title="Delete"
            kind="danger"
            onPress={() => {
              useStore.getState().deleteBlock(existing.id);
              close();
            }}
          />
        </View>
      )}

      {error && <Text style={{ color: t.danger, marginTop: 12, fontWeight: '600' }}>{error}</Text>}
    </Sheet>
  );
}
