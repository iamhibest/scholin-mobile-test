import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as HtmlToPdfModule from 'react-native-html-to-pdf';
import Share from 'react-native-share';

const sampleHtml = `
  <html>
    <body style="font-family: sans-serif; padding: 24px;">
      <h1 style="color: #1857D6;">Scholin Report Card</h1>
      <p>Student, Test Student</p>
      <p>Term, First Term</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Subject</th>
          <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Score</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px;">Mathematics</td>
          <td style="border: 1px solid #ccc; padding: 8px;">88</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px;">English</td>
          <td style="border: 1px solid #ccc; padding: 8px;">91</td>
        </tr>
      </table>
    </body>
  </html>
`;

export default function PdfTestScreen() {
  const [status, setStatus] = useState('Tap the button to generate a sample PDF');

  async function handleGeneratePdf() {
    setStatus('Generating...');
    try {
      const mod: any = HtmlToPdfModule;
      const generate = mod.generatePDF || mod.default?.generatePDF || mod.convert || mod.default?.convert;
      if (typeof generate !== 'function') {
        throw new Error('pdf exports: ' + Object.keys(mod).join(', '));
      }
      const file = await generate({
        html: sampleHtml,
        fileName: 'phase0_test_report_card',
        directory: 'Documents',
      });

      setStatus('Saved at ' + file.filePath);

      if (file.filePath) {
        await Share.open({ url: 'file://' + file.filePath, type: 'application/pdf' });
      }
    } catch (error: any) {
      setStatus('Error, ' + (error.message || 'could not generate PDF'));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{status}</Text>
      <TouchableOpacity style={styles.button} onPress={handleGeneratePdf}>
        <Text style={styles.buttonText}>Generate Sample Report Card</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F5F8FE' },
  label: { fontSize: 13, color: '#1A2233', marginBottom: 24, textAlign: 'center' },
  button: { backgroundColor: '#1857D6', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
