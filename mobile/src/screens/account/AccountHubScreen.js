import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, BarChart2, Crown, ChevronRight, LogOut, Moon, Sun, Users, ListChecks } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Card, Sect, StatusPill, Toggle } from '../../components/UI';

export default function AccountHubScreen({ navigation }) {
  const { colors, darkMode, toggleDarkMode } = useTheme();
  const { data } = useData();
  const { signOut } = useAuth();
  const tier = data.family?.tier || 'free';
  const initials = (data.currentUser?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const bloodType = data.currentUser?.bloodType || 'O+';

  const items = [
    { key: 'Profile', icon: User, title: 'Profile', sub: 'Personal details, timezone, household' },
    { key: 'CareCircles', icon: Users, title: 'Care Circles', sub: `Currently: ${data.family?.name || data.family?.seniorName || 'My Care'}` },
    { key: 'CareTimeline', icon: ListChecks, title: 'Care Timeline', sub: "Today's Family Summary — across every circle" },
    { key: 'Reports', icon: BarChart2, title: 'Reports', sub: 'Adherence history & health summaries' },
    { key: 'Plans', icon: Crown, title: 'Subscription & Plans', sub: `Current plan: ${tier[0].toUpperCase() + tier.slice(1)}` },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Identity hero */}
        <View style={{ backgroundColor: '#1A2856', borderRadius: 20, padding: 24, marginBottom: 16, alignItems: 'center' }}>
          <View style={{ width: 88, height: 88, borderRadius: 99, backgroundColor: colors.btnFill, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>{initials}</Text>
          </View>
          <Text style={{ fontWeight: '800', fontSize: 22, color: '#fff' }}>{data.currentUser?.name || 'User'}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>{data.currentUser?.email}</Text>

          <View style={{ flexDirection: 'row', width: '100%', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
            {[['Blood Type', bloodType || '—'], ['Allergies', data.currentUser?.allergies ? 'Listed' : 'None'], ['Conditions', data.currentUser?.conditions ? 'Listed' : 'None']].map(([label, val], i) => (
              <View key={label} style={{ flex: 1, padding: 12, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: 'rgba(255,255,255,0.15)' }}>
                <Text style={{ fontWeight: '800', fontSize: 16, color: '#fff' }}>{val}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{label}</Text>
              </View>
            ))}
          </View>
          <StatusPill label={`${tier[0].toUpperCase() + tier.slice(1)} Plan`} bg="rgba(255,255,255,0.15)" fg="#fff" style={{ marginTop: 12 }} />
        </View>

        <Sect title="Account">
          {items.map(it => (
            <TouchableOpacity key={it.key} onPress={() => navigation.navigate(it.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, marginBottom: 10 }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <it.icon size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink }}>{it.title}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>{it.sub}</Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </Sect>

        <Sect title="Appearance">
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {darkMode ? <Moon size={18} color={colors.primary} /> : <Sun size={18} color={colors.amber} />}
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Dark mode</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>{darkMode ? 'Currently on' : 'Currently off'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={toggleDarkMode} style={{ width: 46, height: 26, borderRadius: 99, backgroundColor: darkMode ? colors.primary : colors.border, padding: 3, justifyContent: 'center' }}>
              <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: '#fff', transform: [{ translateX: darkMode ? 20 : 0 }] }} />
            </TouchableOpacity>
          </Card>
        </Sect>

        <Sect title="Household">
          <Card>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>Share this invite code with family members:</Text>
            <View style={{ backgroundColor: colors.cardAlt, borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', fontSize: 22, letterSpacing: 4, color: colors.ink }}>{data.family?.inviteCode || '——————'}</Text>
            </View>
          </Card>
        </Sect>

        <TouchableOpacity onPress={signOut} style={{ padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,77,106,.08)', borderWidth: 1.5, borderColor: 'rgba(255,77,106,.3)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <LogOut size={18} color={colors.rose} />
          <Text style={{ color: colors.rose, fontWeight: '700', fontSize: 15 }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
