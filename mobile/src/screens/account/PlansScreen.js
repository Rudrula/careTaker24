import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crown, Check } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { Card } from '../../components/UI';
import { payWithRazorpay, payWithStripe } from '../../services/paymentService';

const PLANS = [
  { id: 'free', name: 'Free', price: '₹0', usd: '$0', features: ['1 household', '2 members', '3 reminders/day', 'AI chat only'] },
  { id: 'basic', name: 'Basic', price: '₹399', usd: '$5', amountPaise: 39900, amountCents: 500, features: ['1 household', '5 members', 'Unlimited reminders', 'AI chat + digest'] },
  { id: 'premium', name: 'Premium', price: '₹799', usd: '$10', amountPaise: 79900, amountCents: 1000, features: ['3 households', '15 members', 'Full AI suite', 'Priority SOS push', 'Caregiver booking'] },
];

export default function PlansScreen({ navigation }) {
  const { colors } = useTheme();
  const { data, upd } = useData();
  const [region, setRegion] = useState('india');
  const [loading, setLoading] = useState(null);

  async function subscribe(plan) {
    setLoading(plan.id);
    try {
      let result;
      if (region === 'india') {
        result = await payWithRazorpay({ amountPaise: plan.amountPaise, name: 'Caretaker24', description: `${plan.name} Plan`, userEmail: data.currentUser?.email, userPhone: '' });
      } else {
        result = await payWithStripe({ amountCents: plan.amountCents, productName: `Caretaker24 ${plan.name} Plan`, successUrl: 'caretaker24://payment-success', cancelUrl: 'caretaker24://payment-cancel' });
      }
      if (result.success) {
        upd(p => ({ ...p, family: { ...p.family, tier: plan.id } }));
        Alert.alert('Success', `Welcome to the ${plan.name} plan!`);
      } else if (result.error) {
        Alert.alert('Payment failed', result.error);
      }
    } catch (e) {
      Alert.alert('Payment failed', 'Something went wrong. Please try again.');
    } finally { setLoading(null); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>← Account</Text>
        </TouchableOpacity>

        <View style={{ backgroundColor: '#1A2856', borderRadius: 20, padding: 22, marginBottom: 20 }}>
          <Crown size={28} color={colors.amber} style={{ marginBottom: 8 }} />
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>Caretaker24 Plans</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>7-day free trial · Cancel anytime</Text>
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: colors.greyLt, borderRadius: 10, padding: 3, marginBottom: 16 }}>
          {[['india', '🇮🇳 Pay in ₹'], ['global', '🌍 Pay in $']].map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => setRegion(k)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: region === k ? colors.card : 'transparent', alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', fontSize: 12, color: region === k ? colors.primary : colors.muted }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {PLANS.map(plan => {
          const isCurrent = data.family?.tier === plan.id;
          return (
            <Card key={plan.id} style={{ borderWidth: 2, borderColor: isCurrent ? colors.primary : colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontWeight: '800', fontSize: 18, color: colors.ink }}>{plan.name}</Text>
                <Text style={{ fontWeight: '900', fontSize: 22, color: colors.primary }}>{region === 'india' ? plan.price : plan.usd}<Text style={{ fontSize: 12, fontWeight: '400', color: colors.muted }}>/mo</Text></Text>
              </View>
              {plan.features.map(f => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Check size={14} color={colors.primary} />
                  <Text style={{ fontSize: 13, color: colors.ink }}>{f}</Text>
                </View>
              ))}
              {isCurrent ? (
                <View style={{ marginTop: 12, padding: 10, backgroundColor: colors.primarySoft, borderRadius: 10, alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>✓ Your current plan</Text>
                </View>
              ) : plan.id !== 'free' && (
                <TouchableOpacity onPress={() => subscribe(plan)} disabled={loading === plan.id}
                  style={{ marginTop: 12, padding: 13, borderRadius: 12, backgroundColor: region === 'india' ? '#072654' : '#635BFF', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                    {loading === plan.id ? 'Processing…' : region === 'india' ? `Pay ${plan.price}/month · Razorpay` : `Pay ${plan.usd}/month · Stripe`}
                  </Text>
                </TouchableOpacity>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
