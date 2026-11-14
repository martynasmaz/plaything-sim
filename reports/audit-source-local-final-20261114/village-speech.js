// Presentation-only chatter, derived from actual nearby work/conversation.
// No simulation state, randomness, decisions, knowledge or timing is changed.
export function activityEmoji(job,item=''){
  const text=(item||job).toLowerCase();
  if(/bread|flatbread/.test(text))return '🍞';
  if(/wheat|quern|flour|mill/.test(text))return '🌾';
  if(/basket|weav/.test(text))return '🧺';
  if(/axe|timber|firewood|clear (hut|herb) site/.test(text))return '🪓';
  if(/wall|stone|shelter|hut|roof/.test(text))return '🪨';
  if(/divin|omen|casting bones/.test(text))return '🦴';
  if(/ward|charm|rite/.test(text))return '✨';
  if(/remed|heal|care for|herb/.test(text))return '🌿';
  if(/fish|line|net|trap/.test(text))return '🐟';
  if(/food|supper|berry|berries|forage|cache/.test(text))return '🍲';
  if(/soil|fertiliz|plant|harvest|sow/.test(text))return '🌱';
  if(/fire|warm|kiln|charcoal/.test(text))return '🔥';
  if(/learn|teach|watch/.test(text))return '📖';
  if(/visit |meet |talk with |welcome |join .*household|return from a neighboring/.test(text))return '👋';
  if(job==='Camp circle')return '👋';
  return null;
}
export function villagerSpeech(visual,topic,clock,id,eligible){
  visual.uiSpeech??={nextAt:clock+2+(id*13)%29};
  const speech=visual.uiSpeech;
  if(!eligible||!topic){speech.until=0;return null;}
  if(speech.topic!==topic){speech.topic=topic;speech.until=0;}
  if(clock>=speech.nextAt){speech.until=clock+2.4;speech.nextAt=clock+34+id%11;}
  return clock<speech.until?topic:null;
}
export function drawEmojiSpeech(g,x,y,emoji){
  g.save();g.fillStyle='#f3e8ce';g.strokeStyle='#867554';g.lineWidth=1;
  g.beginPath();g.ellipse(x,y-10,17,13,0,0,Math.PI*2);g.fill();g.stroke();
  g.beginPath();g.moveTo(x-3,y+1);g.lineTo(x-6,y+8);g.lineTo(x+4,y+2);g.fill();
  g.font='19px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign='center';g.textBaseline='middle';g.fillStyle='#443c30';g.fillText(emoji,x,y-9);
  g.restore();
}
