import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii } from './theme';

export function MediCrewLogo({compact=false}:{compact?:boolean}) {
  return (
    <View style={[styles.row,compact&&styles.compactRow]}>
      <Svg width={compact?56:62} height={compact?56:62} viewBox="0 0 240 150" accessibilityLabel="MediCrew logo">
        <Defs><SvgGradient id="logoGradient" x1="0" y1="1" x2="1" y2="0"><Stop offset="0" stopColor={colors.greenStart}/><Stop offset=".55" stopColor={colors.green}/><Stop offset="1" stopColor={colors.greenEnd}/></SvgGradient></Defs>
        <Path d="M18 104C18 55 30 22 61 22C79 22 91 34 105 53L120 72L137 50C151 31 164 22 181 22C212 22 222 49 222 81V105C222 125 208 137 191 137C174 137 162 125 162 105V68L139 94C129 106 111 107 99 95L60 58V105C60 125 50 137 34 137C18 137 18 122 18 104Z" fill="url(#logoGradient)"/>
        <Rect x="170" y="89" width="32" height="32" rx="8" fill="#FFFFFF"/>
        <Path d="M184 95V115M174 105H194" stroke={colors.greenDark} strokeWidth="7" strokeLinecap="round"/>
      </Svg>
      {!compact&&<View style={styles.wordmarkWrap}><Text style={styles.wordmark}>Medi<Text style={styles.wordmarkCrew}>Crew</Text></Text><Text style={styles.tagline}>CARE MOVES FORWARD</Text></View>}
    </View>
  );
}

export function GradientButton({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}) {
  return <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button"><LinearGradient colors={gradients.primary} start={{x:0,y:.5}} end={{x:1,y:.5}} style={[styles.button,disabled&&styles.disabled]}><Text style={styles.buttonText}>{label}</Text></LinearGradient></Pressable>;
}

const styles=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:7},compactRow:{gap:0},wordmarkWrap:{justifyContent:'center'},wordmark:{fontSize:25,fontWeight:'900',letterSpacing:-1.1,color:colors.ink},wordmarkCrew:{color:colors.greenDark},tagline:{fontSize:6.5,fontWeight:'800',letterSpacing:2.2,color:colors.muted,marginTop:1},button:{height:56,borderRadius:radii.md,alignItems:'center',justifyContent:'center',overflow:'hidden',shadowColor:colors.greenDark,shadowOpacity:.16,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:3},buttonText:{color:colors.white,fontSize:16,fontWeight:'900',textAlign:'center'},disabled:{opacity:.45}});