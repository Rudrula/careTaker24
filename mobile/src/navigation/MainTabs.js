import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Pill, Bell, Phone, User } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

import HomeScreen from '../screens/HomeScreen';
import MedicinesScreen from '../screens/MedicinesScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ContactsScreen from '../screens/ContactsScreen';
import AccountHubScreen from '../screens/account/AccountHubScreen';
import ProfileScreen from '../screens/account/ProfileScreen';
import ReportsScreen from '../screens/account/ReportsScreen';
import PlansScreen from '../screens/account/PlansScreen';
import CareCirclesScreen from '../screens/careCircles/CareCirclesScreen';
import CreateCareCircleScreen from '../screens/careCircles/CreateCareCircleScreen';
import CareCircleSettingsScreen from '../screens/careCircles/CareCircleSettingsScreen';
import CareCircleMembersScreen from '../screens/careCircles/CareCircleMembersScreen';
import InviteToCircleScreen from '../screens/careCircles/InviteToCircleScreen';
import CareTimelineScreen from '../screens/careCircles/CareTimelineScreen';
import EscalationSettingsScreen from '../screens/careCircles/EscalationSettingsScreen';
import AcceptInviteScreen from '../screens/careCircles/AcceptInviteScreen';

const Tab = createBottomTabNavigator();
const AccountStack = createNativeStackNavigator();

function AccountStackNavigator() {
  return (
    <AccountStack.Navigator screenOptions={{ headerShown: false }}>
      <AccountStack.Screen name="AccountHub" component={AccountHubScreen} />
      <AccountStack.Screen name="Profile" component={ProfileScreen} />
      <AccountStack.Screen name="Reports" component={ReportsScreen} />
      <AccountStack.Screen name="Plans" component={PlansScreen} />
      <AccountStack.Screen name="CareCircles" component={CareCirclesScreen} />
      <AccountStack.Screen name="CreateCareCircle" component={CreateCareCircleScreen} />
      <AccountStack.Screen name="CareCircleSettings" component={CareCircleSettingsScreen} />
      <AccountStack.Screen name="CareCircleMembers" component={CareCircleMembersScreen} />
      <AccountStack.Screen name="InviteToCircle" component={InviteToCircleScreen} />
      <AccountStack.Screen name="CareTimeline" component={CareTimelineScreen} />
      <AccountStack.Screen name="EscalationSettings" component={EscalationSettingsScreen} />
      <AccountStack.Screen name="AcceptInvite" component={AcceptInviteScreen} />
    </AccountStack.Navigator>
  );
}

export default function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.grey,
        tabBarStyle: { backgroundColor: colors.card, borderTopWidth: 2, borderTopColor: colors.amber, height: 68, paddingBottom: 10, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarIcon: ({ color, size }) => {
          const icons = { Home, Medicines: Pill, Reminders: Bell, Contacts: Phone, Account: User };
          const Icon = icons[route.name];
          return <Icon color={color} size={25} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Medicines" component={MedicinesScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Account" component={AccountStackNavigator} />
    </Tab.Navigator>
  );
}
