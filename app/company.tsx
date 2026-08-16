import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = { bg: '#F7F8F6', ink: '#101214', muted: '#6F7672', green: '#18B889', soft: '#DDF5ED', line: '#E5E8E5', white: '#FFFFFF' };

export default function CompanyHome() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MEDICREW · COMPANY</Text>
            <Text style={styles.title}>Find the right crew.</Text>
            <Text style={styles.subtitle}>Source verified medical professionals for transport missions.</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>MC</Text></View>
        </View>

        <TouchableOpacity style={styles.primary} onPress={() => router.push('/company-mission')} activeOpacity={0.85}>
          <View><Text style={styles.primaryTitle}>Create a mission</Text><Text style={styles.primarySub}>Define requirements and find matches</Text></View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.stats}>
          <Stat value="3" label="Open missions" />
          <Stat value="12" label="Active matches" />
          <Stat value="28" label="Completed" />
        </View>

        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Open missions</Text><TouchableOpacity><Text style={styles.link}>See all</Text></TouchableOpacity></View>
        <MissionCard route="Paris → Barcelona" date="25 AUG · 10:30" role="ICU Nurse" pay="€480" match="8 matches" />
        <MissionCard route="Lyon → Madrid" date="29 AUG · 07:15" role="Doctor · Critical Care" pay="€650" match="5 matches" />

        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Recent activity</Text></View>
        <Activity text="New candidate matched" detail="Dr. Martin · 96% match" />
        <Activity text="Mission completed" detail="Paris → Nice · 24 Aug" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function MissionCard({ route, date, role, pay, match }: { route: string; date: string; role: string; pay: string; match: string }) { return <TouchableOpacity style={styles.card} onPress={() => router.push('/company-mission')}><View style={styles.row}><View><Text style={styles.route}>{route}</Text><Text style={styles.meta}>{date}</Text></View><View style={styles.match}><Text style={styles.matchText}>{match}</Text></View></View><View style={styles.divider}/><View style={styles.row}><View><Text style={styles.role}>{role}</Text><Text style={styles.meta}>Verified professionals only</Text></View><Text style={styles.pay}>{pay}</Text></View></TouchableOpacity>; }
function Activity({ text, detail }: { text: string; detail: string }) { return <View style={styles.activity}><View style={styles.dot}/><View><Text style={styles.activityText}>{text}</Text><Text style={styles.meta}>{detail}</Text></View></View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, container: { padding: 22, paddingBottom: 48 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }, eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: colors.green, marginBottom: 8 }, title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.8 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 285 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.white, fontWeight: '800', fontSize: 12 }, primary: { backgroundColor: colors.ink, borderRadius: 18, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, primaryTitle: { color: colors.white, fontWeight: '800', fontSize: 17 }, primarySub: { color: '#B9C0BC', marginTop: 5, fontSize: 12 }, arrow: { color: colors.green, fontSize: 27, fontWeight: '500' }, stats: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, marginTop: 14, marginBottom: 28, paddingVertical: 17 }, stat: { flex: 1, paddingHorizontal: 14 }, statValue: { fontSize: 23, fontWeight: '800', color: colors.ink }, statLabel: { fontSize: 11, color: colors.muted, marginTop: 3 }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 3 }, sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink }, link: { color: colors.green, fontWeight: '700', fontSize: 13 }, card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 17, marginBottom: 10 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, route: { color: colors.ink, fontSize: 16, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 12, marginTop: 4 }, match: { backgroundColor: colors.soft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }, matchText: { color: '#128360', fontSize: 11, fontWeight: '800' }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 }, role: { color: colors.ink, fontWeight: '700', fontSize: 14 }, pay: { color: colors.ink, fontSize: 17, fontWeight: '800' }, activity: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginRight: 13 }, activityText: { fontWeight: '700', color: colors.ink, fontSize: 13 } });
