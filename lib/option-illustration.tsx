import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from './theme';

export type OptionIllustrationName='home'|'work'|'network'|'profile'|'messages'|'calendar'|'search';

export function OptionIllustration({name,size=34,company=false}:{name:OptionIllustrationName;size?:number;company?:boolean}){
  const main=company?colors.company:colors.pro;
  const dark=company?colors.companyDark:colors.proDark;
  const soft=company?colors.companySoft:colors.proSoft;
  const common={fill:'none',stroke:dark,strokeWidth:3.2,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  return <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel={`${name} illustration`}>
    <Circle cx="32" cy="32" r="29" fill={soft}/>
    {name==='home'?<><Path d="M15 31 32 16l17 15" {...common}/><Path d="M20 29v20h24V29M28 49V37h8v12" {...common}/></>:
    name==='work'?<><Rect x="14" y="22" width="36" height="27" rx="6" fill={main}/><Path d="M24 22v-7h16v7M14 33h36M28 32h8" {...common}/></>:
    name==='network'?<><Circle cx="21" cy="24" r="7" fill={main}/><Circle cx="44" cy="22" r="6" fill={dark}/><Circle cx="34" cy="43" r="7" fill={main}/><Path d="m27 26 11-2m-14 6 7 8m9-10-4 9" {...common}/></>:
    name==='profile'?<><Circle cx="32" cy="23" r="9" fill={main}/><Path d="M17 49c2-11 8-17 15-17s13 6 15 17" {...common}/></>:
    name==='messages'?<><Path d="M14 18h36v25H30l-10 7v-7h-6Z" fill={main}/><Path d="M22 28h20M22 34h14" stroke={colors.white} strokeWidth="3" strokeLinecap="round"/></>:
    name==='calendar'?<><Rect x="15" y="17" width="34" height="33" rx="6" fill={colors.white} stroke={dark} strokeWidth="3"/><Path d="M15 27h34M23 13v8M41 13v8" {...common}/><Circle cx="26" cy="36" r="3" fill={main}/><Circle cx="38" cy="36" r="3" fill={main}/><Circle cx="26" cy="44" r="3" fill={main}/></>:
    <><Circle cx="29" cy="29" r="12" fill={colors.white} stroke={dark} strokeWidth="3.5"/><Path d="m38 38 10 10" {...common}/><Path d="M23 29h12M29 23v12" stroke={main} strokeWidth="3" strokeLinecap="round"/></>}
  </Svg>;
}
