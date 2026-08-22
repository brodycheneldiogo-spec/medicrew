import { StyleSheet } from 'react-native';
import { colors, radii } from './theme';

export const adminPreviewStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  head: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#33413A' },
  back: { paddingVertical: 8 },
  backText: { fontSize: 13, fontWeight: '900', color: colors.white },
  title: { fontSize: 18, fontWeight: '900', color: colors.white, marginTop: 6 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  help: { fontSize: 13, lineHeight: 20, color: '#C8D1CC', textAlign: 'center', marginBottom: 18 },
  open: { height: 54, paddingHorizontal: 24, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  openText: { fontSize: 13, fontWeight: '900', color: colors.ink },
});
