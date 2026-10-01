import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text } from '../theme';
import { pickAndUploadImage } from '../lib/upload';
import Avatar from './Avatar';
import Icon from './Icon';

type Props = { name: string; url: string; schoolId: string | null; onChange: (url: string) => void; label?: string };

export default function PhotoField({ name, url, schoolId, onChange, label = 'Photo' }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const choose = async () => {
    setMessage('');
    setBusy(true);
    try {
      const result = await pickAndUploadImage(schoolId);
      if (result) {
        onChange(result.url);
        setFailed(false);
        setMessage('Photo uploaded. Save to keep it.');
      }
    } catch (e: any) {
      setFailed(true);
      setMessage(e.message);
    }
    setBusy(false);
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={choose} disabled={busy} style={styles.avatarBox}>
        <Avatar name={name} uri={url || undefined} size={96} />
        <View style={styles.badge}>
          {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="plus" size={16} color="#FFFFFF" strokeWidth={2.6} />}
        </View>
      </Pressable>
      <Text style={[text.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{url ? 'Tap to change ' + label.toLowerCase() : 'Tap to add ' + label.toLowerCase()}</Text>
      {message ? <Text style={[text.small, { color: failed ? colors.danger : colors.success, marginTop: 4 }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing.xl },
  avatarBox: { width: 96, height: 96 },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
