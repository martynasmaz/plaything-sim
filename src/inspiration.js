import {SCENARIO} from './scenario.js';
// Questions are prompts to investigate, not inventions or changes to traits.
export const inspirationTopics=[
  {id:'counting',skill:'wood',question:'Could marks on a stick help us count and share our stores?',ready:(s,p)=>(p.skills.berries||0)>=3&&(p.skills.wood||0)>=2},
  {id:'measurement',skill:'wood',question:'Could we compare lengths before fitting our shelter poles?',ready:(s,p)=>s.settlementWork>=s.config.settlement.shelterWork&&(p.skills.wood||0)>=4},
  {id:'levers',skill:'stone',question:'Would a long branch help us move a heavy stone?',ready:(s,p)=>(p.skills.stone||0)>=3&&(p.skills.wood||0)>=3&&s.toolkit?.includes('hammer stone')},
  {id:'falling',skill:'stone',question:'Do a large stone and a small stone reach the ground together?',ready:(s,p)=>(p.skills.stone||0)>=2&&(p.skills.berries||0)>=4},
  {id:'seasons',skill:'berries',question:'Could the changing shadows help us remember when plants return?',ready:(s,p)=>s.day>=40&&(p.skills.berries||0)>=6}
];
function inspirationScore(s,v,topic){
  const p=v.practice,seen=p.questionsSeen?.[topic.id]??-1000;
  return Math.min(100,s.day-seen)+(p.skills[topic.skill]||0)+
    (topic.id==='counting'&&s.food<s.villagers.length*3?15:0)+
    (topic.id==='measurement'&&s.hutProject?15:0)+(topic.id==='seasons'&&s.farming.known?12:0);
}
export function inspireVillager(s,{target,natural=false}={}){
  if(!s.local||s.ended)return null;
  const choices=[];
  for(const v of s.villagers){
    if(target&&v.name.toLowerCase()!==target.toLowerCase())continue;
    if(v.age<s.config.life.adult||v.illnessDays||v.health<40||v.fullness<40||v.warmth<40||v.practice.energy<32||
      v.practice.inspiration?.until>=s.day)continue;
    for(const topic of inspirationTopics)if(topic.ready(s,v.practice)&&s.day-(v.practice.questionsSeen?.[topic.id]??-1000)>=SCENARIO.inspiration.topicCooldownDays)
      choices.push({v,topic,score:inspirationScore(s,v,topic)});
  }
  choices.sort((a,b)=>b.score-a.score||a.v.id-b.v.id);
  const choice=choices[0];if(!choice)return null;
  const {v,topic}=choice,p=v.practice;
  p.inspiration={topic:topic.id,skill:topic.skill,question:topic.question,day:s.day,until:s.day+SCENARIO.inspiration.durationDays};
  (p.questionsSeen??={})[topic.id]=s.day;
  const entry={day:s.day,id:v.id,name:v.name,topic:topic.id,question:topic.question,natural};
  (s.local.questions??=[]).push(entry);s.local.questions=s.local.questions.slice(-40);
  return entry;
}
export function naturalInspiration(s,report){
  // Productive experience can prompt a question; safe work and recovery retain
  // their existing priority, and this does not consume the nightly dice.
  for(const {id,action} of report.actions){
    if(!['Forage','Gather wood','Harvest','Harvest wheat','Build hut','Rest','Hunt','Fish'].includes(action))continue;
    const v=s.villagers.find(v=>v.id===id);if(!v||v.motivation?.level<3)continue;
    let h=Math.imul(s.seed^Math.imul(s.day+1,1597334677)^id,2246822519);h=(h^(h>>>16))>>>0;
    if(((h%400)+(Math.floor(h/400)%1000000)/1000000)/400<SCENARIO.inspiration.naturalChance){const q=inspireVillager(s,{target:v.name,natural:true});if(q)(report.inspiration??=[]).push(q);}
  }
}
export function inspirationBonus(s,v,recipe){
  const i=v.practice.inspiration;
  return i?.until>=s.day&&i.skill===recipe.skill?SCENARIO.inspiration.experimentBonus:0;
}
