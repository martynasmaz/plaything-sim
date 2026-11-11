import { COMMAND_WORDS } from './commands.js';
// ONE-FILE RESKIN: replace this file, add any optional files under assets/, rebuild.
// No simulation constants or command keywords belong here. All copy, palettes,
// fonts, layout, primitive fallbacks and optional image choices do belong here.
// Defaults use the approved SVGs, with independent geometric fallbacks.
export const THEME = {
  id: 'gourdling-barn-dance',
  palette: { cream:'#EFE3C8', ink:'#2B211C', green:'#3E5B3A', red:'#A8432F', mustard:'#D2A23A', orange:'#C4692C' },
  fonts: { body:'Georgia, "Times New Roman", serif', heading:'Georgia, "Times New Roman", serif', canvas:'Georgia, serif' },
  names: ['Ada','Bram','Cora','Daro','Ena','Finn'],
  // Optional map: asset key -> project-relative SVG path or data URI. An empty map
  // (or any missing file) falls back to plain shapes; the default below is the approved art.
  // Example: shelter:'assets/shed.svg', shadow:'assets/shadow.svg',
  // villager:'assets/gourdling_{variant}_{state}_{frame}.svg'
  // Static villager / villager_child entries and expanded gourdling_* keys work too.
  sprites: {
  "shelter": "assets/shed.svg",
  "campfire_lit": "assets/bonfire_lit.svg",
  "campfire_out": "assets/bonfire_unlit.svg",
  "lantern": "assets/lantern.svg",
  "ground_tile": "assets/ground.svg",
  "fence_tile": "assets/fence_horizontal.svg",
  "fence_vertical": "assets/fence_vertical.svg",
  "fence_corner": "assets/fence_corner.svg",
  "corn": "assets/corn.svg",
  "command_panel": "assets/sign_ui.svg",
  "shadow": "assets/shadow.svg",
  "food_spot": "assets/gather_food.svg",
  "wood_spot": "assets/gather_wood.svg",
  "pantry": "assets/pantry.svg",
  "rain": "assets/overlay_rain.svg",
  "drought": "assets/overlay_drought.svg",
  "rain_cue": "assets/cue_rain.svg",
  "drought_cue": "assets/cue_drought.svg",
  "sick_icon": "assets/status_sick.svg",
  "unhappy_icon": "assets/status_unhappy.svg",
  "uneasy_icon": "assets/status_uneasy.svg",
  "hoedown_icon": "assets/status_hoedown.svg",
  "warming_icon": "assets/cue_warming.svg",
  "cold": "assets/overlay_cold_snap.svg",
  "cold_cue": "assets/cue_cold_snap.svg",
  "tomorrow_tag": "assets/tag_tomorrow.svg",
  "end_sign": "assets/sign_endscreen.svg",
  "restart_button": "assets/button_restart.svg",
  "restart_button_pressed": "assets/button_restart_pressed.svg",
  "villager": "assets/gourdling_{variant}_{state}_{frame}.svg"
},
  creatures: { variants:['fiddler','banjo','singer','kicker','washboard','jug'],
    childVariant:'child', states:{ idle:[1], walk:[1,2] }, pattern:'gourdling_{variant}_{state}_{frame}' },
  // Source dimensions follow the artist's proposal. "size" is actual canvas px.
  // All sprite origins are explicit. Feet/ground contacts use bottom-centre.
  // Art used by the page around the canvas (forecast tag, end sign, buttons).
  // Words on them are always live text from copy below; none is baked in.
  domArt: ['tomorrow_tag','end_sign','restart_button','restart_button_pressed','rain_cue','drought_cue','cold_cue'],
  assetSpecs: {
  "villager": {
    "file": "gourdling_fiddler_idle_1.svg",
    "source": [
      64,
      96
    ],
    "viewBox": [
      0,
      0,
      64,
      96
    ],
    "pivot": [
      32.0,
      94.0
    ],
    "size": [
      40,
      60
    ],
    "origin": [
      0.5,
      0.9791666666666666
    ]
  },
  "villager_child": {
    "file": "gourdling_child_idle_1.svg",
    "source": [
      48,
      72
    ],
    "viewBox": [
      0,
      0,
      48,
      72
    ],
    "pivot": [
      24.0,
      70.7
    ],
    "size": [
      30,
      45
    ],
    "origin": [
      0.5,
      0.9819444444444445
    ]
  },
  "shelter": {
    "file": "shed.svg",
    "source": [
      128,
      128
    ],
    "viewBox": [
      0,
      0,
      128,
      128
    ],
    "pivot": [
      64.0,
      120.0
    ],
    "size": [
      128,
      128
    ],
    "origin": [
      0.5,
      0.9375
    ],
    "layer": "world"
  },
  "campfire_lit": {
    "file": "bonfire_lit.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      32.0,
      56.0
    ],
    "size": [
      64,
      64
    ],
    "origin": [
      0.5,
      0.875
    ],
    "layer": "world"
  },
  "campfire_out": {
    "file": "bonfire_unlit.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      32.0,
      56.0
    ],
    "size": [
      64,
      64
    ],
    "origin": [
      0.5,
      0.875
    ],
    "layer": "world"
  },
  "lantern": {
    "file": "lantern.svg",
    "source": [
      32,
      64
    ],
    "viewBox": [
      0,
      0,
      32,
      64
    ],
    "pivot": [
      8.0,
      61.0
    ],
    "size": [
      32,
      64
    ],
    "origin": [
      0.25,
      0.953125
    ],
    "layer": "world"
  },
  "ground_tile": {
    "file": "ground.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      0.0,
      0.0
    ],
    "size": [
      64,
      64
    ],
    "origin": [
      0.0,
      0.0
    ]
  },
  "fence_tile": {
    "file": "fence_horizontal.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      32.0,
      32.0
    ],
    "size": [
      64,
      64
    ],
    "origin": [
      0.5,
      0.5
    ],
    "layer": "world"
  },
  "fence_vertical": {
    "file": "fence_vertical.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      32.0,
      32.0
    ],
    "size": [
      64,
      64
    ],
    "origin": [
      0.5,
      0.5
    ],
    "layer": "world"
  },
  "fence_corner": {
    "file": "fence_corner.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      32.0,
      32.0
    ],
    "size": [
      64,
      64
    ],
    "origin": [
      0.5,
      0.5
    ],
    "layer": "world"
  },
  "corn": {
    "file": "corn.svg",
    "source": [
      32,
      64
    ],
    "viewBox": [
      0,
      0,
      32,
      64
    ],
    "pivot": [
      16.0,
      62.0
    ],
    "size": [
      32,
      64
    ],
    "origin": [
      0.5,
      0.96875
    ],
    "layer": "world"
  },
  "command_panel": {
    "file": "sign_ui.svg",
    "source": [
      480,
      72
    ],
    "viewBox": [
      0,
      0,
      480,
      72
    ],
    "pivot": [
      0.0,
      0.0
    ],
    "size": [
      480,
      72
    ],
    "origin": [
      0.0,
      0.0
    ]
  },
  "shadow": {
    "file": "shadow.svg",
    "source": [
      48,
      16
    ],
    "viewBox": [
      0,
      0,
      48,
      16
    ],
    "pivot": [
      24.0,
      8.0
    ],
    "size": [
      40,
      13.3333
    ],
    "childSize": [
      30,
      10
    ],
    "origin": [
      0.5,
      0.5
    ]
  },
  "food_spot": {
    "file": "gather_food.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      32.0,
      55.0
    ],
    "size": [
      88,
      88
    ],
    "origin": [
      0.5,
      0.859375
    ],
    "layer": "world"
  },
  "wood_spot": {
    "file": "gather_wood.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      32.0,
      59.0
    ],
    "size": [
      80,
      80
    ],
    "origin": [
      0.5,
      0.921875
    ],
    "layer": "world"
  },
  "pantry": {
    "file": "pantry.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      32.0,
      57.0
    ],
    "size": [
      64,
      64
    ],
    "origin": [
      0.5,
      0.890625
    ],
    "layer": "world"
  },
  "rain": {
    "file": "overlay_rain.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      0.0,
      0.0
    ],
    "size": [
      64,
      64
    ],
    "origin": [
      0.0,
      0.0
    ],
    "tile": true,
    "alpha": 0.16,
    "layer": "weather"
  },
  "drought": {
    "file": "overlay_drought.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      0.0,
      0.0
    ],
    "size": [
      64,
      64
    ],
    "origin": [
      0.0,
      0.0
    ],
    "tile": true,
    "alpha": 0.65,
    "layer": "weather"
  },
  "rain_cue": {
    "file": "cue_rain.svg",
    "source": [
      32,
      32
    ],
    "viewBox": [
      0,
      0,
      32,
      32
    ],
    "pivot": [
      16.0,
      16.0
    ],
    "size": [
      24,
      24
    ],
    "origin": [
      0.5,
      0.5
    ],
    "layer": "labels"
  },
  "drought_cue": {
    "file": "cue_drought.svg",
    "source": [
      32,
      32
    ],
    "viewBox": [
      0,
      0,
      32,
      32
    ],
    "pivot": [
      16.0,
      16.0
    ],
    "size": [
      24,
      24
    ],
    "origin": [
      0.5,
      0.5
    ],
    "layer": "labels"
  },
  "sick_icon": {
    "file": "status_sick.svg",
    "source": [
      24,
      24
    ],
    "viewBox": [
      0,
      0,
      24,
      24
    ],
    "pivot": [
      12.0,
      12.0
    ],
    "size": [
      18,
      18
    ],
    "origin": [
      0.5,
      0.5
    ]
  },
  "unhappy_icon": {
    "file": "status_unhappy.svg",
    "source": [
      24,
      24
    ],
    "viewBox": [
      0,
      0,
      24,
      24
    ],
    "pivot": [
      12.0,
      12.0
    ],
    "size": [
      18,
      18
    ],
    "origin": [
      0.5,
      0.5
    ]
  },
  "uneasy_icon": {
    "file": "status_uneasy.svg",
    "source": [
      24,
      24
    ],
    "viewBox": [
      0,
      0,
      24,
      24
    ],
    "pivot": [
      12.0,
      12.0
    ],
    "size": [
      18,
      18
    ],
    "origin": [
      0.5,
      0.5
    ]
  },
  "hoedown_icon": {
    "file": "status_hoedown.svg",
    "source": [
      24,
      24
    ],
    "viewBox": [
      0,
      0,
      24,
      24
    ],
    "pivot": [
      12.0,
      12.0
    ],
    "size": [
      18,
      18
    ],
    "origin": [
      0.5,
      0.5
    ]
  },
  "warming_icon": {
    "file": "cue_warming.svg",
    "source": [
      24,
      24
    ],
    "viewBox": [
      0,
      0,
      24,
      24
    ],
    "pivot": [
      12.0,
      12.0
    ],
    "size": [
      18,
      18
    ],
    "origin": [
      0.5,
      0.5
    ]
  },
  "cold": {
    "file": "overlay_cold_snap.svg",
    "source": [
      64,
      64
    ],
    "viewBox": [
      0,
      0,
      64,
      64
    ],
    "pivot": [
      0.0,
      0.0
    ],
    "size": [
      64,
      64
    ],
    "origin": [
      0.0,
      0.0
    ],
    "tile": true,
    "alpha": 0.6,
    "layer": "weather"
  },
  "cold_cue": {
    "file": "cue_cold_snap.svg",
    "source": [
      32,
      32
    ],
    "viewBox": [
      0,
      0,
      32,
      32
    ],
    "pivot": [
      16.0,
      16.0
    ],
    "size": [
      24,
      24
    ],
    "origin": [
      0.5,
      0.5
    ],
    "layer": "labels"
  },
  "tomorrow_tag": {
    "file": "tag_tomorrow.svg",
    "source": [
      56,
      32
    ],
    "viewBox": [
      0,
      0,
      56,
      32
    ],
    "pivot": [
      0.0,
      0.0
    ],
    "size": [
      56,
      32
    ],
    "origin": [
      0.0,
      0.0
    ],
    "ui": true
  },
  "end_sign": {
    "file": "sign_endscreen.svg",
    "source": [
      420,
      240
    ],
    "viewBox": [
      0,
      0,
      420,
      240
    ],
    "pivot": [
      0.0,
      0.0
    ],
    "size": [
      420,
      240
    ],
    "origin": [
      0.0,
      0.0
    ],
    "ui": true
  },
  "restart_button": {
    "file": "button_restart.svg",
    "source": [
      140,
      40
    ],
    "viewBox": [
      0,
      0,
      140,
      40
    ],
    "pivot": [
      0.0,
      0.0
    ],
    "size": [
      140,
      40
    ],
    "origin": [
      0.0,
      0.0
    ],
    "ui": true
  },
  "restart_button_pressed": {
    "file": "button_restart_pressed.svg",
    "source": [
      140,
      40
    ],
    "viewBox": [
      0,
      0,
      140,
      40
    ],
    "pivot": [
      0.0,
      0.0
    ],
    "size": [
      140,
      40
    ],
    "origin": [
      0.0,
      0.0
    ],
    "ui": true
  },
  "background": {
    "file": "background.svg",
    "source": [
      900,
      480
    ],
    "viewBox": [
      0,
      0,
      900,
      480
    ],
    "pivot": [
      0,
      0
    ],
    "size": [
      900,
      480
    ],
    "origin": [
      0,
      0
    ]
  }
},
  layout: {
    canvas:{width:900,height:480},
    // Green clearing (rounded rectangle). The fence's posts stand on its top edge.
    ground:{x:30,y:60,width:840,height:405,radius:110},
    // Cream path ends; every path starts at the Bonfire spot.
    spots:{shelter:{x:185,y:200},fire:{x:445,y:236},food:{x:700,y:200},wood:{x:700,y:360},rest:{x:185,y:330},pantry:{x:360,y:166}},
    props:{shelter:[185,204],campfire_lit:[445,222],campfire_out:[445,222],food_spot:[820,180],pantry:[360,160],wood_spot:[830,380],lantern:[500,218]},
    corn:[[70,58],[640,58],[760,58],[18,210],[18,440],[884,250],[884,470],[300,480]],
    // Fence pieces are 64x64 tiles centred on (x,y), laid edge to edge on a
    // 64 px grid so rails join. flipX mirrors a corner/vertical for the left end.
    // y=76 puts post feet (tile y 56) at 100, on the green; tops poke above the edge.
    fence:[{key:'fence_corner',x:290,y:76,flipX:true},{key:'fence_tile',x:354,y:76},{key:'fence_tile',x:418,y:76},{key:'fence_tile',x:482,y:76},{key:'fence_corner',x:546,y:76},
      {key:'fence_vertical',x:290,y:140,flipX:true},{key:'fence_vertical',x:546,y:140}],
    labels:{pantry:[360,182],shelter:[185,48],shelterPlaces:[185,63],food:[820,92],wood:[830,404],rest:[185,424],fire:[445,246],weather:[450,24],hint:[22,451]},
    // Where Gourdlings stand. Each living Gourdling gets ONE slot number = its
    // place in villager-number order (0..7), and uses that same slot in every
    // grid, so up to 8 never overlap. A cell (50x84) fits an adult sprite
    // (40x60) plus a name label up to 48 px wide; the four grids never overlap.
    // Shelter-side activities (newborns, warming without a Bonfire) use the
    // rest grid beside the Plank shed.
    slots:{columns:4,gapX:50,gapY:84,grids:{rest:[110,290],fire:[370,310],food:[600,150],wood:[600,320]}},
    people:{footOffset:13,childFootOffset:10},
    animation:{walkMs:1000,learnMs:600,learnWaitMs:350,idleFrameMs:450,walkFrameMs:250,minTravel:.5,motionThreshold:.001,ease:'Sine.easeInOut'},
    canvasText:{color:'ink',background:'cream',padding:{x:2,y:1}},
    text:{base:12,small:10,status:9,weather:11,hint:9,labelY:19,labelMaxWidth:48,glyph:11},
    needs:{badBelow:40,warningBelow:60},
    fallback:{adultRadius:13,childRadius:10,outline:3,buildingOutline:4,eyeRadius:1.5},
    // Status icons stack down the right side of the Gourdling's own sprite,
    // so they never reach a neighbour's slot.
    icons:{x:14,y:-36,gap:17,fallbackRadius:7},
    depth:{world:100,weather:1000,labels:2000},
    weatherCue:{x:865,y:27},
    propShadow:{width:.8,height:.2},
    shadow:{alpha:.25,offsetX:4,offsetY:4}
  },
  copy: {
    ui:{title:'Gourdling Barn Dance',titleSuffix:' · Plaything Sim',eyebrow:'A LITTLE WORLD / V0.2',
      headerNote:'No AI. Just little lives and the rules they follow.',
      noSaveTitle:'Kept on this device.',noSave:'Your Homestead saves itself in this browser; reopening picks up where you left off. It starts paused.',watch:'Watch first. Intervene if you like.',
      villageStatus:'Homestead status',playback:'Playback speed',world:'The barn clearing',
      villageAria:'A little Homestead. Select a creature or its name below to inspect it.',
      pause:'Pause',normal:'1×',fast:'3×',nextDay:'Next day →',restart:'Restart',
      endTitle:'The Homestead Falls Quiet',endBody:'The last Gourdling is gone. The Homestead lasted {days} days.',restartVillage:'Restart',
      commandTitle:'A word from above',oneCommand:'One command per day',commandInput:'God command',prompt:'>',
      placeholder:'Type a command, then press Enter',queue:'Queue',cancel:'Cancel',
      feedback:'Queuing is free. Wonder is spent only when the next day starts.',
      lives:'Little lives',journal:'Homestead journal',latest:'Latest {count}',
      goal:'Left alone, the Homestead can survive, but it struggles. Your help can make it flourish.',footer:'A gourd-shaped world, living on its own.'},
    labels:{ages:{Stone:'First Age'},resources:{population:'Gourdlings',food:'Provisions',wood:'Firewood',power:'Wonder',shelter:'Plank shed',fire:'Bonfire'},
      needs:{fullness:'Fullness',warmth:'Warmth',health:'Health',safety:'Safety',happiness:'Happiness'},
      units:{food:'provisions',wood:'firewood',warmth:'warmth',happiness:'happiness'},
      life:{child:'Child',adult:'Adult',elder:'Elder'},weather:{normal:'fair',rain:'rain',drought:'dry spell',cold:'cold snap'},
      activities:{Waiting:'Waiting',Forage:'Forage','Gather wood':'Gather firewood','Warm up':'Warm up',Rest:'Rest',Newborn:'Newborn',Harvest:'Harvest a ripe plot',Plant:'Plant a plot'},
      traits:{Smart:'Smart',Scatterbrained:'Scatterbrained',Brave:'Brave',Timid:'Timid',Generous:'Generous',Grabby:'Grabby',Sociable:'Sociable',Loner:'Loner',Hardy:'Hardy',Shivery:'Shivery'},
      reactions:{Sick:'Sick',Grateful:'Grateful','Learned fire':'Learned Bonfire',Cured:'Shook it off'},
      conditions:{sick:'sick',unwell:'unwell',unhappy:'unhappy',uneasy:'uneasy'},
      // One-character marks drawn on the fallback status discs (no icon art).
      statusGlyphs:{sick_icon:'+',unhappy_icon:'~',uneasy_icon:'!',hoedown_icon:'*',warming_icon:'^'},
      commandNames:{rain:'cloud wrangle',drought:'dry spell',bless:'hoedown',plague:'sick hex','teach fire':'teach spark',harvest:'feast drop',heal:'shake off','teach farming':'teach sowing'},
      causes:{hunger:'hunger',cold:'cold',illness:'illness','poor health':'poor health','old age':'old age'},
      separators:{list:', ',detail:'; ',cause:' and ',status:' · ',traits:' and '},powerGlyph:'⚡',
      nameFallback:'Gourdling {id}',newbornName:'Neri {id}'},
    hud:{day:'Day {day}',logDay:'DAY {day}',paused:'Paused · time is still',ended:'Homestead ended',speed:'{speed}× · {seconds}s per day',
      cap:'/ {max}',population:'{count} Gourdlings',weather:'Today: {today}{remaining}',remaining:' ({days} more days)',tomorrow:'Tomorrow',tomorrowSeparator:':',
      endStats:{days:'Days lasted',peak:'Peak population',births:'Births',deaths:'Deaths',fire:'Bonfire discovered',fireYes:'yes, on day {day}',fireNo:'no',seed:'Run seed {seed}',value:': {value}'},
      fireKnown:'{fire} known · {state}',burning:'burning today',unlit:'unlit today',
      fireUnknown:'{fire} unknown · discovery {counter}/{required} (from day {day})',
      person:'#{id} · {stage} · {age} days old',gain:' · +{amount} {unit}',
      ill:'Ill · {days} illness days left for upcoming turns',lastIllDay:'Sick today · illness ends tonight',notIll:'Not ill',
      personStatus:'{shelter}: {places} places · Birth counter: {counter}/{required}',traits:'Traits: {traits}',empty:'Nobody remains in the clearing.',
      commandTitle:'{message} Cost {cost}. {cooldown}',once:'Once per run.',cooldown:'Cooldown {days} days.',known:'known',shortDay:'day {day}',
      friendlyCommand:'{label} — {words}',namedCommand:'{label} ({keyword})',queued:'Queued for day {day}: {command} · Enter another to replace',noneQueued:'Nothing queued.',
      milestone:'Milestone reached: through day {day}, with {population}+ lives and the knowledge of {fire}. Life goes on.',
      stopped:'Time has stopped.',nextIn:'Next day in {seconds}s',pausedNext:'Paused · next day in {seconds}s at 1×'},
    scene:{shelter:'PLANK SHED',shelterPlaces:'{places} places · always open',pantry:'PANTRY',food:'WILD PROVISIONS',wood:'FIREWOOD GROVE',rest:'RESTING PLACE',
      hint:'SELECT A LITTLE LIFE TO SEE ITS NEEDS',rain:'RAIN · GOOD FOR PROVISIONS, COLD FOR LITTLE LIVES',drought:'DRY SPELL · A SMALLER GATHERING',cold:'COLD SNAP · BITTER COLD, STAY WARM',normal:'A FAIR DAY IN THE CLEARING',
      fireUnknown:'BONFIRE · NOT YET KNOWN',fireLit:'BONFIRE · BURNING TODAY',fireOut:'BONFIRE KNOWN · UNLIT TODAY'},
    help:{rain:'Call {duration} days of rain: more gathered provisions, a little extra cold. Replaces a dry spell or cold snap.',
      drought:'Call {duration} days of drought: far fewer gathered provisions. Replaces rain or a cold snap.',
      bless:'Give everyone +{health} health and +{happiness} happiness. Does not cure illness.',
      plague:'Make everyone ill for {duration} days: −{damage} health and −{mood} happiness each day. This can kill Gourdlings, and deaths are permanent.',
      'teach fire':'Teach permanent Bonfire knowledge; firewood is still required to learn and burn.',
      harvest:'Add {food} provisions, up to capacity. Gourdlings still eat at the normal meal step.',
      heal:'Cure everyone\'s illness. Does not restore health.',
      'teach farming':'Teach farming: a shared field of {plots} plots appears at once. The Homestead can also discover it itself.'},
    errors:{unknown:'Unknown/unavailable command. Use: {commands}.',ended:'The Homestead has fallen quiet. Commands are no longer accepted; Restart to begin again.',
      condition:'{reason} Earliest by cooldown: day {day}; the condition must also be met.',
      once:'{command} is once per run, and it has already been used.',cooldown:'{command} is cooling down. Next allowed: day {allowed} (not day {day}).',
      power:'Not enough wonder: {command} needs {cost}; you have {power}. Next allowed by cooldown: day {day}; wonder is also required.',
      weather:'Already {command}; wait until it ends or use the opposite weather. Next cooldown-allowed day: {day}.',
      illness:'Someone is already ill. Next cooldown-allowed day: {day}; illness must end first.',
      foodFull:'The Pantry is already full of provisions. Wait until provisions are used.',fireKnown:'Bonfire is already known. Teaching it again has no effect; no next allowed day this run.',
      fireWood:'teach spark needs at least {min} firewood ({learn} to learn, {burn} to burn).',blessFull:'Everyone already has full health and happiness.',nobodyIll:'Nobody is ill, so there is nothing to shake off.',farmingKnown:'Farming is already known; teach sowing is once per run.',
      speed:'Speed must be 0 (pause), 1 or 3.',time:'Time must be a finite nonnegative number.'},
    feedback:{canApply:'{command} can apply on day {day}.',queued:'Queued {command} for day {day}. No wonder spent yet.',
      canceled:'Command canceled. No wonder spent.',reset:'A fresh Homestead. Paused at day 0.',beginAnew:'say it again to let this world go',applied:'{command} applied on day {day}. See the journal for its effect.'},
    log:{start:'Six Gourdlings begin a First Age Homestead (seed {seed}). Paused.',naturalIllness:'{name} fell ill for {days} days.',rejected:'Command rejected: {reason}',
      weather:'{command} for {duration} days including today; replaces previous weather. {effect}',rain:'More provisions, extra cold.',drought:'Lower foraging yields.',
      plague:'Everyone is ill for {duration} days including today.',blessPerson:'{name} +{health} health/+{happiness} happiness',blessEnd:'. Illness is not cured.',
      harvest:'Gift: +{food} provisions (meals still happen after work).',teach:'Bonfire knowledge learned; {wood} firewood spent. Today\'s fuel check is next.',
      command:'{command} (−{cost} wonder). {details}',death:'{name} (#{id}) died: {causes}.',ended:'The last Gourdling is gone. The Homestead falls quiet.',
      birth:'{name} was born. First work and meal tomorrow.',discovery:'The Homestead discovered the Bonfire! Spent {wood} firewood; first Bonfire fuel check is tomorrow.',
      fireLit:'Bonfire burned {wood} firewood.',fireOut:'Bonfire known, but unlit today.',fireUnknown:'Bonfire unknown.',
      day:'Work: +{food} provisions, +{wood} firewood. {meals} meals. {fire} Wonder +{power} (cap {cap}).',
      milestone:'Milestone: {population} Gourdlings alive through day {day}, and Bonfire is known. Keep watching!',
      heal:'Everyone\'s illness is shaken off. No health is restored.',sow:'Farming knowledge taught: a field of {plots} plots appears.',
      farmingDiscovery:'The Homestead discovered farming! A field of {plots} plots appears.',
      shedPaid:'The Homestead spent {wood} firewood on a second Plank shed ({places} more places); it stands tomorrow.',
      shedBuilt:'A second Plank shed stands: {places} places now. Copper and tin stone outcrops and an empty Tinker-shed site appear at the edge.'},
    // Internal developer log (design section 10): one line per trait effect,
    // at most 3 a day, plus each Gourdling's traits. Never shown to players.
    traitLog:{start:'{name} has {traits}.',birth:'{name} was born {traits}.',
      Smart:'{name} (Smart) {action} instead of {plain}: that stock was lower.',
      Scatterbrained:'{name} (Scatterbrained) wandered off and {action} instead of {plain}.',
      Brave:'{name} (Brave) {action} right through the {weather}.',
      Timid:'{name} (Timid) stayed by the {place} instead of {plain} in the {weather}.',
      Generous:'{name} (Generous) went without supper so others could eat.',
      grabbyOthers:'{name} (Grabby) was first at the Pantry; {other} went without.',
      sociableTogether:'{name} (Sociable) perked right up resting with {others} others.',
      sociableAlone:'{name} (Sociable) drooped, resting alone.',
      lonerAlone:'{name} (Loner) slipped off for a quiet rest and came back smiling.',
      lonerTogether:'{name} (Loner) fidgeted in the crowded resting circle.',
      actions:{forage:'foraged',warm:'warmed up',wood:'gathered firewood',harvest:'harvested',plant:'planted',rest:'rested'}},
    dev:{title:'Developer overlay (?dev=1)',stats:'Day {day} · seed {seed} · {population}/{cap} Gourdlings · provisions {food} · firewood {wood} · wonder {power}',
      more:'Weather {weather} ({days} left) · tomorrow {tomorrow} · Bonfire {fire} · farming {farming} · plots {plots} · shed {shed}',
      end:'Peak {peak} · births {births} · deaths {deaths} · Bonfire day {fireDay} · farming day {farmDay}',
      person:'#{id} {name}: {traits} · {activity} · full {fullness} · warm {warmth} · health {health} · happy {happiness}{ill}',ill:' · ill {days}',
      line:'D{day} {text}',none:'—',yes:'yes',no:'no',pending:'paid, stands tomorrow',built:'built'}
  }
};

