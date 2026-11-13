# Village progression

When adding a villager invention, building, or practice, identify the materials,
skills, infrastructure, and experiences that make it possible. Enforce those
prerequisites in the simulation when villagers first discover or build it.
Use the practice recipes in src/practices.js for individual knowledge and
readyToInvent in src/sim.js for dependencies between crafts. Check alternate
discovery paths and existing saves. Keep earlier discoveries in loaded worlds.

Later developments should wait until their prerequisites exist. Leave room for
independent discoveries to arise in different orders and for knowledge to
spread through practice and teaching. Use dates or regional era restrictions
when the game's setting specifically calls for them.
