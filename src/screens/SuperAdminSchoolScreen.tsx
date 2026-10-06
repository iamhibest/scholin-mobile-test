import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Button, Card, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { getSchoolAccessStatus } from '../lib/dashboard';
import {
  deleteSchoolRow, fetchReferrerName, fetchSchoolCommissions, fetchSchoolFull, fetchSchoolOwner, fetchSchoolPayments, naira, updateSchoolRow,
} from '../lib/superAdmin';

type Msg = { message: string; tone: 'error' | 'success' };
const none: Msg = { message: '', tone: 'success' };
const DAY = 24 * 60 * 60 * 1000;

export default function SuperAdminSchoolScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const schoolId: string = route.params.schoolId;
  const [school, setSchool] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [referrer, setReferrer] = useState('');
  const [earned, setEarned] = useState<{ total: number; pending: number; count: number }>({ total: 0, pending: 0, count: 0 });
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsError, setPaymentsError] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [busy, setBusy] = useState('');
  const [infoMsg, setInfoMsg] = useState<Msg>(none);
  const [subMsg, setSubMsg] = useState<Msg>(none);
  const [trialMsg, setTrialMsg] = useState<Msg>(none);
  const [dangerMsg, setDangerMsg] = useState<Msg>(none);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await fetchSchoolFull(schoolId);
      setSchool(s);
      setName(s.name || '');
      setAddress(s.address || '');
      setPhone(s.phone || '');
      setEmail(s.email || '');
      setOwner(await fetchSchoolOwner(schoolId));
      setReferrer(s.referred_by_code ? (await fetchReferrerName(s.referred_by_code)) || s.referred_by_code : '');
      const com = await fetchSchoolCommissions(schoolId);
      setEarned({
        count: com.length,
        total: com.reduce((t, c) => t + Number(c.commission_amount), 0),
        pending: com.filter(c => c.status === 'pending').reduce((t, c) => t + Number(c.commission_amount), 0),
      });
      try {
        setPayments(await fetchSchoolPayments(schoolId));
        setPaymentsError('');
      } catch (e: any) {
        setPaymentsError(e.message);
      }
    } catch (e: any) {
      setLoadError(e.message);
    }
  }, [schoolId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const run = async (key: string, setMsg: (m: Msg) => void, work: () => Promise<string>) => {
    setMsg(none);
    setBusy(key);
    try {
      setMsg({ message: await work(), tone: 'success' });
    } catch (e: any) {
      setMsg({ message: e && e.message ? e.message : 'Something went wrong.', tone: 'error' });
    }
    setBusy('');
  };

  const saveInfo = () => {
    if (!name.trim()) {
      setInfoMsg({ message: 'The school name cannot be empty.', tone: 'error' });
      return;
    }
    run('info', setInfoMsg, async () => {
      await updateSchoolRow(schoolId, { name: name.trim(), address: address.trim() || null, phone: phone.trim() || null, email: email.trim() || null });
      await load();
      return 'School information updated.';
    });
  };

  const extendTrial = () => {
    const n = parseInt(days, 10);
    if (!n || n <= 0) {
      setTrialMsg({ message: 'Enter a valid number of days.', tone: 'error' });
      return;
    }
    run('trial', setTrialMsg, async () => {
      const current = school.trial_ends_at ? new Date(school.trial_ends_at) : null;
      const base = current && current.getTime() > Date.now() ? current : new Date();
      await updateSchoolRow(schoolId, { trial_ends_at: new Date(base.getTime() + n * DAY).toISOString() });
      setDays('');
      await load();
      return 'Trial extended.';
    });
  };

  const cancelSub = () => {
    confirmAction('Cancel subscription', 'The school loses paid access and sees your reason.', 'Cancel subscription', () => {
      run('cancel', setSubMsg, async () => {
        await updateSchoolRow(schoolId, { subscription_cancelled_at: new Date().toISOString(), subscription_cancelled_reason: reason.trim() || null });
        setReason('');
        await load();
        return 'Subscription cancelled.';
      });
    });
  };

  const reinstate = () => {
    confirmAction('Reinstate access', 'This clears the cancellation but does not add any new paid time.', 'Reinstate', () => {
      run('reinstate', setSubMsg, async () => {
        await updateSchoolRow(schoolId, { subscription_cancelled_at: null, subscription_cancelled_reason: null });
        await load();
        return 'Access reinstated.';
      });
    }, false);
  };

  const remove = () => {
    if (!school || confirmName.trim() !== school.name) {
      setDangerMsg({ message: 'Type the school name exactly to confirm.', tone: 'error' });
      return;
    }
    confirmAction('Delete school', 'This permanently deletes the school and all of its data. It cannot be undone.', 'Delete forever', () => {
      run('delete', setDangerMsg, async () => {
        await deleteSchoolRow(schoolId);
        navigation.goBack();
        return 'School deleted.';
      });
    });
  };

  if (loadError) {
    return (
      <Screen>
        <Notice message={loadError} tone="error" />
      </Screen>
    );
  }
  if (!school) {
    return (
      <Screen>
        <Skeleton height={200} radius={24} />
      </Screen>
    );
  }

  const status: any = getSchoolAccessStatus(school);
  const daysLeft = school.trial_ends_at ? Math.max(0, Math.ceil((new Date(school.trial_ends_at).getTime() - Date.now()) / DAY)) : 0;
  let statusTitle = 'Access expired';
  let statusBody = 'The trial and any subscription have both ended. Gated features are locked for this school.';
  let statusColor: string = colors.danger;
  if (status.reason === 'cancelled') {
    statusTitle = 'Subscription cancelled';
    statusBody = (school.subscription_cancelled_reason ? school.subscription_cancelled_reason + '. ' : '') + 'Cancelled ' + new Date(school.subscription_cancelled_at).toLocaleDateString() + '.';
  } else if (status.reason === 'subscribed') {
    statusTitle = 'Active subscription';
    statusColor = colors.success;
    statusBody =
      'Paid through ' + new Date(school.subscription_ends_at).toLocaleDateString() + '.' +
      (school.subscription_amount ? ' Last payment ' + naira(school.subscription_amount) + ' for ' + (school.subscription_months || '?') + ' month(s).' : '') +
      (earned.count ? ' Referral commission from this school: ' + naira(earned.total) + ' earned, ' + naira(earned.pending) + ' pending payout.' : '');
  } else if (status.reason === 'trial') {
    statusTitle = 'Free trial';
    statusColor = colors.accentDark;
    statusBody = daysLeft + ' day(s) remaining. Ends ' + new Date(school.trial_ends_at).toLocaleDateString() + '.';
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[text.h2, { color: colors.text, marginBottom: spacing.lg }]}>{school.name}</Text>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>School information</Text>
          <Notice message={infoMsg.message} tone={infoMsg.tone} />
          <Input label="School name" value={name} onChangeText={setName} />
          <Input label="Address" value={address} onChangeText={setAddress} />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Button title="Save changes" loading={busy === 'info'} onPress={saveInfo} />
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Owner and referral</Text>
          <Text style={[text.body, { color: colors.text }]}>
            {owner && owner.profiles ? 'Owner: ' + owner.profiles.full_name + ' (' + owner.profiles.email + ')' : 'No owner found for this school.'}
          </Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {school.referred_by_code ? 'Referred by ' + referrer + ' (code ' + school.referred_by_code + ').' : 'No referral code was used at registration.'}
          </Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
            To reset the owner's email or password, ask them to use Forgot password on the sign in screen.
          </Text>
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Subscription</Text>
          <Notice message={subMsg.message} tone={subMsg.tone} />
          <Text style={[text.bodyStrong, { color: statusColor }]}>{statusTitle}</Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }]}>{statusBody}</Text>
          {status.reason === 'cancelled' ? (
            <Button title="Reinstate access" variant="outline" loading={busy === 'reinstate'} onPress={reinstate} />
          ) : status.reason === 'subscribed' ? (
            <View>
              <Input label="Reason for cancelling (the school sees this)" value={reason} onChangeText={setReason} />
              <Button title="Cancel subscription" variant="danger" loading={busy === 'cancel'} onPress={cancelSub} />
            </View>
          ) : null}
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Payment history</Text>
          {paymentsError ? <Notice message={paymentsError} tone="error" /> : null}
          {payments.length === 0 && !paymentsError ? <Text style={[text.small, { color: colors.textMuted }]}>No subscription payment attempts yet.</Text> : null}
          {payments.map(p => (
            <View key={p.id} style={styles.pay}>
              <Text style={[text.bodyStrong, { color: colors.text }]}>{p.months + ' month(s), ' + naira(p.amount_charged)}</Text>
              <Text style={[text.small, { color: p.payment_status === 'paid' ? colors.success : p.payment_status === 'failed' ? colors.danger : colors.accentDark, textTransform: 'capitalize' }]}>
                {p.payment_status}
              </Text>
              <Text style={[text.caption, { color: colors.textMuted }]}>
                {'Started ' + new Date(p.created_at).toLocaleString() + (p.paid_at ? '. Paid ' + new Date(p.paid_at).toLocaleString() : '')}
              </Text>
            </View>
          ))}
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>Trial access</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>
            For support use only. Extends the free trial from whichever is later, today or the current end date. It does not bypass payment.
          </Text>
          <Notice message={trialMsg.message} tone={trialMsg.tone} />
          <Input label="Extend trial by (days)" value={days} onChangeText={setDays} keyboardType="number-pad" placeholder="e.g. 7" />
          <Button title="Extend trial" variant="outline" loading={busy === 'trial'} onPress={extendTrial} />
        </Card>

        <Card style={[styles.block, { borderColor: colors.danger, borderWidth: 1 }]}>
          <Text style={[text.h3, { color: colors.danger }]}>Danger zone</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>
            Permanently deletes this school and all of its data: students, staff, results, everything. This cannot be undone.
          </Text>
          <Notice message={dangerMsg.message} tone={dangerMsg.tone} />
          <Input label="Type the school name to confirm" value={confirmName} onChangeText={setConfirmName} />
          <Button title="Delete this school permanently" variant="danger" loading={busy === 'delete'} onPress={remove} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  block: { marginBottom: spacing.xl },
  pay: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
