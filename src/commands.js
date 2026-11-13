// THE ONE ACCEPTED-VOCABULARY TABLE. Keys are stable internal rule IDs; the first
// wording is the approved flavour name, the second is its original plain alias.
// Resolve BEFORE validation, queuing, payment or cooldown checks. Theme labels
// can change presentation, never this parser table. Later-era words are absent.
export const COMMAND_WORDS = {
  'spawn people':['call settlers','spawn people'],
  meteor:['falling star','meteor'],
  volcano:['mountain fire','volcano'],
  'earth crack':['split ground','earth crack'],
  godzilla:['summon kaiju','godzilla'],
  flood:['river surge','flood'],
  earthquake:['ground tremor','earthquake'],
  rain:['cloud wrangle','rain'],
  drought:['dry spell','drought'],
  bless:['hoedown','bless'],
  plague:['sick hex','plague'],
  'teach fire':['teach spark','teach fire'],
  harvest:['feast drop','harvest'],
  heal:['shake off','heal'],
  'teach farming':['teach sowing','teach farming']
};
export const normalizeWords = text => String(text).trim().replace(/\s+/g,' ').toLowerCase();
export function resolveCommand(text) {
  const input=normalizeWords(text);
  return Object.keys(COMMAND_WORDS).find(key=>COMMAND_WORDS[key].includes(input))??null;
}

// Minimal UI keyword matcher (design section 11). Each keyword belongs to one
// command; whole words or two-word phrases match anywhere in the text.
export const COMMAND_KEYWORDS = {
  'spawn people':['spawn','call settlers','summon people','more people','new settlers','populate'],
  meteor:['meteor','meteorite','falling star'],
  volcano:['volcano','eruption','erupt','mountain fire'],
  'earth crack':['earth crack','split ground','fissure'],
  godzilla:['godzilla','kaiju'],
  flood:['flood','flooding','floodwaters','river surge'],
  earthquake:['earthquake','quake','tremor','ground tremor'],
  rain:['cloud wrangle','rain','rains','raining','rainy','shower','showers','drizzle','downpour','clouds','wet','water'],
  drought:['dry spell','drought','dry','parch','parched','sun','sunshine','sunny','heatwave','scorch'],
  bless:['hoedown','bless','blessing','dance','party','celebrate','cheer','joy','happy','strength','health'],
  plague:['sick hex','plague','sick','sickness','ill','illness','disease','fever','curse','hex','pestilence'],
  'teach fire':['teach spark','teach fire','fire','spark','flame','flames','bonfire','light','warm','warmth'],
  harvest:['feast drop','harvest','feast','food','provisions','bread','eat','meal','supper','bounty'],
  heal:['shake off','heal','cure','mend','medicine','remedy','recover'],
  'teach farming':['teach sowing','teach farming','sow','sowing','farm','farming','plant','planting','seeds','crops','grow']
};
// When several commands match, the first in this order wins (helpful first).
export const KEYWORD_PRIORITY = ['godzilla','meteor','volcano','earth crack','earthquake','flood','spawn people','teach fire','teach farming','heal','bless','harvest','rain','drought','plague'];
// Lowercase; anything but a-z and 0-9 (apostrophes too) becomes a space.
export const cleanWords = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// `allowed` lists the command keys this version accepts; returns a key or null.
export function matchCommand(text, allowed = Object.keys(COMMAND_KEYWORDS)) {
  const padded = ' '+cleanWords(text)+' ';
  return KEYWORD_PRIORITY.find(key => allowed.includes(key)
    && COMMAND_KEYWORDS[key].some(word => padded.includes(' '+word+' '))) ?? null;
}