// Template values are plain text. The DOM renderer escapes before using HTML.
export function format(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match,key) => values[key] === undefined ? match : String(values[key]));
}
export function t(key, values = {}) {
  const template = key.split('.').reduce((value, part) => value?.[part], THEME.copy);
  if (template === undefined || typeof template === 'object') throw new Error(`Unknown theme copy key: ${key}`);
  return format(template, values);
}
export function commandLabel(command) {
  const [primary,alias]=COMMAND_WORDS[command],label=t('labels.commandNames.'+command);
  const words=t('hud.namedCommand',{label:primary,keyword:alias});
  return label===primary?words:t('hud.friendlyCommand',{label,words});
}
export const themeColor = name => Number.parseInt(THEME.palette[name].slice(1),16);

// Expands the artist's separate-file naming convention. No atlas is required.
// A simple static mapping still works; missing idle/walk frames are optional.
export function spriteManifest(theme = THEME) {
  const result = {};
  for (const [key, url] of Object.entries(theme.sprites)) {
    if (!url) continue;
    if (!url.includes('{variant}') && !url.includes('{state}') && !url.includes('{frame}')) { result[key]=url; continue; }
    const variants = key === 'villager_child' ? [theme.creatures.childVariant]
      : [...theme.creatures.variants,theme.creatures.childVariant];
    for (const variant of new Set(variants)) for (const [state, frames] of Object.entries(theme.creatures.states)) for (const frame of frames) {
      const values = {variant,state,frame};
      result[format(theme.creatures.pattern,values)] = format(url,values);
    }
  }
  return result;
}
export function villagerTextureCandidates(v, child, walking, time) {
  const variant=child?THEME.creatures.childVariant:THEME.creatures.variants[(v.id-1)%THEME.creatures.variants.length];
  const state=walking?'walk':'idle',frames=THEME.creatures.states[state];
  const frame=frames[Math.floor(time/(walking?THEME.layout.animation.walkFrameMs:THEME.layout.animation.idleFrameMs))%frames.length];
  return [format(THEME.creatures.pattern,{variant,state,frame}),format(THEME.creatures.pattern,{variant,state:'idle',frame:THEME.creatures.states.idle[0]}),
    child?'villager_child':'villager',...(child?['villager']:[])];
}

