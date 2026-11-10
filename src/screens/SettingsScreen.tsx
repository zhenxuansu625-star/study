import React, { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { useUI } from '../state/ui';
import { NumberStepper } from '../ui/fields';
import { Button, Card, Input, Label, Row } from '../ui/primitives';
import { useTheme } from '../ui/theme';

export function SettingsScreen() {
  const t = useTheme();
  const settings = useStore((s) => s.settings);
  const { updateSettings, exportData, importData, loadDemo, resetAll } = useStore.getState();
  const showToast = useUI((s) => s.showToast);
  const [exportText, setExportText] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [confirm, setConfirm] = useState<'reset' | 'demo' | null>(null);

  const doExport = async () => {
    const json = exportData();
    if (Platform.OS !== 'web') {
      try {
        await Share.share({ message: json, title: 'Timetable backup' });
        return;
      } catch {
        // fall through to showing the text
      }
    }
    setExportText(json);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.h1, { color: t.text }]}>Settings</Text>

      <Card>
        <Text style={[styles.h2, { color: t.text }]}>Scheduling</Text>
        <Label>Gap around tasks</Label>
        <NumberStepper
          value={settings.bufferMinutes}
          step={5}
          min={0}
          max={60}
          suffix="min"
          onChange={(n) => updateSettings({ bufferMinutes: n })}
        />
        <Text style={[styles.help, { color: t.textMuted }]}>Breathing room kept before and after each task.</Text>

        <Label>Don’t schedule sooner than</Label>
        <NumberStepper
          value={settings.leadTimeMinutes}
          step={5}
          min={0}
          max={180}
          suffix="min from now"
          onChange={(n) => updateSettings({ leadTimeMinutes: n })}
        />
        <Text style={[styles.help, { color: t.textMuted }]}>
          So a new task never lands in the next few minutes. Sessions starting within this window stay fixed.
        </Text>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={[styles.h2, { color: t.text }]}>How tasks are placed</Text>
        <Text style={[styles.help, { color: t.textMuted, marginTop: 4 }]}>
          • Soonest deadline first; high priority gets a head start.{'\n'}• Each task goes in the earliest free time, so
          later time stays open for emergencies.{'\n'}• Up to 1h: always one sitting.{'\n'}• 1h–2.5h: one sitting, unless
          splitting finishes it more than a day sooner.{'\n'}• Over 2.5h: split into 45 min–2h sessions.{'\n'}• Add busy
          time on top of a task and it moves automatically.
        </Text>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={[styles.h2, { color: t.text }]}>Your data</Text>
        <Text style={[styles.help, { color: t.textMuted }]}>Everything is stored only on this device.</Text>
        <Row style={{ marginTop: 10 }}>
          <Button title="Export backup" onPress={doExport} small />
          <Button title="Import backup" onPress={() => setImportOpen(!importOpen)} small />
        </Row>
        {exportText && (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.help, { color: t.textMuted }]}>Copy this text and keep it somewhere safe:</Text>
            <Input value={exportText} multiline style={{ height: 160, fontSize: 12, marginTop: 6 }} selectTextOnFocus />
            <Button title="Hide" kind="ghost" small onPress={() => setExportText(null)} />
          </View>
        )}
        {importOpen && (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Input
              value={importText}
              onChangeText={setImportText}
              multiline
              placeholder="Paste a backup here"
              style={{ height: 120, fontSize: 12 }}
            />
            <Button
              title="Replace my data with this backup"
              kind="primary"
              small
              onPress={() => {
                const err = importData(importText);
                showToast(err ?? 'Backup imported');
                if (!err) {
                  setImportText('');
                  setImportOpen(false);
                }
              }}
            />
          </View>
        )}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={[styles.h2, { color: t.text }]}>Testing</Text>
        {confirm === null ? (
          <Row style={{ marginTop: 6 }}>
            <Button title="Load demo data" small onPress={() => setConfirm('demo')} />
            <Button title="Erase everything" small kind="danger" onPress={() => setConfirm('reset')} />
          </Row>
        ) : (
          <View style={{ marginTop: 6, gap: 8 }}>
            <Text style={{ color: t.text }}>
              {confirm === 'demo'
                ? 'Replace your current data with demo routines and tasks?'
                : 'Erase all tasks, busy times and routines? This can’t be undone.'}
            </Text>
            <Row>
              <Button title="Cancel" small onPress={() => setConfirm(null)} />
              <Button
                title={confirm === 'demo' ? 'Load demo' : 'Erase'}
                small
                kind={confirm === 'demo' ? 'primary' : 'danger'}
                onPress={() => {
                  if (confirm === 'demo') loadDemo();
                  else resetAll();
                  setConfirm(null);
                  showToast(confirm === 'demo' ? 'Demo data loaded' : 'All data erased');
                }}
              />
            </Row>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110, width: '100%', maxWidth: 720, alignSelf: 'center' },
  h1: { fontSize: 26, fontWeight: '800', marginBottom: 12 },
  h2: { fontSize: 17, fontWeight: '700' },
  help: { fontSize: 13, lineHeight: 19, marginTop: 6 },
});
