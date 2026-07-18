import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Card, Input, Btn } from '../../components/UI';
import { getCircleTemplates, createCircle } from '../../services/careCircleService';

export default function CreateCareCircleScreen({ navigation }) {
  const { colors } = useTheme();
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try { setTemplates(await getCircleTemplates()); }
      catch (e) { setTemplates([]); }
      finally { setLoadingTemplates(false); }
    })();
  }, []);

  function selectTemplate(tpl) {
    setSelectedTemplate(tpl);
    setName(tpl.name); // pre-fill, still editable — e.g. "Parents Care" → "Mom & Dad's Care"
  }

  async function handleCreate() {
    if (!name.trim()) { Alert.alert('Name required', 'Please give this Care Circle a name.'); return; }
    setCreating(true);
    try {
      const circle = await createCircle({
        name: name.trim(),
        templateId: selectedTemplate?.id,
        type: selectedTemplate?.type,
        icon: selectedTemplate?.icon,
      });
      navigation.replace('CareCircleSettings', { circleId: circle.id, justCreated: true });
    } catch (e) {
      Alert.alert('Couldn\'t create Care Circle', e.message || 'Please try again.');
    } finally { setCreating(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>← Care Circles</Text>
        </TouchableOpacity>

        <Text style={{ fontWeight: '800', fontSize: 22, color: colors.ink, marginBottom: 4 }}>New Care Circle</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>Pick a starting point, or build a custom one</Text>

        {loadingTemplates ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {templates.map(tpl => {
              const sel = selectedTemplate?.id === tpl.id;
              return (
                <TouchableOpacity key={tpl.id} onPress={() => selectTemplate(tpl)} activeOpacity={0.7}
                  style={{ width: '47%', backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: sel ? 2 : 1, borderColor: sel ? colors.primary : colors.border, alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, marginBottom: 6 }}>{tpl.icon}</Text>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: colors.ink, textAlign: 'center' }}>{tpl.name}</Text>
                  <Text style={{ fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 3 }}>{tpl.description}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => selectTemplate({ id: null, type: 'custom', icon: '⭐', name: '' })} activeOpacity={0.7}
              style={{ width: '47%', backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: selectedTemplate?.id === null && selectedTemplate ? 2 : 1, borderColor: selectedTemplate?.id === null && selectedTemplate ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30, marginBottom: 6 }}>⭐</Text>
              <Text style={{ fontWeight: '700', fontSize: 13, color: colors.ink }}>Custom</Text>
              <Text style={{ fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 3 }}>Start from scratch</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedTemplate !== null && (
          <Card>
            <Input label="Circle name" value={name} onChangeText={setName} placeholder="e.g. Mom & Dad's Care" />
            <Btn full loading={creating} onPress={handleCreate} disabled={!name.trim()}>Create Care Circle</Btn>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
