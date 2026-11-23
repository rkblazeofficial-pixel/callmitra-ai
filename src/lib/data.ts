export type Gender = 'female' | 'male';

export const OCCASIONS = [
  { id: 'birthday', label: 'Birthday', icon: 'gift-outline', invite: false },
  { id: 'wedding', label: 'Wedding Invite', icon: 'heart-outline', invite: true },
  { id: 'engagement', label: 'Engagement', icon: 'diamond-outline', invite: true },
  { id: 'anniversary', label: 'Anniversary', icon: 'rose-outline', invite: false },
  { id: 'festival', label: 'Festival', icon: 'sparkles-outline', invite: false },
  { id: 'housewarming', label: 'Housewarming', icon: 'home-outline', invite: true },
  { id: 'baby', label: 'Baby Announcement', icon: 'happy-outline', invite: false },
  { id: 'congrats', label: 'Congratulations', icon: 'trophy-outline', invite: false },
  { id: 'party', label: 'Party Invite', icon: 'musical-notes-outline', invite: true },
  { id: 'family', label: 'Family Function', icon: 'people-outline', invite: true },
  { id: 'custom', label: 'Custom Message', icon: 'create-outline', invite: false },
] as const;
export type OccasionId = (typeof OCCASIONS)[number]['id'];

// Languages requested for CallMitra. Codes are ThunderPhone language codes
// (get_supported_languages). Hinglish has no separate provider code: it is
// spoken with the Hindi voices.
export const LANGUAGES = [
  { id: 'hinglish', label: 'Hinglish', code: 'hi' },
  { id: 'hi', label: 'Hindi', code: 'hi' },
  { id: 'en', label: 'English', code: 'en' },
  { id: 'pa', label: 'Punjabi', code: 'pa' },
  { id: 'bn', label: 'Bengali', code: 'bn' },
  { id: 'mr', label: 'Marathi', code: 'mr' },
  { id: 'gu', label: 'Gujarati', code: 'gu' },
  { id: 'ta', label: 'Tamil', code: 'ta' },
  { id: 'te', label: 'Telugu', code: 'te' },
  { id: 'kn', label: 'Kannada', code: 'kn' },
  { id: 'ml', label: 'Malayalam', code: 'ml' },
] as const;
export type LanguageId = (typeof LANGUAGES)[number]['id'];

export type Voice = { id: string; name: string; gender: Gender; langs: string[] };

// Voice ids are real ThunderPhone voice names (list_voices). Hindi and English
// pairings were verified with the provider's language filter; the regional
// pairings follow the provider's default voice per language and must be
// re-verified once the backend is connected.
export const VOICES: Voice[] = [
  { id: 'kavita', name: 'Kavita', gender: 'female', langs: ['hi', 'hinglish'] },
  { id: 'rohan', name: 'Rohan', gender: 'male', langs: ['hi', 'hinglish'] },
  { id: 'priya', name: 'Priya', gender: 'female', langs: ['en'] },
  { id: 'diya', name: 'Diya', gender: 'female', langs: ['en'] },
  { id: 'james', name: 'James', gender: 'male', langs: ['en'] },
  { id: 'jaspreet', name: 'Jaspreet', gender: 'female', langs: ['pa'] },
  { id: 'gurpreet', name: 'Gurpreet', gender: 'male', langs: ['pa'] },
  { id: 'pooja', name: 'Pooja', gender: 'female', langs: ['bn'] },
  { id: 'rubel', name: 'Rubel', gender: 'male', langs: ['bn'] },
  { id: 'anika', name: 'Anika', gender: 'female', langs: ['mr'] },
  { id: 'suresh', name: 'Suresh', gender: 'male', langs: ['mr'] },
  { id: 'isha-gu', name: 'Isha', gender: 'female', langs: ['gu'] },
  { id: 'amit', name: 'Amit', gender: 'male', langs: ['gu'] },
  { id: 'kavitha', name: 'Kavitha', gender: 'female', langs: ['ta'] },
  { id: 'arun', name: 'Arun', gender: 'male', langs: ['ta'] },
  { id: 'sindhu', name: 'Sindhu', gender: 'female', langs: ['te'] },
  { id: 'pavan', name: 'Pavan', gender: 'male', langs: ['te'] },
  { id: 'divya', name: 'Divya', gender: 'female', langs: ['kn'] },
  { id: 'prakash', name: 'Prakash', gender: 'male', langs: ['kn'] },
  { id: 'latha', name: 'Latha', gender: 'female', langs: ['ml'] },
  { id: 'vijay', name: 'Vijay', gender: 'male', langs: ['ml'] },
];

export const voicesFor = (lang: LanguageId, gender: Gender) =>
  VOICES.filter((v) => v.langs.includes(lang) && v.gender === gender);

export const STYLES = ['Friendly', 'Polite', 'Natural', 'Professional'] as const;
export type Style = (typeof STYLES)[number];
export const SPEEDS = ['Slow', 'Normal', 'Fast'] as const;
export type Speed = (typeof SPEEDS)[number];
