Yes — and the important thing is that Silent Hill’s scare factor wasn’t primarily “better monster AI.” A lot of it came from manipulating what the player couldn’t know.

The developers themselves described fog and darkness as a way of creating fear of something abstract and unseen, while directional sound could tell you that something was nearby before you could see it. 

That maps extremely well onto your Rahjai idea.

The Silent Hill principle for Bosom

Think of it as:

NORMAL WORLD → SLIGHTLY WRONG → UNCERTAIN → INVESTIGATE → CONFIRM

Not:

NORMAL WORLD → MONSTER JUMPS OUT

Silent Hill’s original team specifically wanted a recognizable, believable modern town and then built horror into that ordinary environment. 

That’s almost exactly what you’re building with the peaceful Japanese-inspired city.

1. Don’t hide the whole city — hide information

Your tall buildings are actually useful here.

During the day:

☀️
████████
████████
████████
  Koto

The player understands the town.

At night:

🌙
████████
████████   ← most windows dark
█████ 🟨   ← one unexplained light
████████
     🐎
     Koto

You don’t need to show a monster.

The player knows something is there but doesn’t know what.

That was a core Silent Hill technique. 

2. Make sound tell the player something their eyes don’t

This is probably the single most valuable technique to steal conceptually.

Silent Hill used directional sound so a player could hear danger coming from a particular direction before seeing it. 

For Bosom:

        [5th floor window]
             ?
             │
             │  faint scraping
             │
             ↓
Koto 🐎

The player hears:

scrape…

silence.

scrape… scrape…

But there is nothing visible.

The player starts looking upward.

That’s much stronger than spawning an enemy.

3. Your patrol system can become the horror detector

Give Koto a security patrol instrument.

Maybe the player’s lens/radio/lantern starts behaving strangely.

PATROL_SIGNAL = {
    normal: 0,
    unusual: 1,
    strong: 2,
    unknown: 3
};

But don’t say:

PARANORMAL EVENT DETECTED

Instead:

static

Then:

click

Then the horse stops.

Now the player has to decide:

Do I investigate?

That’s where your detective gameplay begins.

4. Use silence aggressively

Akira Yamaoka specifically described using sudden silence and very soft music rather than constantly hitting players with loud horror music. 

That is perfect for your cozy game.

Imagine your normal night soundtrack:

crickets
distant city music
horse footsteps
wind
occasional NPC voices

Then you enter a particular street.

Everything stops.

No music.

No insects.

No horse ambience.

Just:

clip… clop…

Then the horse stops walking.

That’s it.

Don’t immediately show anything.

5. Make the paranormal events violate ordinary rules

This is where Bosom could become really interesting.

A horror event shouldn’t necessarily be:

“Monster appears.”

It could be:

* A building has six floors at night but five during the day.
* An NPC remembers a conversation that never happened.
* A window is illuminated on an unoccupied floor.
* A horse refuses a particular street.
* A door opens when you walk away from it.
* A street sign changes.
* Someone’s shadow is facing the wrong direction.
* A person appears in two places.
* Your farm has been interacted with while you were in town.
* Sudashorn reports seeing something you didn’t.

That’s the “ordinary thing is slightly wrong” approach that Silent Hill 4’s developers explicitly discussed. 

And your 113 seed gives you something Silent Hill didn’t have

You could make anomalies persistent and reproducible.

WORLD SEED: 113
Building: 113-24-17
Floors: 5
Resident: Elder_07
ANOMALY:
Night 14
Window 5B illuminated
Resident claims no knowledge

The game remembers.

So a YouTuber can discover:

“There’s something wrong with building 113-24-17.”

And viewers can investigate it themselves.

That’s where your Animal Crossing peacefulness + GTA-scale city + detective patrol + procedural 113 world + Silent Hill-style uncertainty starts becoming a very distinctive horror format.

The key design rule I’d give Claude is:

Never make the game tell the player that something is scary. Make the game give the player enough evidence to realize something is wrong.