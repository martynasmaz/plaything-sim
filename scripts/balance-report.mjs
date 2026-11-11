// Record all 30 days, even if a future design change breaks optional intervention.
import { createState, stepDay } from '../src/sim.js';
import { writeFile, mkdir } from 'node:fs/promises';
let state=createState();const rows=[];
for(let i=0;i<30&&!state.ended;i++){
  state=stepDay(state);
  rows.push({day:state.day,population:state.villagers.length,food:state.food,wood:state.wood,
    power:state.power,fireKnown:state.fireKnown,fireLit:state.fireLit,
    births:state.lastDay.birth||'',deaths:state.lastDay.deaths.map(d=>`${d.name}: ${d.causes.join(' + ')}`).join('; ')});
}
const passed=state.day===30&&state.villagers.length>=5&&state.fireKnown;
const report={buildCheck:'No-command run',passed,day:state.day,population:state.villagers.length,rows};
await mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await writeFile(new URL('../reports/no-command.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const keys=Object.keys(rows[0]);
await writeFile(new URL('../reports/no-command.csv',import.meta.url),keys.join(',')+'\n'+rows.map(r=>keys.map(k=>r[k]).join(',')).join('\n')+'\n');
console.table(rows);console.log(passed?'PASS: Day 30 survival and fire.':'FAIL: Original numbers retained; see full day-by-day report.');
process.exitCode=passed?0:1;