// Geometric placeholders. These are THEME callbacks, not simulation or renderer
// code: a future one-file reskin can replace every primitive as well as sprites.
// Fallback props were drawn around these points; at() shifts each drawing to
// wherever THEME.layout.props puts that prop (call g.restore() when done).
const FALLBACK_ANCHORS={shelter:[185,204],pantry:[655,202],food_spot:[755,166],wood_spot:[745,370],campfire_out:[445,278],campfire_lit:[445,278],lantern:[505,276]};
function at(g,key){const [x,y]=THEME.layout.props[key],[ax,ay]=FALLBACK_ANCHORS[key];g.save();g.translateCanvas(x-ax,y-ay);}
function fenceBar(g,x,y,w,h){g.fillStyle(themeColor('mustard')).fillRect(x,y,w,h).lineStyle(3,themeColor('ink')).strokeRect(x,y,w,h);}

// Slot number -> canvas point in one of THEME.layout.slots.grids.
export function slotPosition(grid,slot) {
  const S=THEME.layout.slots,[x,y]=S.grids[grid];
  return {x:x+(slot%S.columns)*S.gapX,y:y+Math.floor(slot/S.columns)*S.gapY};
}

// UI switches: every HUD and panel element can be turned off from this one
// block. Defaults show everything (the current screen). A preset only lists
// the flags it changes; `?ui=<preset>` in the address previews one. The world
// canvas and the command text box are never switched off. A hidden element
// gets the `hidden` attribute (display:none), and a wrapper whose children
// are all hidden is hidden too, so nothing leaves a gap. Rules never read this.
THEME.ui = {
  defaults: {
    showHeader: true,        // eyebrow, title and header note
    showNotice: false,       // save notice strip (v0.2 saves itself, so the old no-save notice is removed)
    showStats: true,         // day box and the four stat counters
    showButtons: true,       // pause/1x/3x, next day, restart, queue, cancel
    showForecast: true,      // today's weather and tomorrow's forecast
    showWorldTitle: true,    // the "world" heading above the canvas
    showWorldCaption: true,  // fire line, "next day in" text, progress bar
    showMilestone: true,     // milestone banner
    showCommandList: true,   // command heading, command chips and help text
    showQueueStatus: true,   // "queued: ..." line under the input
    showFeedback: true,      // feedback line under the input
    showDetailPanel: true,   // roster and selected Gourdling's needs
    showJournal: true,       // day-by-day journal
    showGoalText: true,      // goal sentence in the footer
    showFooter: true,        // the rest of the footer text
    showEndScreenStats: true,// end screen numbers and seed (title, text and restart stay)
    autoPlaySpeed: null,     // null keeps the sim's start speed; a number sets it on load and restart
    enterRestarts: false,    // Enter in the command box after a wipeout restarts (new seed)
    devOverlay: false,       // developer-only stats + internal log overlay; ?dev=1 also turns it on
  },
  presets: {
    minimal: {
      showHeader:false, showNotice:false, showStats:false, showButtons:false, showForecast:false,
      showWorldTitle:false, showWorldCaption:false, showMilestone:false, showCommandList:false,
      showQueueStatus:false, showFeedback:false, showDetailPanel:false, showJournal:false,
      showGoalText:false, showFooter:false, showEndScreenStats:false,
      autoPlaySpeed: 1,      // no buttons, so days run by themselves
      enterRestarts: true,   // no Restart button on screen, so Enter restarts after a wipeout
    },
  },
  devLogLines: 30,
  fadeMs: 800,               // how long the faint "begin anew" line takes to fade           // internal-log lines shown in the developer overlay
  // Which page parts each flag hides (CSS selectors into index.html).
  targets: {
    showHeader: ['header'],
    showNotice: ['#no-save'],
    showStats: ['.day-box', '#stats'],
    showButtons: ['.playback', '#queue', '#cancel'],
    showForecast: ['#weather-summary', '#forecast'],
    showWorldTitle: ['.world-panel > .panel-heading > h2'],
    showWorldCaption: ['.world-caption', '.progress-track'],
    showMilestone: ['#milestone'],
    showCommandList: ['.command-panel > .panel-heading', '#command-list', '#command-help'],
    showQueueStatus: ['#queued'],
    showFeedback: ['#feedback'],
    showDetailPanel: ['.details-panel'],
    showJournal: ['.log-panel'],
    showGoalText: ['#goal'],
    showFooter: ['footer > [data-copy="ui.footer"]'],
    showEndScreenStats: ['#end-stats', '#end-seed'],
  },
  // Wrappers hidden when every child element is hidden; each adds
  // `ui-empty-<name>` to <html> so CSS can close the space it leaves.
  containers: {
    topline: '.topline', worldHeading: '.world-panel > .panel-heading',
    weatherLine: '.weather-line', queueRow: '.queue-row', aside: 'aside', footer: 'footer',
  },
};
// Resolve the switches: defaults, then a named preset (unknown names are
// ignored), then any explicit overrides.
export function resolveUi(preset = null, overrides = {}, ui = THEME.ui) {
  const flags = { ...ui.defaults, ...(ui.presets[preset] || {}), ...overrides };
  for (const key of Object.keys(flags)) if (!(key in ui.defaults)) delete flags[key];
  return flags;
}
// Classes for <html>: one `ui-hide-<flag>` per flag that is off.
export const uiHiddenClasses = flags => Object.keys(THEME.ui.targets).filter(k => flags[k] === false).map(k => 'ui-hide-' + k);

