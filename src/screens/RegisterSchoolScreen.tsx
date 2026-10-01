import React, { useState } from 'react';
import { AuthHeader, Button, Input, Notice, Screen } from '../components';
import { colors } from '../theme';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { saveLastDestination } from '../lib/storage';

function defaultSessionName() {
  const year = new Date().getFullYear();
  return year + '/' + (year + 1);
}

export default function RegisterSchoolScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [motto, setMotto] = useState('');
  const [referral, setReferral] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!name.trim()) {
      setError('Please enter your school name.');
      return;
    }
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setError('Your session has expired. Please sign in again.');
        return;
      }
      let referredByCode: string | null = null;
      const code = referral.trim().toUpperCase();
      if (code) {
        const { data: referrerId } = await supabase.rpc('get_referrer_id_by_code', { code });
        if (referrerId) {
          referredByCode = code;
        }
      }
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .insert({
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          motto: motto.trim(),
          owner_id: user.id,
          referred_by_code: referredByCode,
        })
        .select()
        .single();
      if (schoolError || !school) {
        setError(schoolError?.message || 'Could not register school.');
        return;
      }
      const { error: memberError } = await supabase.from('school_members').insert({
        school_id: school.id,
        profile_id: user.id,
        role: 'owner',
        can_edit_results: true,
        can_generate_report_cards: true,
        can_add_comments: true,
        is_active: true,
      });
      if (memberError) {
        setError(memberError.message || 'School created, but could not finish setup. Contact support.');
        return;
      }
      await supabase.from('sessions').insert({ school_id: school.id, name: defaultSessionName(), is_current: true });
      await saveLastDestination('Home');
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e: any) {
      logger.error('Register school failed: ' + e.message);
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll background={colors.surface}>
      <AuthHeader title="Register your school" subtitle="You can edit all of this later from Settings. Only the school name is required to continue." />
      <Notice message={error} />
      <Input label="School name *" icon="school" value={name} onChangeText={setName} placeholder="e.g. Radiance Bright Stars Academy" />
      <Input label="Address" icon="pin" value={address} onChangeText={setAddress} placeholder="e.g. 12 Knowledge Avenue, Mowe, Ogun State" />
      <Input label="School phone" icon="phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="e.g. 08123456789" />
      <Input label="School email" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="e.g. info@school.edu.ng" />
      <Input label="Motto" value={motto} onChangeText={setMotto} placeholder="e.g. Raising Stars, Building Futures" />
      <Input label="Referral code (optional)" value={referral} onChangeText={v => setReferral(v.toUpperCase())} autoCapitalize="characters" placeholder="e.g. A1B2C3" />
      <Button title="Register school and continue" onPress={submit} loading={loading} />
    </Screen>
  );
}
