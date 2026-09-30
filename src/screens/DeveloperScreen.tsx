import React, { useState } from 'react';
import { Text } from 'react-native';
import { Card, ListRow, Screen } from '../components';
import { colors, spacing, text } from '../theme';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export default function DeveloperScreen({ navigation }: any) {
  const [status, setStatus] = useState('Not checked yet');

  async function checkBackend() {
    setStatus('Checking...');
    try {
      const res = await fetch(env.supabaseUrl + '/auth/v1/health', { headers: { apikey: env.supabaseAnonKey } });
      const msg = res.ok ? 'Backend reachable, status ' + res.status : 'Backend replied with status ' + res.status;
      setStatus(msg);
      logger.info(msg);
    } catch (e: any) {
      setStatus('Cannot reach backend: ' + e.message);
      logger.error('Backend check failed: ' + e.message);
    }
  }

  return (
    <Screen scroll>
      <Card>
        <ListRow title="Check backend connection" subtitle={status} icon="server" onPress={checkBackend} />
        <ListRow title="QR scanner" icon="scan" onPress={() => navigation.navigate('Scan')} />
        <ListRow title="Location" icon="pin" tint={colors.successSoft} iconColor={colors.success} onPress={() => navigation.navigate('Location')} />
        <ListRow title="Push token" icon="bell" tint={colors.purpleSoft} iconColor={colors.purple} onPress={() => navigation.navigate('Push')} />
        <ListRow title="PDF generation" icon="file" tint={colors.accentSoft} iconColor={colors.accent} onPress={() => navigation.navigate('Pdf')} />
        <ListRow title="App logs" icon="bug" onPress={() => navigation.navigate('Logs')} />
      </Card>
      <Text style={[text.caption, { color: colors.textMuted, marginTop: spacing.xl, textAlign: 'center' }]}>Version {env.appVersion}</Text>
    </Screen>
  );
}
