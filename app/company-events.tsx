import { useEffect } from 'react';
import { ActivityIndicator,StyleSheet,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '../lib/theme';
export default function CompanyEvents(){useEffect(()=>{router.replace('/company-mission')},[]);return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={colors.company}/><Text style={s.text}>Opening assignment creator…</Text></View></SafeAreaView>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},center:{flex:1,alignItems:'center',justifyContent:'center',gap:10},text:{fontSize:12,color:colors.muted}});
