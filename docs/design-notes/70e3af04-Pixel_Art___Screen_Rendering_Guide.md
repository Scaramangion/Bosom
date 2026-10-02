# How to Create Retro Game Boy Visuals & Pixel Art in HTML5 Canvas

This guide explains the exact code techniques used to create the low-res CRT Game Boy screen effect and the pixel art algorithm for the character's dreadlock hair.

---

## Part 1: Achieving the Retro Game Boy Screen Look

Creating an authentic 8-bit look relies on combining **ultra-low canvas resolution**, **integer scaling**, **CSS pixel rendering rules**, and a **scanline CRT overlay**.

### 1. Low Native Canvas Resolution
Instead of making the canvas match the screen dimensions (e.g. $1920 \times 1080$), set the internal HTML canvas buffer to the exact original Game Boy resolution: $160 \times 144$ pixels.

```javascript
// Set native Game Boy render resolution
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const GAME_WIDTH = 160;
const GAME_HEIGHT = 144;

canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;
```

When stretched using CSS (`w-full h-full`), modern browsers will attempt to blur the pixels (bilinear filtering). 

### 2. Disabling Pixel Smoothing (Sharp Crisp Pixels)
To stop the browser from blurring low-resolution graphics when scaling up, apply crisp-edge image rendering rules in both CSS and JavaScript:

**CSS:**
```css
.pixel-art {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    -ms-interpolation-mode: nearest-neighbor;
}
```

**JavaScript:**
```javascript
// Disables anti-aliasing on canvas drawings
ctx.imageSmoothingEnabled = false;
```

---

### 3. CRT Scanline Overlay Effect
To recreate the look of a physical LCD or CRT screen, place a semi-transparent CSS gradient overlay directly on top of the canvas element:

```css
.scanlines {
    position: absolute;
    inset: 0;
    /* Draws alternating dark horizontal lines every 4 pixels */
    background: linear-gradient(
        rgba(18, 16, 16, 0) 50%, 
        rgba(0, 0, 0, 0.25) 50%
    );
    background-size: 100% 4px;
    pointer-events: none; /* Allows click/touch through to canvas */
    opacity: 0.2;
}
```

---

### 4. Color Palette System
The classic Game Boy used a 4-shade green display, while modern color versions used targeted color palettes. We model palettes using simple JavaScript object maps and dynamic variables:

```javascript
const PALETTES = {
    blue: {
        bg: '#7dd3fc',
        light: '#bae6fd',
        midLight: '#0284c7',
        midDark: '#1e3a8a',
        dark: '#030712',
        heroHair: '#2563eb',
        heroCape: '#dc2626'
    },
    gb: {
        bg: '#8bac0f',
        light: '#9bbc0f',
        midLight: '#8bac0f',
        midDark: '#306230',
        dark: '#0f380f',
        heroHair: '#0f380f',
        heroCape: '#306230'
    }
};

let currentPalette = PALETTES.blue;
```

---

### 5. Camera Viewport Tracking Math
To keep the character centered in the frame while moving across a larger map, translate the canvas rendering origin before drawing the map tiles:

$$\text{cam}_x = \max\left(0, \min\left(\text{player}_x - \frac{W}{2} + \frac{S}{2}, \text{Map}_W - W\right)\right)$$

Where $W$ is the screen width ($160\text{px}$) and $S$ is the tile size ($16\text{px}$).

```javascript
// Translate context so camera follows player
const camX = Math.max(0, Math.min(player.pixelX - GAME_WIDTH / 2 + TILE_SIZE / 2, MAP_COLS * TILE_SIZE - GAME_WIDTH));
const camY = Math.max(0, Math.min(player.pixelY - GAME_HEIGHT / 2 + TILE_SIZE / 2, MAP_ROWS * TILE_SIZE - GAME_HEIGHT));

ctx.save();
ctx.translate(-Math.floor(camX), -Math.floor(camY));

// ... Draw tiles and player sprite here ...

ctx.restore();
```

---

## Part 2: Building the 8-Bit Dreadlocks Pixel Hair

