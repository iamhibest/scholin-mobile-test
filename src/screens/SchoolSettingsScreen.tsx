import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import { Avatar, Button, Card, EmptyState, Icon, Input, Notice, OptionField, Screen, Skeleton, SwitchRow, TimeField } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { useChain } from '../lib/useChain';
import { confirmAction } from '../lib/confirm';
import { pickAndUploadImage } from '../lib/upload';
import { acceptPaymentTerms, addGrade, deleteGrade, fetchGrades, fetchPaymentTerms, fetchSchoolRow, updateSchool } from '../lib/admin';
import { NIGERIAN_BANKS } from '../lib/banks';
import { callFunction } from '../lib/payments';

type Msg = { message: string; tone: 'error' | 'success' };
const none: Msg = { message: '', tone: 'success' };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card style={styles.card}>
      <Text style={[text.h3, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{hint}</Text> : null}
      <View style={{ marginTop: spacing.md }}>{children}</View>
    </Card>
  );
}

function ImageSlot({ label, url, schoolId, onUploaded }: { label: string; url: string; schoolId: string; onUploaded: (u: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(none);
  const pick = async () => {
    setMsg(none);
    setBusy(true);
    try {
      const r = await pickAndUploadImage(schoolId);
      if (r) {
        await onUploaded(r.url);
        setMsg({ message: label + ' updated.', tone: 'success' });
      }
    } catch (e: any) {
      setMsg({ message: e.message, tone: 'error' });
    }
    setBusy(false);
  };
  return (
    <View style={styles.slot}>
      <Pressable onPress={pick} disabled={busy} style={styles.slotBox}>
        {url ? <Avatar name={label} uri={url} size={72} /> : <Icon name="plus" size={26} color={colors.textMuted} />}
        {busy ? <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.primary} /> : null}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyStrong, { color: colors.text }]}>{label}</Text>
        <Text style={[text.small, { color: colors.textMuted }]}>{url ? 'Tap the picture to change it.' : 'Tap the box to add one.'}</Text>
        {msg.message ? <Text style={[text.small, { color: msg.tone === 'error' ? colors.danger : colors.success, marginTop: 2 }]}>{msg.message}</Text> : null}
      </View>
    </View>
  );
}