THEME.fallbacks = {
  base(g) { g.fillStyle(themeColor('cream')).fillRect(0,0,THEME.layout.canvas.width,THEME.layout.canvas.height); },
  groundMask(g) { const G=THEME.layout.ground;g.fillStyle(themeColor('ink')).fillRoundedRect(G.x,G.y,G.width,G.height,G.radius); },
  paths(g) { const L=THEME.layout;g.lineStyle(20,themeColor('cream'));for(const key of ['shelter','food','wood','rest','pantry'])g.beginPath().moveTo(L.spots.fire.x,L.spots.fire.y).lineTo(L.spots[key].x,L.spots[key].y).strokePath(); },
  terrain(g) {
    const c=themeColor,L=THEME.layout,G=L.ground;
    g.fillStyle(c('cream')).fillRect(0,0,L.canvas.width,L.canvas.height);
    g.fillStyle(c('green')).fillRoundedRect(G.x,G.y,G.width,G.height,G.radius);
    THEME.fallbacks.paths(g);
  },
  shelter(g) {
    const c=themeColor;at(g,'shelter');
    g.fillStyle(c('mustard')).fillRoundedRect(122,140,126,63,4);
    g.lineStyle(THEME.layout.fallback.buildingOutline,c('ink')).strokeRoundedRect(122,140,126,63,4);
    g.fillStyle(c('red')).fillTriangle(103,147,185,95,267,147);
    g.strokeTriangle(103,147,185,95,267,147);
    g.fillStyle(c('ink')).fillRoundedRect(165,159,40,45,{tl:20,tr:20,bl:0,br:0});
    for(const x of [143,164,206,227])g.lineBetween(x,149,x,199);
    g.restore();
  },
  pantry(g) {
    const c=themeColor;at(g,'pantry');g.lineStyle(3,c('ink')).fillStyle(c('mustard')).fillRoundedRect(627,174,56,28,4).strokeRoundedRect(627,174,56,28,4);
    g.fillStyle(c('red')).fillCircle(643,176,8).fillCircle(663,173,9);
    g.restore();
  },
  // Fence fallbacks match the SVG geometry (centre x,y; rails at tile y 24-31
  // and 40-47; posts at tile x 12-19 and 46-53) so pieces join on a 64 grid.
  fence_vertical(g,x,y,flip=false) {const s=flip?-1:1;fenceBar(g,x+s*(-8)-(flip?7:0),y-36,7,72);fenceBar(g,x+s*8-(flip?7:0),y-36,7,72);},
  fence_corner(g,x,y,flip=false) {
    const s=flip?-1:1;
    fenceBar(g,Math.min(x-36*s,x-1*s),y-8,35,7);fenceBar(g,Math.min(x-36*s,x+15*s),y+8,51,7);
    fenceBar(g,x+s*(-8)-(flip?7:0),y-8,7,44);fenceBar(g,x+s*8-(flip?7:0),y+8,7,28);
    fenceBar(g,x+s*(-20)-(flip?7:0),y-17,7,41);
  },
  rain_cue(g,x,y) {g.lineStyle(2,themeColor('ink')).fillStyle(themeColor('cream')).fillEllipse(x,y,26,16).strokeEllipse(x,y,26,16).lineBetween(x-6,y+12,x-9,y+18).lineBetween(x+6,y+12,x+3,y+18);},
  cold_cue(g,x,y) {g.lineStyle(2,themeColor('ink'));for(let i=0;i<3;i++){const a=i*Math.PI/3;g.lineBetween(x-Math.cos(a)*10,y-Math.sin(a)*10,x+Math.cos(a)*10,y+Math.sin(a)*10);}},
  drought_cue(g,x,y) {g.lineStyle(2,themeColor('ink')).fillStyle(themeColor('mustard')).fillCircle(x,y,10).strokeCircle(x,y,10);},
  food_spot(g) {
    const c=themeColor;at(g,'food_spot');
    g.lineStyle(THEME.layout.fallback.outline,c('ink'));
    for(const [x,y,r] of [[697,132,23],[733,126,29],[758,142,21]])g.fillStyle(c('green')).fillCircle(x,y,r).strokeCircle(x,y,r);
    for(const [x,y] of [[687,130],[705,140],[725,117],[740,137],[750,151]])g.fillStyle(c('mustard')).fillCircle(x,y,4);
    g.fillStyle(c('mustard')).fillRoundedRect(700,164,50,22,4).strokeRoundedRect(700,164,50,22,4);
    g.fillCircle(711,166,7).fillCircle(728,164,8).fillCircle(740,167,6);
    g.restore();
  },
  wood_spot(g) {
    const c=themeColor;at(g,'wood_spot');g.lineStyle(THEME.layout.fallback.outline,c('ink'));
    for(let i=0;i<3;i++)g.fillStyle(c('mustard')).fillRoundedRect(703+i*3,332+i*12,80-i*8,12,6).strokeRoundedRect(703+i*3,332+i*12,80-i*8,12,6);
    g.restore();
  },
  campfire_out(g) {
    const c=themeColor;at(g,'campfire_out');
    g.lineStyle(3,c('ink')).strokeEllipse(445,267,84,47);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;g.fillStyle(c('cream')).fillEllipse(445+Math.cos(a)*41,267+Math.sin(a)*23,13,9);}
    g.lineStyle(6,c('ink')).lineBetween(426,272,464,253).lineBetween(428,254,462,272);
    g.restore();
  },
  campfire_lit(g) {
    THEME.fallbacks.campfire_out(g);const c=themeColor;at(g,'campfire_lit');
    g.fillStyle(c('orange')).fillTriangle(426,266,446,219,464,266);
    g.lineStyle(3,c('ink')).strokeTriangle(426,266,446,219,464,266);
    g.fillStyle(c('mustard')).fillTriangle(436,266,446,238,454,266);
    g.restore();
  },
  lantern(g) {
    const c=themeColor;at(g,'lantern');g.lineStyle(3,c('ink')).lineBetween(501,277,501,216).lineBetween(501,216,516,220);
    g.fillStyle(c('mustard')).fillRoundedRect(509,229,14,20,3).strokeRoundedRect(509,229,14,20,3);
    g.lineBetween(516,220,516,229);
    g.restore();
  },
  corn(g,x,y) {
    const c=themeColor;g.lineStyle(3,c('ink')).lineBetween(x,y,x,y-36).lineBetween(x,y-10,x-12,y-22);
    g.fillStyle(c('mustard')).fillEllipse(x,y-40,12,24).strokeEllipse(x,y-40,12,24);
  },
  fence_tile(g,x,y) {
    fenceBar(g,x-36,y-8,72,7);fenceBar(g,x-36,y+8,72,7);
    fenceBar(g,x-20,y-17,7,41);fenceBar(g,x+14,y-16,7,40);
  },
  rain(g) {
    const c=themeColor;g.lineStyle(1,c('cream'),.6);
    for(let i=0;i<60;i++){const x=(i*139)%900,y=(i*79)%470;g.lineBetween(x,y,x-4,y+13);}
  },
  cold(g) {
    const c=themeColor;g.fillStyle(c('cream'),.75);
    for(let i=0;i<70;i++){const x=(i*127)%900,y=(i*61)%470;g.fillCircle(x,y,2);}
  },
  drought(g) {
    const c=themeColor;g.fillStyle(c('mustard')).fillCircle(825,40,16);g.lineStyle(2,c('ink')).strokeCircle(825,40,16);
    for(let i=0;i<12;i++){const x=70+i*63,y=310+(i%3)*35;g.lineBetween(x,y,x+10,y+7).lineBetween(x+10,y+7,x+15,y-4);}
  },
  shadow(g,x,y,width=32,height=12) {
    const L=THEME.layout.shadow;g.fillStyle(themeColor('ink'),L.alpha).fillEllipse(x+L.offsetX,y+L.offsetY,width,height);
  },
  villager(scene,child) {
    const c=themeColor,F=THEME.layout.fallback;
    const body=scene.add.circle(0,0,child?F.childRadius:F.adultRadius,c('mustard')).setStrokeStyle(F.outline,c('ink'));
    const eyes=scene.add.graphics().fillStyle(c('ink')).fillCircle(-4,-1,F.eyeRadius).fillCircle(4,-1,F.eyeRadius);
    return {body,eyes};
  },
  statusIcon(g) {
    // Without icon art: a cream disc; the view writes copy.labels.statusGlyphs on it.
    const r=THEME.layout.icons.fallbackRadius;
    g.fillStyle(themeColor('cream')).fillCircle(0,0,r).lineStyle(2,themeColor('ink')).strokeCircle(0,0,r);
  }
};

