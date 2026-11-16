import {SCENARIO} from './scenario.js';
// Apply once at acquisition, not again when transferring, drying, milling,
// baking or serving the same ingredients. Reference modes keep their rules.
export const primaryFoodYield=(s,amount)=>amount*(s.config.learning?SCENARIO.foodYields.multiplier:1);
