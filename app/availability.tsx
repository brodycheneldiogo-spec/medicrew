import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radii } from '../lib/theme';
import { supabase } from '../lib/supabase';

const transportOptions = [
  ['commercial-flight', 'Flight'],
  ['ground-transport', 'Ground'],
  ['air-ambulance', 'Air ambulance'],
  ['train', 'Train'],
] as const;

function dayKey(d: Date) { return d.toISOString().slice(0, 10); }
function dayLabel(d: Date) { return d.toLocaleDateString([], { weekday: 'short' }).toUpperCase(); }
function dateLabel(d: Date) { return d.toLocaleDateString([], { day: '2-digit', month: 'short' }); }

export default function Availability() {
  const [available, setAvailable] = useState(false);
  const [selected, setSelected] = useState(dayKey(new Date()));
  const [location, setLocation] = useState('');
  const [international, setInternational] = useState(false);
  const [transportTypes, setTransportTypes] = useState<string[]>(['commercial-flight', 'ground-transport', 'air-ambulance']);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  }), []);

  useEffect(() => {
    (async () => {
      if (!supabase) { setLoading(false); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Session expired');
        const [{ data: p, error: pe }, { data: a, error: ae }] = await Promise.all([
          supabase.from('professionals').select('available_now,international_available').eq('id', user.id).single(),
          supabase.from('professional_availability').select('*').eq('professional_id', user.id).gte('ends_at', new Date().toISOString()).order('starts_at').limit(1).maybeSingle(),
        ]);
        if (pe) throw pe;
        if (ae) throw ae;
        if (p) { setAvailable(!!p.available_now); setInternational(!!p.international_available); }
        if (a) {
          setLocation(a.start_location || '');
          setSelected(dayKey(new Date(a.starts_at)));
          if (Array.isArray(a.transport_types) && a.transport_types.length) setTransportTypes(a.transport_types);
          setInternational(!!a.international);
        }
      } catch (e: any) {
        Alert.alert('Availability unavailable', e?.message || 'Unable to load availability');
      } finally { setLoading(false); }
    })();
  }, []);

  const toggleTransport = (value: string) => setTransportTypes(current => current.includes(value)
    ? current.filter(x => x !== value)
    : [...current, value]);

  const save = async () => {
    if (!supabase) return;
    if (!location.trim()) { Alert.alert('Starting location required', 'Add the city or area where you can start a mission.'); return; }
    if (!transportTypes.length) { Alert.alert('Transport type required', 'Select at least one transport type.'); return; }
    const selectedDate = new Date(`${selected}T10:00:00`);
    const endDate = new Date(`${selected}T18:00:00`);
    if (selectedDate <= new Date()) { Alert.alert('Date unavailable', 'Choose a future availability date.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired');
      const { error: e1 } = await supabase.rpc('replace_my_availability', {
        p_starts_at: selectedDate.toISOString(),
        p_ends_at: endDate.toISOString(),
        p_start_location: location.trim(),
        p_max_notice_hours: 3,
        p_international: international,
        p_transport_types: transportTypes,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('professionals').update({ available_now: available, international_available: international }).eq('id', user.id);
      if (e2) throw e2;
      Alert.alert('Saved', 'Your availability is now stored.');
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unable to save availability');
    } finally { setSaving(false); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 80 }} color={colors.green} /></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
      <Text style={styles.eyebrow}>AVAILABILITY</Text>
      <Text style={styles.title}>Control when you can move.</Text>
      <Text style={styles.sub}>Companies only see you as a candidate when your availability matches their mission.</Text>

      <View style={styles.toggleCard}>
        <View style={{ flex: 1 }}><Text style={styles.toggleTitle}>Available now</Text><Text style={styles.toggleSub}>Accept missions with short notice</Text></View>
        <Pressable onPress={() => setAvailable(!available)} style={[styles.toggle, !available && styles.toggleOff]}><View style={[styles.knob, !available && styles.knobOff]} /></Pressable>
      </View>

      <Text style={styles.sectionTitle}>Choose a date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map(d => <Pressable key={dayKey(d)} onPress={() => setSelected(dayKey(d))} style={[styles.day, selected === dayKey(d) && styles.dayActive]}>
          <Text style={[styles.dayLabel, selected === dayKey(d) && styles.dayTextActive]}>{dayLabel(d)}</Text>
          <Text style={[styles.dayNum, selected === dayKey(d) && styles.dayTextActive]}>{dateLabel(d)}</Text>
        </Pressable>)}
      </ScrollView>

      <View style={styles.field}><Text style={styles.label}>Starting location</Text><TextInput value={location} onChangeText={setLocation} placeholder="City or area" placeholderTextColor="#9AA19F" style={styles.input}/></View>
      <View style={styles.field}><Text style={styles.label}>Availability window</Text><Text style={styles.value}>10:00 → 18:00 local time</Text></View>

      <Text style={styles.sectionTitle}>Transport types</Text>
      <View style={styles.wrap}>{transportOptions.map(([id, label]) => <Pressable key={id} onPress={() => toggleTransport(id)} style={[styles.choice, transportTypes.includes(id) && styles.choiceActive]}><Text style={[styles.choiceText, transportTypes.includes(id) && styles.choiceTextActive]}>{label}</Text></Pressable>)}</View>

      <Pressable style={styles.field} onPress={() => setInternational(!international)}><Text style={styles.label}>International missions</Text><Text style={styles.value}>{international ? 'Enabled' : 'Disabled'}</Text></Pressable>

      <Pressable disabled={saving} style={[styles.button, saving && { opacity: .6 }]} onPress={save}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save availability'}</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.paper},container:{padding:24,paddingBottom:50},back:{fontSize:16,fontWeight:'800',color:colors.ink,marginBottom:25},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.4,color:colors.green},title:{fontSize:35,lineHeight:39,fontWeight:'800',color:colors.ink,letterSpacing:-1.1,marginTop:7},sub:{fontSize:14,lineHeight:21,color:colors.muted,marginTop:9},toggleCard:{marginTop:24,padding:17,borderRadius:radii.lg,backgroundColor:colors.ink,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},toggleTitle:{fontSize:17,fontWeight:'800',color:colors.white},toggleSub:{fontSize:12,color:'#B8BFBC',marginTop:3},toggle:{width:48,height:28,borderRadius:15,backgroundColor:colors.green,padding:3,justifyContent:'center'},toggleOff:{backgroundColor:'#4B5350'},knob:{width:22,height:22,borderRadius:11,backgroundColor:colors.white,alignSelf:'flex-end'},knobOff:{alignSelf:'flex-start'},sectionTitle:{fontSize:18,fontWeight:'800',color:colors.ink,marginTop:28,marginBottom:11},days:{gap:8,paddingBottom:4},day:{width:72,height:66,borderRadius:13,borderWidth:1,borderColor:colors.line,backgroundColor:colors.white,alignItems:'center',justifyContent:'center'},dayActive:{backgroundColor:colors.ink,borderColor:colors.ink},dayLabel:{fontSize:9,fontWeight:'900',letterSpacing:.6,color:colors.muted},dayNum:{fontSize:15,fontWeight:'800',color:colors.ink,marginTop:4},dayTextActive:{color:colors.white},field:{marginTop:11,padding:15,borderRadius:radii.md,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line},label:{fontSize:11,fontWeight:'700',color:colors.muted},value:{fontSize:14,fontWeight:'800',color:colors.ink,marginTop:4},input:{height:40,marginTop:5,fontSize:14,color:colors.ink},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{borderWidth:1,borderColor:colors.line,borderRadius:10,paddingHorizontal:12,paddingVertical:10,backgroundColor:colors.white},choiceActive:{backgroundColor:colors.ink,borderColor:colors.ink},choiceText:{fontSize:12,fontWeight:'700',color:colors.ink},choiceTextActive:{color:colors.white},button:{height:56,borderRadius:radii.md,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',marginTop:20},buttonText:{fontSize:16,fontWeight:'800',color:colors.white}
});