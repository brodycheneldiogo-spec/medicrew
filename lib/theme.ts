export const colors={
  ink:'#0D1513',paper:'#F6F9F7',white:'#FFFFFF',muted:'#68736F',line:'#DFE8E4',danger:'#D94B4B',warning:'#B97800',
  green:'#19B985',greenStart:'#078A61',greenEnd:'#72E7A6',greenDark:'#08785C',greenSoft:'#DDF6EC',mint:'#ECFBF5',
  pro:'#19B985',proDark:'#08785C',proSoft:'#DDF6EC',proGlow:'#A7F3D3',
  company:'#157F76',companyDark:'#0D5F5B',companySoft:'#DCEFEB',companyGlow:'#9BD7CF'
};
export const gradients={
  primary:[colors.greenStart,colors.green,colors.greenEnd] as const,
  professional:[colors.proDark,colors.pro,colors.proGlow] as const,
  company:[colors.companyDark,colors.company,colors.companyGlow] as const,
  soft:['#EEF9F3','#E5F6EE',colors.paper] as const,
  dark:[colors.greenDark,colors.ink] as const
};
export const radii={sm:12,md:18,lg:26,pill:999};
export const shadows={card:{shadowColor:colors.ink,shadowOpacity:.06,shadowRadius:16,shadowOffset:{width:0,height:7},elevation:3}};
