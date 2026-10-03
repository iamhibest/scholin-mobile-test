import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, DateField, Input, Notice, OptionField, Screen, SearchBar, SwitchRow } from '../components';
import { colors, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { classLabel } from '../lib/school';
import { createEvent, EVENT_STATUSES, EVENT_TYPES, fetchCreateLookups } from '../lib/events';

export default function EventFormScreen({ navigation }: any) {
  const { ctx } = useStaff();
  const [lookups, setLookups] = useState<{ classes: any[]; students: any[]; terms: any[] }>({ classes: [], students: [], terms: [] });
  const [name, setName] = useState('');
  const [type, setType] = useState('school_fees');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [term, setTerm] = useState('');
  const [mandatory, setMandatory] = useState(true);
  const [assignment, setAssignment] = useState<'all_students' | 'classes' | 'students'>('all_students');
  const [status, setStatus] = useState('active');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ctx) {
      fetchCreateLookups(ctx.schoolId).then(setLookups).catch(() => {});
    }
  }, [ctx]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? lookups.students.filter(s => String(s.full_name).toLowerCase().includes(q) || String(s.admission_no || '').toLowerCase().includes(q)) : lookups.students;
  }, [lookups.students, query]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string, on: boolean) => {
    set(on ? Array.from(new Set(list.concat(id))) : list.filter(x => x !== id));
  };

  const submit = async () => {
    setError('');
    const value = parseFloat(amount);
    if (!name.trim()) {
      setError('Please enter an event name.');
      return;
    }
    if (isNaN(value) || value < 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (assignment === 'classes' && classIds.length === 0) {
      setError('Please select at least one class.');
      return;
    }
    if (assignment === 'students' && studentIds.length === 0) {
      setError('Please select at least one student.');
      return;
    }
    if (!ctx) {
      return;
    }
    setBusy(true);
    try {
      const ev = await createEvent(ctx.schoolId, ctx.userId, {
        name: name.trim(),
        eventType: type,
        description: desc.trim(),
        amount: value,
        dueDate: due,
        termId: term,
        mandatory,
        assignment,
        status,
        classIds,
        studentIds,
      });
      navigation.replace('EventDetail', { eventId: ev.id });
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Notice message={error} tone="error" />
        <Input label="Event name" value={name} onChangeText={setName} placeholder="For example School Fees for First Term" icon="wallet" />
        <OptionField label="Event type" value={type} options={EVENT_TYPES} onChange={setType} />
        <Input label="Description (optional)" value={desc} onChangeText={setDesc} multiline maxLength={500} placeholder="Any extra detail for staff and parents" />
        <Input label="Amount per student" value={amount} onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="For example 60000" />
        <DateField label="Due date (optional)" value={due} onChange={setDue} allowFuture placeholder="Select date" />
        <OptionField label="Term (optional)" value={term} options={[{ value: '', label: 'Not tied to a specific term' }].concat(lookups.terms.map(t => ({ value: t.id, label: t.name })))} onChange={setTerm} hint="Used for report card release." />
        <Card style={{ marginBottom: spacing.lg }}>
          <SwitchRow label="Mandatory fee" desc="Students must pay this fee." value={mandatory} onChange={setMandatory} />
        </Card>
        <OptionField
          label="Assign to"
          value={assignment}
          options={[
            { value: 'all_students', label: 'All students' },
            { value: 'classes', label: 'Specific classes' },
            { value: 'students', label: 'Specific students' },
          ]}
          onChange={v => setAssignment(v as any)}
        />
        <OptionField label="Status" value={status} options={EVENT_STATUSES} onChange={setStatus} />

        {assignment === 'classes' ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <SwitchRow
              label="Select all classes"
              value={lookups.classes.length > 0 && classIds.length === lookups.classes.length}
              onChange={on => setClassIds(on ? lookups.classes.map(c => c.id) : [])}
            />
            {lookups.classes.map(c => (
              <SwitchRow key={c.id} label={classLabel(c)} value={classIds.includes(c.id)} onChange={on => toggle(classIds, setClassIds, c.id, on)} />
            ))}
            {lookups.classes.length === 0 ? <Text style={[text.small, { color: colors.textMuted }]}>No classes set up yet.</Text> : null}
            <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>{classIds.length + (classIds.length === 1 ? ' class selected' : ' classes selected')}</Text>
          </Card>
        ) : null}

        {assignment === 'students' ? (
          <View style={{ marginBottom: spacing.lg }}>
            <SearchBar value={query} onChange={setQuery} placeholder="Search students" />
            <Card style={{ marginTop: spacing.md }}>
              {shown.slice(0, 80).map(s => (
                <SwitchRow key={s.id} label={s.full_name} desc={s.admission_no || undefined} value={studentIds.includes(s.id)} onChange={on => toggle(studentIds, setStudentIds, s.id, on)} />
              ))}
              {shown.length === 0 ? <Text style={[text.small, { color: colors.textMuted }]}>No students found.</Text> : null}
              {shown.length > 80 ? <Text style={[text.small, { color: colors.textMuted }]}>Showing the first 80. Search to narrow the list.</Text> : null}
              <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>{studentIds.length + ' selected'}</Text>
            </Card>
          </View>
        ) : null}

        <Button title="Create event" loading={busy} onPress={submit} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
});
