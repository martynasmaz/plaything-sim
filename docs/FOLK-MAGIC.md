# Optional folk magic

This is fictional, pagan-inspired village magic: omens, marked bones, hearth
charms, healing rites and wards. It is not a historical claim about a particular
religion or a system of combat spells.

## The god's unlock

Only submitting exactly `magic` through the god's text input activates it.
Case and surrounding whitespace are ignored. Phrases such as `enable magic`,
`magic!`, or `magic rain` cannot unlock it; ordinary keyword matching and queued
commands do not activate it. There is no automatic awakening, setting switch or
NPC ritual that enables magic. The command is immediate, costs no materials and
does not consume random draws. Repeating it is harmless and does not toggle off.

Activation records `local.magic` in the current save. Old worlds remain dormant
until the word is typed; a fresh world starts dormant again. The unlock gives no
knowledge, items, profession or building. Magical recipes and notebook details
are hidden while dormant, and dormant magic does not enlarge the invention
catalog. The original v0.1/v0.2 reference worlds reject the unlock.

## Learning and work

Personal recipes live in `src/practices.js`; cross-craft dependencies are also
represented through `readyToInvent` in `src/sim.js`. Knowledge can arise through
material experiments and spread through repeated joint lessons. Magical lessons
only count if both participants actually performed the paired teaching work.
The healer may teach magical lore to their own apprentice; medical duties still
preempt a lesson. Lore alone grants neither ritual tools nor an effect.

| Practice | Prerequisites | Cost and result |
| --- | --- | --- |
| Casting bones | Fire known, basic tools, experience crushing hard materials | 1 bone unit and 1 charcoal make a reusable set of marked bone fragments |
| Reading omens | Personal casting bones, three outdoor workdays, safe needs | 1 herb and 1 charcoal; reads the next dawn's weather and a threatened new illness |
| Hearth charms | Fire tending, cordage, wood-working experience, an actual lit hearth | 1 wood, 1 fibre, 1 resin; +6 warmth at that camp on the casting day and next two days while the hearth burns |
| Mending rites | Herbalism, actual preparation/care experience, an injured or sick neighbor | 1 herb, 1 resin; +6 health and one fewer illness day; six-day limit per patient |
| Store wards | Drying and cordage knowledge, repeated food preservation, existing preserved food, a lit fire | 1 fibre, 1 resin, 1 charcoal; half spoilage at the following three dawns |

Recipes must first be learned through experiments or teaching; experimental
attempts consume their materials without granting a completed ritual effect.
Marked natural fragments do not require fine drilling, advanced carving or a
woven pouch. Field and woodland observations provide alternate learning paths.

Completed rites occupy a workday and cost twice ordinary work energy (16 at
default tuning). A caster must be an adult, fed, warm, healthy and rested, with
secure supplies. Essential survival work and patient/family care take priority.
Hearth charms preserve the real hearth fuel reserve. Wards cannot create food
or stack indefinitely; mending cannot resurrect anyone or prevent old age.

## Foretelling

Divination does not draw more random numbers or change the future's dice.
Readings are completed after the normal nightly rolls. They identify the
weather and any new illness target for the next dawn, conditional on the god
and the population not changing that course. A camp shares a reading and waits
six days before another; individual diviners also have that cooldown.

Warnings about cold can influence subsequent firewood work after immediate
needs are addressed. The notebook keeps the last 20 dated readings and displays
the latest six. This is limited next-dawn foretelling, not a prediction of an
entire life or a guarantee of survival.

## Presentation and verification

Ritual props and faint motes appear during actual ritual work. There are no
permanent floating magical labels. Normal nearby conversation and work can
produce brief emoji bubbles, capped at two visible speakers; those bubbles
change no simulation decisions or priorities. Full descriptions remain in the
NPC inspection card and notebook.

`tests/magic.test.js` covers the explicit gate, dormant states, recipe
prerequisites, ingredients, energy, expiry, cooldowns, actual teaching,
deterministic foretelling, old saves and the reference versions. The paired
measurement in `reports/folk-practices-10.json` compares fresh worlds with no
interventions against the same seeds with only `magic` typed at day zero.
Its source hash identifies the measured rules; this small sample is not a
long-term survival guarantee.

In the final ten enabled runs through day 1,000 or extinction, every village
made divining bones. Completed work included 845 readings, 118 mending rites and
40 store wards. No hearth charm was observed in that sample; its conditions and
effect are covered by controlled tests. The ten dormant controls performed zero
magical rites. Seven enabled and eight control villages reached day 1,000;
these few paired seeds do not establish a survival advantage. Ritual work and
reagents are real tradeoffs, not free prosperity.
These measurements predate the denser woodland and expanded birth-event tracker;
their source hash identifies that earlier version.
