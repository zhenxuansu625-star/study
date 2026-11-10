import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';

/** Bottom sheet used for every editor and prompt. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
  dismissable = true,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissable?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismissable ? onClose : () => {}}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: t.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissable ? onClose : undefined} accessibilityLabel="Close" />
          <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
                {title}
              </Text>
              {dismissable && (
                <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
                  <Text style={{ color: t.textMuted, fontSize: 22, lineHeight: 24 }}>✕</Text>
                </Pressable>
              )}
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
              {children}
            </ScrollView>
            {footer && <View style={styles.footer}>{footer}</View>}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 19, fontWeight: '700', flex: 1, paddingRight: 12 },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 12 },
});
