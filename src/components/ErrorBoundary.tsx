import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text } from '../theme';
import { logger } from '../lib/logger';
import Button from './Button';

type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    logger.error('Screen crashed: ' + error.message);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <View style={styles.wrap}>
        <Text style={[text.h2, { color: colors.text }]}>Something went wrong</Text>
        <Text style={[text.body, styles.msg]}>{this.state.error.message}</Text>
        <Button title="Try again" onPress={() => this.setState({ error: null })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  msg: { color: colors.textMuted, marginVertical: spacing.lg },
});