// Full UI style lives here too: replacing theme.js cannot leave old skin colors
// or fonts behind in a second stylesheet. Only system serif fallbacks are used.
THEME.css = `
/* Layout and UI colors only. Village art is in src/village-view.js. */
:root{
  color-scheme:light;
  --bg:var(--cream);
  --panel:var(--cream);
  --border:var(--ink);
  --ink:var(--ink);
  --muted:var(--green);
  --mint:var(--green);
  --orange:var(--orange);
  --red:var(--red)}
*{
  box-sizing:border-box}
body{
  margin:0;
  background:var(--bg);
  font:15px/1.5 var(--body-font);
  color:var(--ink)}
button,input{
  font:inherit}
button{
  cursor:pointer;
  border:1px solid var(--border);
  color:var(--ink);
  background:var(--ink);
  border-radius:7px;
  padding:8px 13px;
  transition:background .15s}
button:hover{
  background:var(--green)}
button:focus-visible,input:focus-visible{
  outline:2px solid var(--orange);
  outline-offset:3px}
button:disabled{
  cursor:default;
  opacity:.4}
button.active,button[aria-pressed=true]{
  background:var(--mustard);
  color:var(--ink);
  border-color:var(--mint)}
.app{
  max-width:1440px;
  margin:auto;
  padding:26px 34px 18px}
header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:18px}
.eyebrow{
  font-size:10px;
  letter-spacing:3px;
  color:var(--mint);
  margin:0 0 3px}
h1{
  font-family:var(--heading-font);
  font-size:38px;
  line-height:1.2;
  letter-spacing:-1px;
  margin:0}
h1 span{
  font-weight:normal;
  color:var(--muted)}
.header-note{
  text-align:right;
  font-size:12px;
  color:var(--muted)}
.notice{
  padding:11px 16px;
  background:var(--cream);
  border:1px solid var(--ink);
  border-radius:8px;
  font-size:12px;
  color:var(--ink)}
.notice strong{
  color:var(--ink);
  margin-right:6px}
.notice span{
  float:right;
  color:var(--mint)}
.topline{
  display:flex;
  align-items:center;
  gap:22px;
  padding:18px 0}
.day-box{
  display:flex;
  flex-direction:column;
  min-width:105px}
.day-box small{
  font-size:9px;
  color:var(--muted);
  letter-spacing:2px}
.day-box strong{
  font:27px var(--heading-font)}
.day-box span{
  font-size:11px;
  color:var(--orange)}
.stats{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:12px;
  flex:1}
.stat{
  border-left:1px solid var(--border);
  padding-left:20px}
.stat small{
  display:block;
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:1px;
  color:var(--muted)}
.stat strong{
  font-size:23px;
  font-weight:500}
.stat em{
  font-size:10px;
  font-style:normal;
  color:var(--muted);
  margin-left:4px}
.playback{
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  gap:3px}
.segmented{
  display:flex;
  gap:4px}
.segmented button{
  padding:6px 14px;
  font-size:12px}
.subtle{
  background:transparent;
  border:0;
  padding:5px 8px;
  font-size:11px;
  color:var(--muted)}
.danger{
  color:var(--red)}
main{
  display:grid;
  grid-template-columns:minmax(0,1fr) 330px;
  gap:20px}
.world-panel,.command-panel,.details-panel,.log-panel{
  border:1px solid var(--border);
  border-radius:10px;
  overflow:hidden;
  background:var(--panel)}
.panel-heading{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:12px 16px;
  gap:10px}
h2{
  font-size:13px;
  font-weight:600;
  margin:0}
.panel-heading span{
  font-size:10px;
  color:var(--muted)}
#village{
  width:100%;
  aspect-ratio:var(--canvas-ratio);
  background:var(--green)}
#village canvas{
  display:block;
  max-width:100%}
.world-caption{
  padding:9px 16px;
  display:flex;
  justify-content:space-between;
  font-size:11px;
  color:var(--muted);
  gap:10px}
.world-caption span:first-child{
  color:var(--mint)}
.progress-track{
  height:3px;
  background:var(--ink)}
#progress{
  height:100%;
  width:0;
  background:var(--orange)}
.command-panel{
  margin-top:16px}
.command-list{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  padding:0 16px 12px}
.command-chip{
  padding:5px 9px;
  font-size:11px;
  border-color:var(--ink);
  background:var(--green)}
.command-chip span{
  color:var(--orange);
  margin-left:5px}
.command-chip[disabled]{
  opacity:.6}
#command-form{
  margin:0 16px;
  display:flex;
  align-items:center;
  gap:10px;
  border:1px solid var(--ink);
  border-radius:8px;
  padding:6px 7px 6px 13px;
  background:var(--green)}
.prompt{
  color:var(--orange);
  font:20px var(--body-font)}
#command-input{
  min-width:0;
  flex:1;
  background:transparent;
  border:0;
  color:var(--cream);
  outline:none;
  padding:7px 0;
  font-size:13px}
#command-input::placeholder{
  color:var(--ink)}
#queue{
  background:var(--mustard);
  color:var(--ink);
  border:0;
  font-size:12px;
  font-weight:600}
.queue-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin:7px 16px 0;
  font-size:11px;
  color:var(--orange)}
.feedback{
  font-size:11px;
  color:var(--muted);
  min-height:32px;
  margin:0;
  padding:4px 16px 12px}
.feedback.error{
  color:var(--red)}
.feedback.faint{
  opacity:.6;
  font-style:italic;
  transition:opacity .8s ease}
.feedback.faint.fading,
#command-input.faint-placeholder.fading::placeholder{
  opacity:0}
#command-input.faint-placeholder::placeholder{
  font-style:italic;
  transition:opacity .8s ease}
.roster{
  display:flex;
  flex-wrap:wrap;
  gap:5px;
  padding:0 16px 12px}
.roster button{
  font-size:10px;
  padding:4px 9px}
#villager-detail{
  padding:0 16px 15px;
  min-height:230px}
.person-title{
  display:flex;
  align-items:baseline;
  gap:8px;
  margin:2px 0 6px}
.person-title strong{
  font:22px var(--heading-font)}
.person-title span{
  font-size:10px;
  color:var(--muted)}
.activity{
  font-size:11px;
  color:var(--orange);
  margin-bottom:11px}
.need{
  display:flex;
  align-items:center;
  gap:9px;
  margin:6px 0;
  font-size:10px}
.need span:first-child{
  width:55px;
  color:var(--muted)}
.need-track{
  flex:1;
  height:5px;
  border-radius:5px;
  background:var(--ink);
  overflow:hidden}
.need-fill{
  height:100%;
  background:var(--mint)}
.need strong{
  font-size:10px;
  font-weight:400;
  width:21px;
  text-align:right}
.person-status{
  font-size:10px;
  color:var(--muted);
  margin-top:9px}
.log-panel{
  margin-top:16px}
#log{
  list-style:none;
  margin:0;
  padding:0 16px 10px;
  max-height:310px;
  overflow-y:auto;
  scrollbar-color:var(--ink) transparent}
#log li{
  border-top:1px solid var(--border);
  padding:9px 0;
  font-size:11px;
  color:var(--ink);
  line-height:1.45}
#log small{
  color:var(--orange);
  font-size:9px;
  letter-spacing:.7px;
  display:block;
  margin-bottom:2px}
#log li[data-type=death],#log li[data-type=failure]{
  color:var(--red)}
#log li[data-type=discovery],#log li[data-type=birth],#log li[data-type=milestone]{
  color:var(--mint)}
.milestone,.end-panel{
  margin-top:16px;
  border:1px solid var(--mint);
  border-radius:10px;
  background:var(--green);
  padding:15px}
.milestone{
  font-size:13px}
.end-panel h2{
  font:25px var(--heading-font)}
.end-stats{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
  gap:8px;
  margin:10px 0}
.end-stats div{
  border-top:1px solid var(--ink);
  padding-top:4px}
.end-stats dt{
  font-size:11px;
  letter-spacing:.06em;
  text-transform:uppercase}
.end-stats dd{
  margin:0;
  font:20px var(--heading-font)}
.end-seed{
  display:block;
  margin-top:8px;
  font-size:10px;
  opacity:.75}
.weather-line{
  display:inline-flex;
  align-items:center;
  gap:12px;
  flex-wrap:wrap}
.forecast{
  font-weight:bold}
.end-panel p{
  font-size:12px;
  color:var(--muted)}
footer{
  display:flex;
  justify-content:space-between;
  gap:20px;
  padding:16px 0 0;
  font-size:10px;
  color:var(--muted)}
[hidden]{
  display:none!important}
.sr-only{
  position:absolute;
  width:1px;
  height:1px;
  overflow:hidden;
  clip:rect(0,0,0,0)}
@media(min-width:1600px){
  .app{
  padding-top:40px}
}
@media(max-width:1000px){
  .app{
  padding:20px}
.notice span{
  display:none}
main{
  grid-template-columns:minmax(0,1fr) 280px;
  gap:12px}
.stats{
  gap:8px}
.stat{
  padding-left:12px}
.topline{
  gap:12px}
.world-caption{
  font-size:10px}
.panel-heading{
  padding:12px}
.header-note{
  font-size:11px}
}
@media(max-width:760px){
  .app{
  padding:14px}
.topline{
  flex-wrap:wrap}
.stats{
  min-width:200px}
.playback{
  width:100%;
  flex-direction:row;
  justify-content:space-between}
main{
  grid-template-columns:1fr}
aside{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px}
.log-panel{
  margin-top:0}
h1{
  font-size:31px}
.notice{
  font-size:11px}
.world-caption{
  flex-wrap:wrap}
footer span:last-child{
  display:none}
}
@media(max-width:460px){
  aside{
  grid-template-columns:1fr}
.stats{
  gap:5px}
.stat{
  padding-left:8px}
.stat strong{
  font-size:19px}
.day-box{
  min-width:75px}
.stat small{
  font-size:8px}
.header-note{
  display:none}
#command-input{
  font-size:11px}
}


@media(max-width:460px){
  .stat em{
  display:block;
  margin:0;
  font-size:8px;
  line-height:1.2}
.stat strong{
  line-height:1.1}
.stat{
  min-width:0}
}


.notice{background:var(--cream);color:var(--ink)}
.command-chip{color:var(--cream)}
#command-form{background:var(--green);border:2px solid var(--cream);outline:1px solid var(--ink);background-image:var(--command-panel-art,none);background-size:100% 100%}
#command-input,.prompt{color:var(--cream)}
#command-input::placeholder{color:var(--cream);opacity:.85}
#queue{background:var(--orange);color:var(--cream)}
.milestone,.end-panel{background:var(--cream)}
button.active,button[aria-pressed=true]{background:var(--mustard);color:var(--ink);border-color:var(--ink)}

`;

