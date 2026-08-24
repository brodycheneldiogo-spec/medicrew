import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from './theme';
import { usePreferences } from './preferences-context';

export function PreAuthPreferences(){
  const prefs=usePreferences();
  const cycleLanguage=()=>prefs.setLanguage(prefs.language==='en'?'fr':prefs.language==='fr'?'es':'en');
  const toggleCurrency=()=>prefs.setCurrency(prefs.currency==='USD'?'EUR':'USD');
  return <View style={s.wrap}>
    <Pressable accessibilityRole="button" accessibilityLabel="Change language" onPress={cycleLanguage} style={s.pill}><Text style={s.text}>{prefs.language.toUpperCase()}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Change display currency" onPress={toggleCurrency} style={s.pill}><Text style={s.text}>{prefs.currency==='USD'?'$':'€'}</Text></Pressable>
  </View>
}

const s=StyleSheet.create({wrap:{flexDirection:'row',alignItems:'center',gap:7},pill:{height:34,minWidth:42,paddingHorizontal:11,borderRadius:radii.pill,borderWidth:1,borderColor:colors.line,backgroundColor:colors.white,alignItems:'center',justifyContent:'center'},text:{fontSize:11,fontWeight:'900',color:colors.greenDark,letterSpacing:.4}});

