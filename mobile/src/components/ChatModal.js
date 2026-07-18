import React, { useState, useRef } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { X, Send, Sparkles } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { chatWithAI } from '../services/aiService';

export default function ChatModal({ visible, onClose }) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hi! I'm here to help with medicines, care questions, or anything about Caretaker24. What's on your mind?" }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next); setInput(''); setLoading(true);
    try {
      const reply = await chatWithAI(next);
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 50 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color={colors.primary} />
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>Caretaker AI</Text>
          </View>
          <TouchableOpacity onPress={onClose}><X size={22} color={colors.muted} /></TouchableOpacity>
        </View>
        <ScrollView ref={scrollRef} style={{ flex: 1, padding: 16 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((m, i) => (
            <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%', marginBottom: 10 }}>
              <View style={{ backgroundColor: m.role === 'user' ? colors.btnFill : colors.cardAlt, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: m.role === 'user' ? '#fff' : colors.ink, fontSize: 14 }}>{m.content}</Text>
              </View>
            </View>
          ))}
          {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TextInput value={input} onChangeText={setInput} onSubmitEditing={send} placeholder="Ask anything about care..." placeholderTextColor={colors.muted}
            style={{ flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: colors.ink, backgroundColor: colors.cardAlt }} />
          <TouchableOpacity onPress={send} style={{ backgroundColor: colors.btnFill, borderRadius: 99, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
