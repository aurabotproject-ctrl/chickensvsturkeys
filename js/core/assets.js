// Asset manifest. All game art lives in assets/sprites/ as .webp
// (sliced from the original ChatGPT sheets in assets/images/).
const BASE = new URL('../../assets/sprites/', import.meta.url).href;

export const sprite = (name) => `${BASE}${name}.webp`;

export const AVATARS = {
  chicken: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  turkey: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
};
export const avatar = (i) => sprite(`av${Number.isInteger(i) ? i : 0}`);

export const SUBJECT_ICONS = {
  'Mathematics & Statistics': 'subj_maths',
  English: 'subj_english',
  Science: 'subj_science',
  'Social Sciences': 'subj_history',
  Geography: 'subj_geography',
  'NZ Curriculum': 'subj_nz',
  'General Knowledge': 'subj_general',
  'Reading Comprehension': 'subj_reading',
  'Te Reo Māori': 'subj_tereo',
  'The Arts': 'subj_art',
  Music: 'subj_music',
  'Health & PE': 'subj_sport',
};
export const subjectIcon = (subject) => sprite(SUBJECT_ICONS[subject] || 'subj_general');

/** Sprites the Dodge Egg arena needs (preloaded by Pixi). */
export const DODGE_SPRITES = [
  'arena',
  'chicken_idle', 'chicken_run', 'chicken_throw', 'chicken_dizzy', 'chicken_win',
  'turkey_idle', 'turkey_run', 'turkey_throw', 'turkey_dizzy', 'turkey_win',
  'egg_blue', 'egg_red', 'egg', 'egg_gold', 'splat', 'splat_big', 'shell_burst', 'impact', 'stars', 'dust', 'feathers', 'shield', 'sparkle', 'fox',
  'word_splat', 'word_bok', 'word_blast', 'word_oof', 'word_pow', 'word_gobble', 'word_bullseye', 'word_cleansweep',
];

export const EVENT_BANNERS = {
  golden: 'ev_golden', fox: 'ev_fox', storm: 'ev_storm', fog: 'ev_fog',
  shield: 'ev_shield', double: 'ev_double', sweep: 'ev_sweep', swap: 'ev_swap',
};

export const TEAM = {
  chicken: { name: 'Chickens', one: 'Chicken', color: '#1e6fe0', panel: 'panel_chicken', egg: 'egg_blue', win: 'win_chicken' },
  turkey: { name: 'Turkeys', one: 'Turkey', color: '#e0402a', panel: 'panel_turkey', egg: 'egg_red', win: 'win_turkey' },
};
