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

Structures are persistent simulation objects built by NPCs using materials and
workdays. A profession, trait, or renderer must not create or transform a building.
Let villagers choose sites and improvements for their own needs, and show only
the construction and fittings they have actually completed. Buildings and
unfinished projects remain after their occupants die; knowledge and occupation
can change independently of the physical structure.
