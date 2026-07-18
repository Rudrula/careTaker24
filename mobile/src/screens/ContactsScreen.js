import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Phone, Edit3, Trash2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { Card, Btn, Input, ChipRow, Sect } from '../components/UI';

const RELATIONS = ['Son', 'Daughter', 'Spouse', 'Parent', 'Sibling', 'Family Doctor', 'Caregiver', 'Neighbor', 'Ambulance', 'Other'];

export default function ContactsScreen() {
  const { colors } = useTheme();
  const { data, addContact, updateContact, deleteContact } = useData();
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', relation: '' });

  function openAdd() { setEditId(null); setForm({ name: '', phone: '', relation: '' }); setFormOpen(true); }
  function openEdit(c) { setEditId(c.id); setForm({ name: c.name, phone: c.phone, relation: c.relation }); setFormOpen(true); }
  function save() {
    if (!form.name.trim() || !form.phone.trim()) return;
    if (editId) updateContact(editId, form); else addContact(form);
    setFormOpen(false); setEditId(null);
  }
  function confirmDelete(c) {
    Alert.alert('Delete contact', `Remove ${c.name} from your emergency contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteContact(c.id) },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Sect title="Emergency contacts" action={<TouchableOpacity onPress={openAdd}><Plus size={22} color={colors.primary} /></TouchableOpacity>}>
          {formOpen && (
            <Card>
              <Input label="Name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="e.g. Rohan Sharma" />
              <Input label="Phone number" value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} placeholder="+1 987 654 3210" keyboardType="phone-pad" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>Relation</Text>
              <ChipRow options={RELATIONS} selected={form.relation} onSelect={r => setForm(f => ({ ...f, relation: r }))} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Btn full variant="outline" onPress={() => setFormOpen(false)}>Cancel</Btn>
                <Btn full onPress={save} disabled={!form.name.trim() || !form.phone.trim()}>{editId ? 'Save changes' : 'Add contact'}</Btn>
              </View>
            </Card>
          )}

          {data.contacts.map(c => (
            <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', fontSize: 14, color: colors.ink }}>{c.name}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>{c.relation}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.phone}`)} style={{ backgroundColor: colors.primarySoft, borderRadius: 99, padding: 9 }}>
                  <Phone size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEdit(c)} style={{ backgroundColor: colors.cardAlt, borderRadius: 99, padding: 9 }}>
                  <Edit3 size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(c)} style={{ backgroundColor: 'rgba(255,77,106,.10)', borderRadius: 99, padding: 9 }}>
                  <Trash2 size={16} color={colors.rose} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </Sect>

        <Sect title="Family members">
          {data.members.map(m => (
            <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 99, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{m.role === 'senior' ? '👴' : '🏠'}</Text>
              </View>
              <View>
                <Text style={{ fontWeight: '600', fontSize: 14, color: colors.ink }}>{m.name}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>{m.role} · {m.country}</Text>
              </View>
            </Card>
          ))}
        </Sect>
      </ScrollView>
    </SafeAreaView>
  );
}
