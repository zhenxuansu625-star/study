import { addDays, format, isSameDay, isToday, startOfDay } from 'date-fns';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fmtTime } from '../lib/format';
import { useNow } from '../lib/useNow';
import { expandRoutines } from '../scheduler';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { Segmented, StepButton } from '../ui/primitives';
import { useTheme, type Theme } from '../ui/theme';

const HOUR = 56;
const GUTTER = 46;
const MIN_ITEM = 20;

type ItemKind = 'busy' | 'block' | 'chunk' | 'checkin' | 'history';

interface CalItem {
  key: string;
  kind: ItemKind;
  title: string;
  start: number;
  end: number;
  color?: string;
  locked?: boolean;
  warn?: boolean;
  status?: 'done' | 'partial' | 'missed';
  onPress?: () => void;
}

interface Placed extends CalItem {
  lane: number;
  lanes: number;
}

/** Side-by-side layout for overlapping items. */
function layoutLanes(items: CalItem[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.lanes = lanes));
    out.push(...cluster);
    cluster = [];
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd && cluster.length) flush();
    const laneEnds: number[] = [];
    cluster.forEach((c) => (laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? -Infinity, c.end)));
    let lane = laneEnds.findIndex((e) => e <= it.start);
    if (lane === -1) lane = laneEnds.length;
    cluster.push({ ...it, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return out;
}

export function CalendarScreen() {
  const t = useTheme();
  const now = useNow();
  const [days, setDays] = useState<1 | 3>(3);
  const [first, setFirst] = useState(() => startOfDay(new Date()));
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const open = useUI((s) => s.open);

  const routines = useStore((s) => s.routines);
  const blocks = useStore((s) => s.blocks);
  const chunks = useStore((s) => s.chunks);
  const checkins = useStore((s) => s.checkins);
  const history = useStore((s) => s.history);
  const tasks = useStore((s) => s.tasks);
  const warnings = useStore((s) => s.warnings);

  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => addDays(first, i)), [first, days]);

  useEffect(() => {
    const h = Math.max(0, new Date().getHours() - 1);
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y: h * HOUR, animated: false }), 50);
    return () => clearTimeout(id);
  }, []);

  const columns = useMemo(() => {
    const from = dayList[0].getTime();
    const to = addDays(dayList[dayList.length - 1], 1).getTime();
    const taskTitle = new Map(tasks.map((x) => [x.id, x.title]));
    const warnIds = new Set(warnings.map((w) => w.taskId));
    const occ = expandRoutines(routines, from, to);

    const all: CalItem[] = [
      ...occ.map<CalItem>((o) => ({
        key: o.id,
        kind: 'busy',
        title: o.label,
        start: o.start,
        end: o.end,
        color: o.color,
        onPress: () => open({ kind: 'occurrence', routineId: o.routineId, dateKey: o.dateKey, start: o.start, end: o.end }),
      })),
      ...blocks.map<CalItem>((b) => ({
        key: `b-${b.id}`,
        kind: 'block',
        title: b.label,
        start: new Date(b.start).getTime(),
        end: new Date(b.end).getTime(),
        color: b.color,
        onPress: () => open({ kind: 'block', blockId: b.id }),
      })),
      ...chunks
        .filter((c) => !checkins.some((k) => k.taskId === c.taskId && k.start === c.start))
        .map<CalItem>((c) => ({
          key: `c-${c.taskId}-${c.start}`,
          kind: 'chunk',
          title: taskTitle.get(c.taskId) ?? 'Task',
          start: new Date(c.start).getTime(),
          end: new Date(c.end).getTime(),
          locked: c.locked,
          warn: warnIds.has(c.taskId),
          onPress: () => open({ kind: 'chunk', taskId: c.taskId, start: c.start }),
        })),
      ...checkins.map<CalItem>((c) => ({
        key: `k-${c.taskId}-${c.start}`,
        kind: 'checkin',
        title: taskTitle.get(c.taskId) ?? 'Task',
        start: new Date(c.start).getTime(),
        end: new Date(c.end).getTime(),
      })),
      ...history.map<CalItem>((h) => ({
        key: `h-${h.taskId}-${h.start}`,
        kind: 'history',
        title: h.title,
        start: new Date(h.start).getTime(),
        end: new Date(h.end).getTime(),
        status: h.status,
      })),
    ];

    return dayList.map((day) => {
      const ds = day.getTime();
      const de = addDays(day, 1).getTime();
      const inDay = all
        .filter((i) => i.end > ds && i.start < de)
        .map((i) => ({ ...i, start: Math.max(i.start, ds), end: Math.min(i.end, de) }));
      return { day, items: layoutLanes(inDay) };
    });
  }, [dayList, routines, blocks, chunks, checkins, history, tasks, warnings, open]);

  const title =
    days === 1
      ? format(first, 'EEEE d MMMM')
      : `${format(dayList[0], 'd MMM')} – ${format(dayList[dayList.length - 1], 'd MMM')}`;

  const onToday = isSameDay(first, new Date());

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.toolbar, { borderColor: t.border, backgroundColor: t.surface }]}>
        <View style={styles.toolbarRow}>
          <StepButton label="◀" accessibilityLabel="Previous" onPress={() => setFirst(addDays(first, -days))} />
          <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
            {title}
          </Text>
          <StepButton label="▶" accessibilityLabel="Next" onPress={() => setFirst(addDays(first, days))} />
          <StepButton label={onToday ? 'Today ✓' : 'Today'} onPress={() => setFirst(startOfDay(new Date()))} />
        </View>
        <Segmented
          options={[
            { value: '1', label: 'Day' },
            { value: '3', label: '3 days' },
          ]}
          value={String(days) as '1' | '3'}
          onChange={(v) => setDays(v === '1' ? 1 : 3)}
        />
      </View>

      <View style={[styles.dayHeader, { borderColor: t.border, backgroundColor: t.surface }]}>
        <View style={{ width: GUTTER }} />
        {dayList.map((d) => {
          const today = isToday(d);
          return (
            <View key={d.toISOString()} style={styles.dayHeaderCell}>
              <Text style={{ color: today ? t.accent : t.textMuted, fontSize: 12, fontWeight: '600' }}>
                {format(d, 'EEE').toUpperCase()}
              </Text>
              <View style={[styles.dayNum, today && { backgroundColor: t.accent }]}>
                <Text style={{ color: today ? t.onAccent : t.text, fontSize: 16, fontWeight: '700' }}>
                  {format(d, 'd')}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 96 }}>
        <View style={{ flexDirection: 'row', height: 24 * HOUR }}>
          <View style={{ width: GUTTER }}>
            {Array.from({ length: 24 }, (_, h) => (
              <Text key={h} style={[styles.hourLabel, { top: h * HOUR - 7, color: t.textMuted }]}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </Text>
            ))}
          </View>
          {columns.map(({ day, items }) => (
            <DayColumn key={day.toISOString()} day={day} items={items} now={now} theme={t} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function DayColumn({ day, items, now, theme: t }: { day: Date; items: Placed[]; now: number; theme: Theme }) {
  const open = useUI((s) => s.open);
  const ds = day.getTime();
  const nowOffset = now >= ds && now < addDays(day, 1).getTime() ? ((now - ds) / 3_600_000) * HOUR : null;

  return (
    <View style={[styles.column, { borderColor: t.gridLine }]}>
      {/* Tap empty time to add a busy block there. */}
      {Array.from({ length: 48 }, (_, i) => {
        const start = new Date(day);
        start.setHours(Math.floor(i / 2), (i % 2) * 30, 0, 0);
        return (
          <Pressable
            key={i}
            accessibilityLabel={`Add busy time at ${fmtTime(start)}`}
            onPress={() => open({ kind: 'block', start: start.toISOString() })}
            style={({ pressed }) => [
              styles.cell,
              {
                top: i * (HOUR / 2),
                borderColor: t.gridLine,
                borderTopWidth: i % 2 === 0 ? 1 : 0,
                backgroundColor: pressed ? t.accentSoft : 'transparent',
              },
            ]}
          />
        );
      })}

      {items.map((it) => (
        <ItemView key={it.key} item={it} dayStart={ds} theme={t} />
      ))}

      {nowOffset !== null && (
        <View pointerEvents="none" style={[styles.nowLine, { top: nowOffset, backgroundColor: t.nowLine }]}>
          <View style={[styles.nowDot, { backgroundColor: t.nowLine }]} />
        </View>
      )}
    </View>
  );
}

function ItemView({ item, dayStart, theme: t }: { item: Placed; dayStart: number; theme: Theme }) {
  const top = ((item.start - dayStart) / 3_600_000) * HOUR;
  const height = Math.max(MIN_ITEM, ((item.end - item.start) / 3_600_000) * HOUR - 2);
  const widthPct = 100 / item.lanes;
  const position = {
    top: top + 1,
    height,
    left: `${item.lane * widthPct}%` as const,
    width: `${widthPct}%` as const,
  };

  let box: object;
  let textColor: string;
  let prefix = '';
  switch (item.kind) {
    case 'busy':
    case 'block':
      box = { backgroundColor: item.color, opacity: item.kind === 'busy' ? 0.88 : 1 };
      textColor = t.busyText;
      if (item.kind === 'busy') prefix = '↻ ';
      break;
    case 'chunk':
      box = {
        backgroundColor: t.accentSoft,
        borderColor: item.warn ? t.warn : t.accent,
        borderWidth: 1,
        borderLeftWidth: 4,
      };
      textColor = t.text;
      prefix = item.locked ? '🔒 ' : item.warn ? '⚠ ' : '';
      break;
    case 'checkin':
      box = { backgroundColor: t.warnSoft, borderColor: t.warn, borderWidth: 1, borderStyle: 'dashed' };
      textColor = t.text;
      prefix = '? ';
      break;
    case 'history':
      box = { backgroundColor: t.surfaceAlt, borderColor: t.border, borderWidth: 1, opacity: 0.8 };
      textColor = t.textMuted;
      prefix = item.status === 'done' ? '✓ ' : item.status === 'partial' ? '½ ' : '✗ ';
      break;
  }

  const showTime = height >= 36;
  const content = (
    <>
      <Text numberOfLines={height >= 52 ? 2 : 1} style={[styles.itemTitle, { color: textColor }]}>
        {prefix}
        {item.title}
      </Text>
      {showTime && (
        <Text numberOfLines={1} style={[styles.itemTime, { color: textColor, opacity: 0.85 }]}>
          {fmtTime(item.start)}–{fmtTime(item.end)}
        </Text>
      )}
    </>
  );

  if (!item.onPress) {
    return (
      <View pointerEvents="none" style={[styles.item, position, box]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${fmtTime(item.start)} to ${fmtTime(item.end)}`}
      onPress={item.onPress}
      style={({ pressed }) => [styles.item, position, box, pressed && { opacity: 0.7 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  dayHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  dayHeaderCell: { flex: 1, alignItems: 'center', gap: 2 },
  dayNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  hourLabel: { position: 'absolute', right: 6, fontSize: 11, fontVariant: ['tabular-nums'] },
  column: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, position: 'relative' },
  cell: { position: 'absolute', left: 0, right: 0, height: HOUR / 2 },
  item: { position: 'absolute', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden' },
  itemTitle: { fontSize: 12, fontWeight: '600' },
  itemTime: { fontSize: 11, fontVariant: ['tabular-nums'] },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2 },
  nowDot: { position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 4 },
});
