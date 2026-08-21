import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii } from './theme';

export function MediCrewLogo({compact=false}:{compact?:boolean}) {
  return (
    <View style={[styles.row,compact&&styles.compactRow]}>
      <Svg width={compact?56:64} height={compact?56:64} viewBox="0 0 220 160" accessibilityLabel="MediCrew logo">
        <Defs><SvgGradient id="logoGradient" x1="0" y1="1" x2="1" y2="0"><Stop offset="0" stopColor={colors.greenStart}/><Stop offset=".52" stopColor={colors.green}/><Stop offset="1" stopColor={colors.greenEnd}/></SvgGradient></Defs>
        <Path d="M22 125V49C22 29 35 18 52 18C70 18 82 29 94 47L110 70L126 47C138 29 150 18 168 18C185 18 198 29 198 49V125C198 137 189 146 177 146C165 146 156 137 156 125V76L130 111C120 124 100 124 90 111L64 76V125C64 137 55 146 43 146C31 146 22 137 22 125Z" fill="url(#logoGradient)"/>
        <Rect x="88" y="112" width="44" height="34" rx="11" fill="#FFFFFF"/>
        <Path d="M110 119V139M100 129H120" stroke={colors.greenDark} strokeWidth="7" strokeLinecap="round"/>
      </Svg>
      {!compact&&<View style={styles.wordmarkWrap}><Text style={styles.wordmark}>Medi<Text style={styles.wordmarkCrew}>Crew</Text></Text><Text style={styles.tagline}>CARE MOVES FORWARD</Text></View>}
    </View>
  );
}

export function GradientButton({label,onPress,disabled=false,variant='primary'}:{label:string;onPress:()=>void;disabled?:boolean;variant?:'primary'|'professional'|'company'}) {
  const palette=variant==='professional'?gradients.professional:variant==='company'?gradients.company:gradients.primary;
  return <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button"><LinearGradient colors={palette} start={{x:0,y:.5}} end={{x:1,y:.5}} style={[styles.button,disabled&&styles.disabled]}><Text style={styles.buttonText}>{label}</Text></LinearGradient></Pressable>;
}

const styles=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:7},compactRow:{gap:0},wordmarkWrap:{justifyContent:'center'},wordmark:{fontSize:25,fontWeight:'900',letterSpacing:-1.1,color:colors.ink},wordmarkCrew:{color:colors.greenDark},tagline:{fontSize:6.5,fontWeight:'800',letterSpacing:2.2,color:colors.muted,marginTop:1},button:{height:56,borderRadius:radii.md,alignItems:'center',justifyContent:'center',overflow:'hidden',shadowColor:colors.greenDark,shadowOpacity:.15,shadowRadius:12,shadowOffset:{width:0,height:6},elevation:3},buttonText:{color:colors.white,fontSize:16,fontWeight:'900',textAlign:'center'},disabled:{opacity:.45}});