THEME.css += `.notice .notice-main{float:none;color:var(--ink)}@media(max-width:1000px){.notice .notice-main{display:inline}}`;

THEME.css += `button{background:var(--ink);color:var(--cream)}.command-chip{background:var(--green)}
.subtle{background:transparent;color:var(--green)}.subtle:hover{background:var(--green);color:var(--cream)}
.command-help{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;padding:0 16px 12px;margin:0;font-size:10px;line-height:1.4;color:var(--green)}
.command-help p{margin:0}.command-help strong{color:var(--ink);font-weight:600}
@media(max-width:600px){.command-help{grid-template-columns:1fr}}`;

THEME.css += `
/* Wipeout end screen: an overlay on the clearing (mockup: endscreen_mockup.png). */
.world-stage{position:relative}
.end-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(43,33,28,.55);padding:12px}
.end-overlay[hidden]{display:none}
.end-overlay .end-panel{margin:0;width:min(460px,100%);text-align:center;color:var(--cream);background:var(--green);border:3px double var(--cream);outline:3px solid var(--ink);border-radius:6px;padding:22px 26px}
.end-overlay .end-panel h2{color:var(--cream);font:26px var(--heading-font);margin:0 0 6px}
.end-overlay .end-panel p{color:var(--cream);font-size:13px;margin:0 0 6px}
.end-overlay .end-stats{display:block;margin:6px 0 12px}
.end-overlay .end-stats div{display:block;border:0;padding:1px 0;font-size:14px}
.end-overlay .end-stats dt,.end-overlay .end-stats dd{display:inline;margin:0;font:14px var(--body-font);letter-spacing:0;text-transform:none}
.end-overlay .end-seed{color:var(--cream)}
#restart-ended{background:var(--mustard);color:var(--ink);border:3px solid var(--ink);border-radius:5px;min-width:140px;min-height:40px;font:bold 16px var(--heading-font)}
.art-end_sign .end-overlay .end-panel{border:40px solid transparent;border-image:var(--art-end_sign) 40 fill / 40px stretch;outline:0;border-radius:0;background:none;padding:4px 10px}
.art-restart_button #restart-ended{background:var(--art-restart_button) center/100% 100% no-repeat;border:0;border-radius:0;width:140px;height:40px;padding:0 0 4px}
.art-restart_button_pressed #restart-ended:hover,.art-restart_button_pressed #restart-ended:active{background-image:var(--art-restart_button_pressed);padding:3px 0 1px}
/* Tomorrow's weather: word, tag (with the weather icon in its slot), weather name. */
.forecast{display:inline-flex;align-items:center;gap:6px}
.forecast-tag{display:none}
.art-tomorrow_tag .forecast-sep{display:none}
.art-tomorrow_tag .forecast-tag{display:inline-block;position:relative;width:56px;height:32px;background:var(--art-tomorrow_tag) center/100% 100% no-repeat}
.forecast-icon{position:absolute;left:28px;top:4px;width:24px;height:24px;background:center/contain no-repeat}
.art-rain_cue .forecast-icon[data-weather=rain]{background-image:var(--art-rain_cue)}
.art-drought_cue .forecast-icon[data-weather=drought]{background-image:var(--art-drought_cue)}
.art-cold_cue .forecast-icon[data-weather=cold]{background-image:var(--art-cold_cue)}`;
THEME.css += `#command-form.has-art{border:12px solid transparent;border-image:var(--command-panel-art) 20 fill / 12px stretch;background-image:none;min-height:72px}`;