Pixel art is drawn programmatically pixel-by-pixel using `ctx.fillRect(x, y, width, height)`. To give dreadlocks volume, realistic structure, and depth, we use a **three-tier color layering strategy**.

### Three-Color Layer Strategy
1. **Base Shadow (`darkHair` / `#0f172a`)**: Sets the silhouette and outline under each strand.
2. **Main Body (`midHair` / `#2563eb`)**: Fills the main structure of the dreadlock locs.
3. **Tip Highlights (`highlightHair` / `#38bdf8`)**: Placed at the tips and edges to simulate light reflecting off individual locs.

---

### Step-by-Step Code Construction of the Hair

```javascript
function drawDreadlockHair(ctx, dir) {
    // Color Definitions
    const darkHair = '#0f172a';       // Deep shadow base
    const midHair = currentPalette.heroHair; // Navy blue main body
    const highlightHair = '#38bdf8';  // Vibrant cyan tip highlights

    // 1. Central Hair Base on top of the head
    ctx.fillStyle = midHair;
    ctx.fillRect(3, 1, 10, 4);

    // 2. High Left Dreadlock Spike
    // Draw shadow backing box
    ctx.fillStyle = darkHair;
    ctx.fillRect(2, -2, 3, 4);
    // Overlay tip highlight
    ctx.fillStyle = highlightHair;
    ctx.fillRect(2, -2, 2, 2);

    // 3. Center Crown Dreadlock Spike (Tallest strand)
    ctx.fillStyle = midHair;
    ctx.fillRect(6, -3, 3, 5);
    ctx.fillStyle = highlightHair;
    ctx.fillRect(7, -3, 2, 2);

    // 4. High Right Dreadlock Spike
    ctx.fillStyle = darkHair;
    ctx.fillRect(10, -2, 3, 4);
    ctx.fillStyle = highlightHair;
    ctx.fillRect(11, -2, 2, 2);

    // 5. Far Side Locs (Drapes down past ears)
    ctx.fillStyle = midHair;
    ctx.fillRect(0, 1, 3, 4);  // Left side
    ctx.fillRect(13, 1, 3, 4); // Right side
    ctx.fillStyle = highlightHair;
    ctx.fillRect(0, 1, 1, 2);
    ctx.fillRect(15, 1, 1, 2);

    // 6. Directional Front Bang Locs (Facing Down/Left/Right)
    if (dir === 'down' || dir === 'left' || dir === 'right') {
        ctx.fillStyle = darkHair;
        ctx.fillRect(4, 2, 2, 3);
        ctx.fillRect(8, 2, 2, 3);
        
        ctx.fillStyle = highlightHair;
        ctx.fillRect(4, 4, 1, 1);
        ctx.fillRect(9, 4, 1, 1);
    }

    // 7. Directional Back Hair Volume (Facing Up)
    if (dir === 'up') {
        ctx.fillStyle = midHair;
        ctx.fillRect(3, 2, 10, 6);
        ctx.fillStyle = darkHair;
        ctx.fillRect(4, 4, 8, 3);
        ctx.fillStyle = highlightHair;
        ctx.fillRect(5, -1, 2, 2);
        ctx.fillRect(9, -1, 2, 2);
    }
}
```

---

## Summary of Pixel Grid Layout (Top View Coordinates)

Below is the relative pixel coordinate layout for the hair unit grid ($16 \times 16$ tile canvas frame):

| Y Coordinate | X Range | Purpose | Color Layer |
| :--- | :--- | :--- | :--- |
| $Y = -3$ | $X = 6..8$ | Top Center Crown Loc | `midHair` + `highlight` |
| $Y = -2$ | $X = 2..4, 10..12$ | Left & Right Spikes | `darkHair` + `highlight` |
| $Y = 1$ | $X = 0..2, 13..15$ | Side Ear Overhang Locs | `midHair` + `highlight` |
| $Y = 2..4$ | $X = 4..5, 8..9$ | Front Forehead Bangs | `darkHair` + `highlight` |

By layering these colored `fillRect` calls, the browser renders crisp 8-bit dreadlocks without requiring external image files!