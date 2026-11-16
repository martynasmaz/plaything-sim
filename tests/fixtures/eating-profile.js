// Existing nutrition/priority contracts explicitly exercise eating and hunger
// damage with the original half-winter portion. Current defaults and quarter
// portions are covered in eating-settings.test.js and winter-meals.test.js.
export * from '../../src/config.js';
import {HOMESTEAD_RULES as currentRules} from '../../src/config.js';
export const HOMESTEAD_RULES={...currentRules,needs:{...currentRules.needs,eatsFood:true,hungerDeathsEnabled:true,winterMealFraction:.5}};
