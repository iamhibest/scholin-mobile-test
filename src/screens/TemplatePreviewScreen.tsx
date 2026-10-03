import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { EmptyState, Screen } from '../components';
import { colors } from '../theme';
import { supabase } from '../lib/supabase';
import { useStaff } from '../lib/useStaff';
import { getSampleData, templateHtml } from '../lib/templateSample';

export default function TemplatePreviewScreen({ navigation, route }: any) {
  const { templateKey, name } = route.params;
  const { ctx } = useStaff();
  const [html, setHtml] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: name + ' preview' });
  }, [navigation, name]);

  useEffect(() => {
    if (!ctx) {
      return;
    }
    (async () => {
      try {
        const { data: row } = await supabase.rpc('get_report_card_template', { p_school_id: ctx.schoolId });
        const sample = await getSampleData(ctx.school);
        setHtml(templateHtml(templateKey, sample, row && row.report_template === templateKey ? row : {}));
      } catch {
        setFailed(true);
      }
    })();
  }, [ctx, templateKey]);

  if (failed) {
    return (
      <Screen>
        <EmptyState icon="info" title="Could not build the preview" />
      </Screen>
    );
  }

  return (
    <Screen padded={false} background="#E5E7EB">
      {html ? (
        <WebView originWhitelist={['*']} source={{ html }} style={{ flex: 1, backgroundColor: '#E5E7EB' }} scalesPageToFit bounces={false} />
      ) : (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
