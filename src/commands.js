// THE ONE ACCEPTED-VOCABULARY TABLE. Keys are stable internal rule IDs; the first
// wording is the approved flavour name, the second is its original plain alias.
// Resolve BEFORE validation, queuing, payment or cooldown checks. Theme labels
// can change presentation, never this parser table. Later-era words are absent.
export const COMMAND_WORDS = {
  rain:['cloud wrangle','rain'],
  drought:['dry spell','drought'],
  bless:['hoedown','bless'],
  plague:['sick hex','plague'],
  'teach fire':['teach spark','teach fire'],
  harvest:['feast drop','harvest']
};
export const normalizeWords = text => String(text).trim().replace(/\s+/g,' ').toLowerCase();
export function resolveCommand(text) {
  const input=normalizeWords(text);
  return Object.keys(COMMAND_WORDS).find(key=>COMMAND_WORDS[key].includes(input))??null;
}
