# Health HUD System — extracted from Bosom_Base_Model.html

Corner avatar badge + health bar, anchored bottom-right, static
(no movement/animation), driven by a simple health variable.

## CSS

```css
#hero-hud-corner {
    position: absolute;
    bottom: 6px;
    right: 6px;
    z-index: 15;
    pointer-events: none;
}
#hero-avatar-badge {
    position: relative;
    width: 66px;
    height: 76px;
}
#hero-avatar-badge img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
}
#hero-health-bar-track {
    position: absolute;
    left: 8px;
    top: 63px;
    width: 51px;
    height: 7px;
    background: rgba(0,0,0,0.45);
    border-radius: 4px;
    overflow: hidden;
}
#hero-health-bar-fill {
    height: 100%;
    width: 100%;
    background: #4ade80;
}
```

## HTML

Place inside the game screen container (sibling of the canvas). Starts
hidden; revealed once gameplay begins. `character_avatar.png` is the
separately-saved portrait asset — re-embed it as a base64 data URI or
point the `src` at wherever you host the file.

```html
<div id="hero-hud-corner" class="hidden">
    <div id="hero-avatar-badge">
        <img src="character_avatar.png" alt="Character portrait">
        <div id="hero-health-bar-track">
            <div id="hero-health-bar-fill"></div>
        </div>
    </div>
</div>
```

## JS

```js
let playerHealth = { current: 100, max: 100 };

function updateHealthBar() {
    const fill = document.getElementById('hero-health-bar-fill');
    if (!fill) return;
    const pct = Math.max(0, Math.min(100, (playerHealth.current / playerHealth.max) * 100));
    fill.style.width = pct + '%';
    fill.style.background = pct > 50 ? '#4ade80' : (pct > 20 ? '#facc15' : '#f87171');
}

function damagePlayer(amount) {
    playerHealth.current = Math.max(0, playerHealth.current - amount);
    updateHealthBar();
}

function healPlayer(amount) {
    playerHealth.current = Math.min(playerHealth.max, playerHealth.current + amount);
    updateHealthBar();
}
```

Reveal + initialize when gameplay starts (called once, from the
cinematic-intro-end handler in the base model):

```js
document.getElementById('hero-hud-corner').classList.remove('hidden');
updateHealthBar();
```

Call `damagePlayer(amount)` / `healPlayer(amount)` from anywhere in
your game logic (hazards, items, puzzle outcomes) to drive the bar —
it shifts green → yellow → red automatically as health drops.
