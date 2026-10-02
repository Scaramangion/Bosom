If you mean “How would GTA architect the same NPC system?”, the big difference is that GTA-style architecture would generally treat an NPC as a persistent world entity with AI state, rather than simply “a person who belongs at [30,15].”

Think:

Diablo-style
MAP → TILE → NPC POSITION
GTA-style
WORLD → NPC ENTITY → AI/STATE → NAVIGATION → ANIMATION → RENDER

For Bosom, I would combine the two.

Your current approach

You have:

{
    id: 'sudashorn',
    art: 'f_sudashorn',
    name: 'SUDASHORN',
    at: [30, 15],
    spouse: true,
    lines: [...]
}

A GTA-like version would turn Sudashorn into an entity definition + live entity state:

const NPC_DEFS = {
    sudashorn: {
        id: 'sudashorn',
        name: 'SUDASHORN',
        art: 'f_sudashorn',
        home: 'player_house',
        schedule: 'sudashorn_daily',
        traits: {
            spouse: true
        },
        dialogue: [
            'Oh! You are the one living out past the fence?',
            'I walked out to Rahjai at sunset yesterday.',
            'You always smell like rain and hay. I like it.',
            'Stay for a little while?'
        ]
    }
};

Then create a live instance:

const npc = {
    defId: 'sudashorn',
    map: 'overworld',
    x: 30,
    y: 15,
    state: 'idle',
    activity: 'farm',
    target: null,
    facing: 'south',
    speed: 1,
    scheduleState: 'morning'
};

Now the definition says who she is, while the instance says what she is doing right now.

⸻

GTA-style scheduling

Instead of:

at: [30, 15]

you could give her a daily schedule:

const SCHEDULES = {
    sudashorn_daily: [
        {
            from: 6,
            to: 8,
            activity: 'home',
            location: 'player_house'
        },
        {
            from: 8,
            to: 12,
            activity: 'farm',
            location: 'east_field'
        },
        {
            from: 12,
            to: 14,
            activity: 'lunch',
            location: 'tellhouse'
        },
        {
            from: 14,
            to: 18,
            activity: 'animals',
            location: 'barn'
        },
        {
            from: 18,
            to: 21,
            activity: 'home',
            location: 'player_house'
        },
        {
            from: 21,
            to: 6,
            activity: 'sleep',
            location: 'player_house'
        }
    ]
};

Then the game asks:

function getCurrentSchedule(npc, hour) {
    return SCHEDULES[npc.defId + '_daily']
        ?.find(s =>
            hour >= s.from &&
            hour < s.to
        );
}

Now Sudashorn isn’t permanently glued to [30,15].

She lives in the world.

⸻

Navigation

This is where your tile system becomes important.

Suppose the schedule says:

location: 'barn'

The game finds the barn:

const destination = LOCATIONS.barn;

Then the NPC asks the navigation system for a route:

const path = findPath(
    npc.x,
    npc.y,
    destination.x,
    destination.y
);

For your game, this could initially be A* over your existing map grid.

SUDASHORN
   ↓
"Go to barn"
   ↓
A* pathfinding
   ↓
[30,15]
   ↓
[29,15]
   ↓
[28,15]
   ↓
[28,16]
   ↓
[28,17]
   ↓
BARN

That’s much closer to the behavior people associate with GTA pedestrians.

⸻

Then comes the AI state machine

Instead of one enormous:

folkWhere()

you’d have:

const NPC_STATES = {
    IDLE: 'idle',
    WALK: 'walk',
    WORK: 'work',
    TALK: 'talk',
    EAT: 'eat',
    SLEEP: 'sleep',
    FLEE: 'flee',
    FOLLOW: 'follow',
    INVESTIGATE: 'investigate'
};

And:

function updateNPC(npc, dt) {
    const schedule = getCurrentSchedule(npc, h);
    if (!schedule) {
        npc.state = 'idle';
        return;
    }
    if (npc.activity !== schedule.activity) {
        npc.activity = schedule.activity;
        const destination =
            LOCATIONS[schedule.location];
        npc.path = findPath(
            npc.x,
            npc.y,
            destination.x,
            destination.y
        );
        npc.state = 'walk';
    }
    updateNPCState(npc, dt);
}

Then:

function updateNPCState(npc, dt) {
    switch (npc.state) {
        case 'walk':
            updateNPCWalking(npc, dt);
            break;
        case 'work':
            updateNPCWork(npc, dt);
            break;
        case 'talk':
            updateNPCTalk(npc, dt);
            break;
        case 'sleep':
            updateNPCSleep(npc, dt);
            break;
    }
}

That’s dramatically cleaner than having everything inside folkWhere().

⸻

And this is where GTA gets really interesting

A GTA-like system doesn’t need every NPC doing expensive AI constantly.

You can divide the world into:

                PLAYER
                  │
          ┌───────┴───────┐
          ↓               ↓
      NEARBY NPCs      DISTANT NPCs
          │               │
      FULL AI          SIMULATION
          │               │
 animations/pathing     schedule only
 collision              no animation
 dialogue               no rendering

For Bosom, that’s extremely useful.

If Sudashorn is two screens away:

npc.simulated = true;

You might only update:

npc.location = 'barn';
npc.activity = 'animals';

When the player approaches:

npc.simulated = false;

and the game materializes her at the appropriate location.

⸻

Your Sister could use the same system

Instead of special logic buried inside:

folkWhere()

you could have:

const sister = {
    defId: 'sister',
    state: 'mysterious',
    visibility: 'conditional',
    spawnRules: {
        nightOnly: true,
        weather: 'fog'
    }
};

Then an event system controls her:

if (
    night &&
    wx === 'fog' &&
    distanceToPlayer() < 8
) {
    spawnNPC('sister');
}

And when she disappears:

despawnNPC('sister');
showFluidMessage(
    "...she's gone. There are no footprints.",
    2600
);

That’s cleaner because the NPC system handles NPCs and the event system handles supernatural events.

⸻

The architecture I’d use for Bosom

Not literally GTA’s proprietary code, but the same architectural idea:

                 BOSOM WORLD
                     │
                WORLD DATABASE
                     │
        ┌────────────┼─────────────┐
        ↓            ↓             ↓
      MAP          NPC DEFS      LOCATIONS
        │            │             │
        ↓            ↓             ↓
    TILE DATA    NPC INSTANCES   BARN/HOME/
        │            │           TELLHOUSE
        │            ↓
        │         SCHEDULE
        │            │
        │            ↓
        │        AI STATE
        │            │
        └──────→ PATHFINDING
                     │
                     ↓
                  ANIMATION
                     │
                     ↓
                  RENDERER

And the really nice part is that your existing FOLK array doesn’t have to be discarded.

It becomes the equivalent of an NPC database:

FOLK
 ↓
NPC_DEFS
 ↓
NPC_INSTANCE
 ↓
SCHEDULE
 ↓
AI
 ↓
PATH
 ↓
ANIMATION
 ↓
ISOMETRIC RENDER

That’s the direction I’d take if you want Bosom to move from “NPCs placed on a map” toward “NPCs actually living in the world.”