import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Input, Notice, Screen } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { showError } from '../lib/confirm';
import { updateClass } from '../lib/school';
import { deleteClass } from '../lib/portal';

export default function ClassSettingsScreen({ navigation, route }: any) {
  const { classId, rawName, arm: initialArm } = route.params;
  const [name, setName] = useState(rawName || '');
  const [arm, setArm] = useState(initialArm || '');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      setNotice({ message: 'Class name is required.', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await updateClass(classId, name.trim(), arm.trim());
      setNotice({ message: 'Class updated.', tone: 'success' });
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setSaving(false);
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteClass(classId);
      setConfirming(false);
      navigation.pop(2);
    } catch (e: any) {
      showError(e.message);
      setDeleting(false);
    }
  };

  return (
    <Screen scroll>
      <Notice message={notice.message} tone={notice.tone} />
      <Input label="Class name" value={name} onChangeText={setName} icon="cap" autoCapitalize="words" />
      <Input label="Arm (optional)" value={arm} onChangeText={setArm} placeholder="e.g. A" autoCapitalize="characters" />
      <Button title="Save changes" loading={saving} onPress={save} style={{ marginTop: spacing.sm }} />
      <View style={styles.danger}>
        <Text style={[text.h3, { color: colors.danger }]}>Delete class</Text>
        <Text style={[text.small, styles.muted]}>This permanently deletes the class and all its results, student assignments and comments for this session. It cannot be undone.</Text>
        <Button title="Delete this class" variant="danger" onPress={() => { setTyped(''); setConfirming(true); }} style={{ marginTop: spacing.md }} />
      </View>

      <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => setConfirming(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={[text.h3, { color: colors.text }]}>Confirm deletion</Text>
            <Text style={[text.small, styles.muted]}>{'Type the class name exactly to confirm:\n' + name.trim()}</Text>
            <TextInput value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} style={styles.typed} placeholder="Class name" placeholderTextColor="#9CA3AF" />
            <View style={styles.actions}>
              <Button title="Cancel" variant="soft" onPress={() => setConfirming(false)} style={{ flex: 1 }} />
              <Button title="Delete" variant="danger" loading={deleting} disabled={typed !== name.trim()} onPress={remove} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  danger: { marginTop: spacing.xxl, paddingTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  muted: { color: colors.textMuted, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl },
  typed: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 50, color: colors.text, fontSize: 16 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
