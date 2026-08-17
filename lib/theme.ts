// MediCrew visual system: the primary action color is the original green carried through a modern gradient.
export const colors = {
  ink: '#101214',
  paper: '#F7F8F6',
  green: '#18B889',
  greenStart: '#079B72',
  greenEnd: '#73E35C',
  greenDark: '#087A5E',
  greenSoft: '#DDF5ED',
  muted: '#69716F',
  line: '#E3E7E5',
  white: '#FFFFFF',
  danger: '#D94B4B',
  warning: '#B97800',
};

export const gradients = {
  primary: [colors.greenStart, colors.green, colors.greenEnd] as const,
  soft: ['#E8FBE5', colors.greenSoft] as const,
};

export const radii = { sm: 10, md: 16, lg: 24, pill: 999 };
