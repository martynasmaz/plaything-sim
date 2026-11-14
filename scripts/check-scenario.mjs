import {SCENARIO,validateScenario} from '../src/scenario.js';
import {createHash} from 'node:crypto';
const errors=validateScenario();if(errors.length)throw new Error(errors.join('\n'));
console.log(JSON.stringify({name:SCENARIO.name,revision:SCENARIO.revision,sha256:createHash('sha256').update(JSON.stringify(SCENARIO)).digest('hex'),founders:SCENARIO.simulation.start.ages.length,seasonDays:SCENARIO.simulation.learning.seasonLength,wheatEarliestDay:SCENARIO.progression.wheat.earliestDay,husbandry:SCENARIO.simulation.learning.husbandry,valid:true},null,2));
