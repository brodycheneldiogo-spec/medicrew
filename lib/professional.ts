export type SkillLevel = 'basic' | 'intermediate' | 'advanced' | 'expert';
export type ProfessionalType = 'doctor' | 'nurse';
export type Skill = { id: string; name: string; category: string };
export type ProfessionalSkill = Skill & { level: SkillLevel; years: number };
export const skillCatalog: Skill[] = [
  { id: 'icu', name: 'ICU / Critical Care', category: 'Clinical' },
  { id: 'mechanical-ventilation', name: 'Mechanical ventilation', category: 'Airway & respiratory' },
  { id: 'niv', name: 'Non-invasive ventilation', category: 'Airway & respiratory' },
  { id: 'intubation', name: 'Endotracheal intubation', category: 'Airway & respiratory' },
  { id: 'difficult-airway', name: 'Difficult airway management', category: 'Airway & respiratory' },
  { id: 'ecmo', name: 'ECMO', category: 'Advanced critical care' },
  { id: 'vv-ecmo', name: 'VV ECMO', category: 'Advanced critical care' },
  { id: 'va-ecmo', name: 'VA ECMO', category: 'Advanced critical care' },
  { id: 'central-line', name: 'Central line management', category: 'Vascular access' },
  { id: 'arterial-line', name: 'Arterial line management', category: 'Vascular access' },
  { id: 'peripheral-iv', name: 'Peripheral IV access', category: 'Vascular access' },
  { id: 'ultrasound-iv', name: 'Ultrasound-guided IV', category: 'Vascular access' },
  { id: 'invasive-monitoring', name: 'Invasive monitoring', category: 'Monitoring' },
  { id: 'capnography', name: 'Capnography / EtCO₂', category: 'Monitoring' },
  { id: 'ecg', name: 'ECG / cardiac monitoring', category: 'Monitoring' },
  { id: 'infusion-pumps', name: 'Infusion / syringe pumps', category: 'Medication & infusions' },
  { id: 'vasoactive', name: 'Vasoactive infusions', category: 'Medication & infusions' },
  { id: 'sedation', name: 'Sedation management', category: 'Medication & infusions' },
  { id: 'air-ambulance', name: 'Air ambulance', category: 'Transport' },
  { id: 'fixed-wing', name: 'Fixed-wing transport', category: 'Transport' },
  { id: 'helicopter', name: 'Helicopter transport', category: 'Transport' },
  { id: 'commercial-flight', name: 'Commercial flight escort', category: 'Transport' },
  { id: 'ground-transport', name: 'Ground / ambulance transport', category: 'Transport' },
  { id: 'international', name: 'International transport', category: 'Transport' },
  { id: 'medical-repatriation', name: 'Medical repatriation', category: 'Transport' },
  { id: 'pediatric-transport', name: 'Pediatric transport', category: 'Specialized transport' },
  { id: 'neonatal-transport', name: 'Neonatal transport', category: 'Specialized transport' },
  { id: 'trauma', name: 'Major trauma / polytrauma', category: 'Clinical' },
  { id: 'neurocritical', name: 'Neurocritical care', category: 'Clinical' },
  { id: 'cardiac-critical', name: 'Cardiac critical care', category: 'Clinical' },
];
export const skillLevels = [
  { id: 'basic', label: 'Basic' }, { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' }, { id: 'expert', label: 'Expert' },
];
export const specialties = ['Emergency Medicine', 'Critical Care / ICU', 'Anesthesiology', 'Cardiology', 'Neurology', 'Pediatrics', 'Neonatology', 'Trauma', 'Internal Medicine', 'Other'];
export const languages = ['French', 'English', 'Spanish', 'German', 'Italian', 'Portuguese', 'Arabic', 'Dutch', 'Greek', 'Other'];