// UI switch layout: [hidden] always wins over a display rule, an empty aside
// gives the world the full width, and a command panel left with only the text
// box drops its panel frame (default screen: none of these apply).
THEME.css += `[hidden]{display:none!important}
.ui-empty-aside main{grid-template-columns:minmax(0,1fr)}
.ui-empty-topline main{margin-top:18px}
.ui-empty-topline.ui-hide-showHeader.ui-hide-showNotice main{margin-top:0}
.ui-hide-showCommandList.ui-empty-queueRow.ui-hide-showFeedback .command-panel{border:0;background:none;overflow:visible}
.ui-hide-showCommandList.ui-empty-queueRow.ui-hide-showFeedback #command-form{margin:0}`;

// Developer overlay (?dev=1) and the traits line in the detail panel.
THEME.css += `.dev-overlay{position:fixed;right:8px;bottom:8px;z-index:50;max-width:520px;max-height:60vh;overflow:auto;padding:8px 10px;background:rgba(36,30,24,.92);color:#f3e6c4;font:11px/1.45 ui-monospace,monospace;border-radius:6px;white-space:pre-wrap}
.dev-overlay .dev-title{font-weight:bold;margin-bottom:4px}
.person-traits{font-size:11px;color:var(--green);margin:-2px 0 4px}`;