export default function SchoolSettingsScreen() {
  const { ctx, loading: ctxLoading } = useStaff();
  const infoChain = useChain(5);
  const [school, setSchool] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  const [info, setInfo] = useState({ name: '', address: '', phone: '', email: '', motto: '' });
  const [infoMsg, setInfoMsg] = useState<Msg>(none);
  const [delegate, setDelegate] = useState(false);

  const [autoAdm, setAutoAdm] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [admMsg, setAdmMsg] = useState<Msg>(none);

  const [mode, setMode] = useState('combined');
  const [modeMsg, setModeMsg] = useState<Msg>(none);

  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('100');
  const [opening, setOpening] = useState('07:30');
  const [lateT, setLateT] = useState('08:00');
  const [closing, setClosing] = useState('16:00');
  const [attMsg, setAttMsg] = useState<Msg>(none);
  const attChain = useChain(3);

  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [togMsg, setTogMsg] = useState<Msg>(none);

  const [feeGate, setFeeGate] = useState(false);
  const [feeMsg, setFeeMsg] = useState<Msg>(none);

  const [grades, setGrades] = useState<any[]>([]);
  const [gMin, setGMin] = useState('');
  const [gMax, setGMax] = useState('');
  const [gLetter, setGLetter] = useState('');
  const [gRemark, setGRemark] = useState('');
  const [gMsg, setGMsg] = useState<Msg>(none);
  const gradeChain = useChain(4);

  const [bankCode, setBankCode] = useState('');
  const [acctNo, setAcctNo] = useState('');
  const [payMsg, setPayMsg] = useState<Msg>(none);
  const [terms, setTerms] = useState<{ text: string; version: any } | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  const [saving, setSaving] = useState('');

  const isOwner = !!ctx && ctx.role === 'owner';
  const canEditInfo = !!school && (isOwner || school.teacher_admin_can_edit_school_info === true);

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      const s = await fetchSchoolRow(ctx.schoolId);
      setSchool(s);
      setInfo({ name: s.name || '', address: s.address || '', phone: s.phone || '', email: s.email || '', motto: s.motto || '' });
      setDelegate(s.teacher_admin_can_edit_school_info === true);
      setAutoAdm(s.auto_admission_enabled === true);
      setPrefix(s.admission_prefix || '');
      setMode(s.attendance_mode || 'combined');
      setLat(s.attendance_latitude !== null && s.attendance_latitude !== undefined ? String(s.attendance_latitude) : '');
      setLng(s.attendance_longitude !== null && s.attendance_longitude !== undefined ? String(s.attendance_longitude) : '');
      setRadius(String(s.attendance_radius_meters || 100));
      setOpening((s.attendance_opening_time || '07:30').slice(0, 5));
      setLateT((s.attendance_late_time || '08:00').slice(0, 5));
      setClosing((s.attendance_closing_time || '16:00').slice(0, 5));
      setFeeGate(s.fee_gated_report_release === true);
      setBankCode(s.paystack_bank_code || '');
      setAcctNo(s.paystack_account_number || '');
      setToggles({
        show_position_class: s.show_position_class !== false,
        show_position_arm: s.show_position_arm !== false,
        show_attendance: s.show_attendance !== false,
        show_cognitive_skills: s.show_cognitive_skills !== false,
        show_character_conduct: s.show_character_conduct !== false,
        show_stamp: s.show_stamp !== false,
        show_dob_rc: s.show_dob_rc !== false,
        show_student_photo_rc: s.show_student_photo_rc !== false,
        show_class_size_rc: s.show_class_size_rc !== false,
      });
      setGrades(await fetchGrades(ctx.schoolId));
    } catch {
      setFailed(true);
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async (key: string, patch: Record<string, any>, set: (m: Msg) => void, ok: string, after?: () => void) => {
    if (!ctx) {
      return;
    }
    setSaving(key);
    set(none);
    try {
      await updateSchool(ctx.schoolId, patch);
      set({ message: ok, tone: 'success' });
      if (after) {
        after();
      }
    } catch (e: any) {
      set({ message: e.message, tone: 'error' });
    }
    setSaving('');
  };

  const useLocation = async () => {
    setAttMsg(none);
    if (Platform.OS === 'android') {
      const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (g !== PermissionsAndroid.RESULTS.GRANTED) {
        setAttMsg({ message: 'Location permission is needed.', tone: 'error' });
        return;
      }
    }
    Geolocation.getCurrentPosition(
      p => {
        setLat(String(p.coords.latitude));
        setLng(String(p.coords.longitude));
        setAttMsg({ message: 'Location filled in. Remember to save.', tone: 'success' });
      },
      () => setAttMsg({ message: 'Could not get your location. Please enable GPS and try again.', tone: 'error' }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };


  const verifyAndSave = async () => {
    if (!ctx) {
      return;
    }
    const bank = NIGERIAN_BANKS.find(b => b.code === bankCode);
    setSaving('payout');
    setPayMsg(none);
    try {
      const r = await callFunction('create-subaccount', { school_id: ctx.schoolId, bank_code: bankCode, bank_name: bank ? bank.name : '', account_number: acctNo.trim() }, "That didn't go through. Please check the details and try again.");
      setPayMsg({ message: 'Verified. Account name: ' + r.account_name + '. Bank account saved.', tone: 'success' });
      await load();
    } catch (e: any) {
      setPayMsg({ message: e.message, tone: 'error' });
    }
    setSaving('');
  };

  const startPayout = async () => {
    if (!ctx) {
      return;
    }
    setPayMsg(none);
    if (!bankCode) {
      setPayMsg({ message: 'Please select a bank.', tone: 'error' });
      return;
    }
    if (!/^\d{10}$/.test(acctNo.trim())) {
      setPayMsg({ message: 'Account number must be exactly 10 digits.', tone: 'error' });
      return;
    }
    setSaving('payout');
    try {
      const t = await fetchPaymentTerms(ctx.userId);
      if (t.text && !t.accepted) {
        setTerms({ text: t.text, version: t.version });
        setTermsOpen(true);
        setSaving('');
        return;
      }
    } catch {}
    setSaving('');
    await verifyAndSave();
  };

  const acceptTerms = async () => {
    if (!ctx || !terms) {
      return;
    }
    setTermsOpen(false);
    try {
      await acceptPaymentTerms(ctx.userId, terms.version);
    } catch {}
    await verifyAndSave();
  };

  const declineTerms = () => {
    setTermsOpen(false);
    setPayMsg({ message: 'You must accept the Payment Terms of Use to add or update a payout bank account.', tone: 'error' });
  };

  const removePayout = () => {
    confirmAction('Remove bank account', 'Remove this payout bank account? Online fee payments for this school will stop working until a new one is added.', 'Remove', async () => {
      if (!ctx) {
        return;
      }
      setSaving('payout');
      setPayMsg(none);
      try {
        await callFunction('delete-subaccount', { school_id: ctx.schoolId }, "That didn't go through. Please try again.");
        setBankCode('');
        setAcctNo('');
        await load();
      } catch (e: any) {
        setPayMsg({ message: e.message, tone: 'error' });
      }
      setSaving('');
    });
  };

  const addGradeBand = async () => {
    if (!ctx) {
      return;
    }
    const lo = parseFloat(gMin);
    const hi = parseFloat(gMax);
    if (isNaN(lo) || isNaN(hi) || !gLetter.trim()) {
      setGMsg({ message: 'Please fill in min, max, and grade letter.', tone: 'error' });
      return;
    }
    try {
      await addGrade(ctx.schoolId, lo, hi, gLetter.trim(), gRemark.trim());
      setGMin('');
      setGMax('');
      setGLetter('');
      setGRemark('');
      setGMsg(none);
      setGrades(await fetchGrades(ctx.schoolId));
    } catch (e: any) {
      setGMsg({ message: e.message, tone: 'error' });
    }
  };

  const removeGrade = (g: any) => {
    confirmAction('Remove grade band', 'Remove this grade band?', 'Remove', async () => {
      if (!ctx) {
        return;
      }
      try {
        await deleteGrade(g.id);
        setGrades(await fetchGrades(ctx.schoolId));
      } catch (e: any) {
        setGMsg({ message: e.message, tone: 'error' });
      }
    });
  };

  if (ctxLoading || (!school && !failed)) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={180} radius={24} />
          <Skeleton height={140} radius={24} />
        </View>
      </Screen>
    );
  }

  if (ctx && !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can open school settings." />
      </Screen>
    );
  }

  if (failed || !school || !ctx) {
    return (
      <Screen>
        <EmptyState icon="info" title="Could not load school settings" actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  const tog = (key: string, label: string) => <SwitchRow key={key} label={label} value={!!toggles[key]} onChange={v => setToggles({ ...toggles, [key]: v })} />;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Section title="School information">
          <Notice message={infoMsg.message} tone={infoMsg.tone} />
          {!canEditInfo ? <Notice message="Only the school owner can edit this information, unless they grant you permission." tone="error" /> : null}
          <Input {...infoChain(0)} label="School name" value={info.name} onChangeText={v => setInfo({ ...info, name: v })} editable={canEditInfo} icon="cap" autoCapitalize="words" />
          <Input {...infoChain(1)} label="Address" value={info.address} onChangeText={v => setInfo({ ...info, address: v })} editable={canEditInfo} icon="pin" />
          <Input {...infoChain(2)} label="Phone" value={info.phone} onChangeText={v => setInfo({ ...info, phone: v })} editable={canEditInfo} icon="phone" keyboardType="phone-pad" />
          <Input {...infoChain(3)} label="Email" value={info.email} onChangeText={v => setInfo({ ...info, email: v })} editable={canEditInfo} icon="mail" keyboardType="email-address" autoCapitalize="none" />
          <Input {...infoChain(4)} label="Motto" value={info.motto} onChangeText={v => setInfo({ ...info, motto: v })} editable={canEditInfo} />
          {canEditInfo ? (
            <Button
              title="Save information"
              loading={saving === 'info'}
              onPress={() => {
                if (!info.name.trim()) {
                  setInfoMsg({ message: 'School name is required.', tone: 'error' });
                  return;
                }
                save('info', { name: info.name.trim(), address: info.address.trim() || null, phone: info.phone.trim() || null, email: info.email.trim() || null, motto: info.motto.trim() || null }, setInfoMsg, 'School information updated.');
              }}
            />
          ) : null}
        </Section>

        {isOwner ? (
          <Section title="Delegate permissions">
            <SwitchRow
              label="Let teacher admins edit school information"
              desc="Name, address, phone, email and motto."
              value={delegate}
              onChange={v => {
                setDelegate(v);
                save('delegate', { teacher_admin_can_edit_school_info: v }, () => {}, '');
              }}
            />
          </Section>
        ) : null}

        <Section title="School branding" hint="Shown on report cards.">
          <ImageSlot label="School logo" url={school.logo_url || ''} schoolId={ctx.schoolId} onUploaded={async u => { await updateSchool(ctx.schoolId, { logo_url: u }); setSchool({ ...school, logo_url: u }); }} />
          <ImageSlot label="School stamp" url={school.stamp_url || ''} schoolId={ctx.schoolId} onUploaded={async u => { await updateSchool(ctx.schoolId, { stamp_url: u }); setSchool({ ...school, stamp_url: u }); }} />
        </Section>

        <Section title="Admission numbers">
          <Notice message={admMsg.message} tone={admMsg.tone} />
          <SwitchRow label="Generate admission numbers automatically" desc="New students get the next number for the session." value={autoAdm} onChange={setAutoAdm} />
          {autoAdm ? <Input label="School abbreviation" value={prefix} onChangeText={t => setPrefix(t.toUpperCase())} placeholder="e.g. HBS" autoCapitalize="characters" /> : null}
          <Button
            title="Save admission settings"
            loading={saving === 'adm'}
            onPress={() => {
              if (autoAdm && !prefix.trim()) {
                setAdmMsg({ message: 'Please enter a school abbreviation to enable auto generated admission numbers.', tone: 'error' });
                return;
              }
              save('adm', { auto_admission_enabled: autoAdm, admission_prefix: autoAdm ? prefix.trim().toUpperCase() : null }, setAdmMsg, 'Admission number settings saved.');
            }}
          />
        </Section>

        <Section title="Attendance mode">
          <Notice message={modeMsg.message} tone={modeMsg.tone} />
          <OptionField
            label="How the daily register is marked"
            value={mode}
            options={[
              { value: 'combined', label: 'One combined register per day' },
              { value: 'separate', label: 'Separate morning and afternoon registers' },
            ]}
            onChange={setMode}
          />
          <Button title="Save attendance mode" loading={saving === 'mode'} onPress={() => save('mode', { attendance_mode: mode }, setModeMsg, 'Attendance mode saved.')} />
        </Section>

        <Section title="Staff attendance settings" hint="Where and when staff can clock in.">
          <Notice message={attMsg.message} tone={attMsg.tone} />
          <Button title="Use my current location" icon="pin" variant="soft" onPress={useLocation} style={{ marginBottom: spacing.lg }} />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input label="Latitude" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Longitude" value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
          <Input {...attChain(0)} label="Allowed radius in meters" value={radius} onChangeText={setRadius} keyboardType="number-pad" />
          <TimeField label="Opening time" value={opening} onChange={setOpening} />
          <TimeField label="Late after" value={lateT} onChange={setLateT} />
          <TimeField label="Closing time" value={closing} onChange={setClosing} />
          <Button
            title="Save staff attendance settings"
            loading={saving === 'att'}
            onPress={() =>
              save(
                'att',
                {
                  attendance_latitude: lat ? parseFloat(lat) : null,
                  attendance_longitude: lng ? parseFloat(lng) : null,
                  attendance_radius_meters: parseInt(radius, 10) || 100,
                  attendance_opening_time: opening || '07:30',
                  attendance_late_time: lateT || '08:00',
                  attendance_closing_time: closing || '16:00',
                },
                setAttMsg,
                'Attendance settings saved.',
              )
            }
          />
        </Section>

        <Section title="Report card display options">
          <Notice message={togMsg.message} tone={togMsg.tone} />
          {tog('show_position_class', 'Show position in class')}
          {tog('show_position_arm', 'Show position in arm')}
          {tog('show_attendance', 'Show attendance')}
          {tog('show_cognitive_skills', 'Show cognitive skills')}
          {tog('show_character_conduct', 'Show character and conduct')}
          {tog('show_stamp', 'Show school stamp')}
          {tog('show_dob_rc', 'Show date of birth')}
          {tog('show_student_photo_rc', 'Show student photo')}
          {tog('show_class_size_rc', 'Show class size')}
          <Button title="Save display options" loading={saving === 'tog'} onPress={() => save('tog', toggles, setTogMsg, 'Display options saved.')} style={{ marginTop: spacing.md }} />
        </Section>


        {isOwner ? (
          <Section title="Payout bank account" hint="Add your school's bank account to receive online fee payments directly. Owner only.">
            <View style={[styles.payBanner, { backgroundColor: school.paystack_subaccount_code ? colors.successSoft : colors.accentSoft }]}>
              <Icon name={school.paystack_subaccount_code ? 'check' : 'info'} size={20} color={school.paystack_subaccount_code ? colors.success : colors.accentDark} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: school.paystack_subaccount_code ? colors.success : colors.accentDark }]}>{school.paystack_subaccount_code ? 'Verified' : 'Not set up yet'}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>
                  {school.paystack_subaccount_code
                    ? (school.paystack_bank_name || '') + ', account ending ' + String(school.paystack_account_number || '').slice(-4) + ' (' + (school.paystack_account_name || '') + ')'
                    : "Online fee payments won't be available for this school until this is added."}
                </Text>
              </View>
            </View>
            <Notice message={payMsg.message} tone={payMsg.tone} />
            <OptionField label="Bank" value={bankCode} options={NIGERIAN_BANKS.map(b => ({ value: b.code, label: b.name }))} placeholder="Select bank" onChange={setBankCode} />
            <Input label="Account number" value={acctNo} onChangeText={t => setAcctNo(t.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" placeholder="10 digit account number" icon="card" maxLength={10} />
            <Button title={school.paystack_subaccount_code ? 'Verify and update bank account' : 'Verify and save bank account'} loading={saving === 'payout'} onPress={startPayout} />
            {school.paystack_subaccount_code ? <Button title="Delete bank account" variant="danger" onPress={removePayout} style={{ marginTop: spacing.md }} /> : null}
          </Section>
        ) : null}

        <Section title="Report card release">
          <Notice message={feeMsg.message} tone={feeMsg.tone} />
          <SwitchRow label="Hold report cards until fees are paid" desc="Parents only see a report card once the student has no outstanding fees, unless you release it early." value={feeGate} onChange={setFeeGate} />
          <Button title="Save" loading={saving === 'fee'} onPress={() => save('fee', { fee_gated_report_release: feeGate }, setFeeMsg, 'Saved.')} />
        </Section>

        <Section title="Grading scale">
          <Notice message={gMsg.message} tone={gMsg.tone} />
          {grades.length === 0 ? <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>No grade bands set up yet.</Text> : null}
          {grades.map(g => (
            <View key={g.id} style={styles.grade}>
              <Text style={[text.body, { color: colors.text, flex: 1 }]}>{g.min_score + '% to ' + g.max_score + '%: Grade ' + g.grade + (g.remark ? ' (' + g.remark + ')' : '')}</Text>
              <Button title="Remove" variant="danger" onPress={() => removeGrade(g)} style={{ height: 38, paddingHorizontal: 12 }} />
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input {...gradeChain(0)} label="Min %" value={gMin} onChangeText={setGMin} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Input {...gradeChain(1)} label="Max %" value={gMax} onChangeText={setGMax} keyboardType="decimal-pad" />
            </View>
          </View>
          <Input {...gradeChain(2)} label="Grade letter" value={gLetter} onChangeText={setGLetter} autoCapitalize="characters" />
          <Input {...gradeChain(3)} label="Remark" value={gRemark} onChangeText={setGRemark} placeholder="e.g. Excellent" autoCapitalize="words" />
          <Button title="Add grade band" icon="plus" onPress={addGradeBand} />
        </Section>
      </ScrollView>

      <Modal visible={termsOpen} transparent animationType="fade" onRequestClose={declineTerms}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={[text.h3, { color: colors.text }]}>Payment Terms of Use</Text>
            <Text style={[text.small, { color: colors.textMuted, marginTop: 2, marginBottom: spacing.md }]}>Please read and accept before adding a payout bank account.</Text>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator>
              <Text style={[text.body, { color: colors.text }]}>{terms ? terms.text : ''}</Text>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <Button title="Decline" variant="soft" onPress={declineTerms} style={{ flex: 1 }} />
              <Button title="Accept" onPress={acceptTerms} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  card: { marginBottom: spacing.lg },
  slot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  slotBox: { width: 84, height: 84, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  payBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl },
  grade: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
