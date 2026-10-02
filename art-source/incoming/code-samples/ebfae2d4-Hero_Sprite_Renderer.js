/**
 * Hero Player Sprite Renderer
 * Draws the 8-bit Hero sprite (Elf ears, blue tunic, red cape, 2-tone dreadlocks)
 * onto any HTML5 2D Canvas context.
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
 * @param {number} x - Target X coordinate on canvas
 * @param {number} y - Target Y coordinate on canvas
 * @param {string} dir - Direction facing ('down', 'up', 'left', 'right')
 * @param {number} frame - Animation frame index for walking legs
 * @param {Object} [customColors] - Optional color overrides
 */
function drawPlayerSprite(ctx, x, y, dir = 'down', frame = 0, customColors = {}) {
    const pal = {
        heroHair: customColors.heroHair || '#2563eb', // Mid-tone navy blue
        heroCape: customColors.heroCape || '#dc2626', // Red cape
        skinTone: customColors.skinTone || '#7c4a2d', // Warm brown skin
        tunic: customColors.tunic || '#2563eb',       // Blue tunic
        pants: customColors.pants || '#334155'         // Dark slate pants
    };

    ctx.save();
    ctx.translate(x, y);

    // 1. Ground Drop Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(3, 14, 10, 2);

    // 2. Head & Face Skin Tone
    ctx.fillStyle = pal.skinTone;
    ctx.fillRect(4, 3, 8, 6);

    // 3. Pointy Elf Ears (Left & Right)
    ctx.fillStyle = pal.skinTone;
    ctx.fillRect(1, 4, 3, 2);  // Left ear base
    ctx.fillRect(12, 4, 3, 2); // Right ear base
    ctx.fillRect(1, 3, 1, 1);  // Left ear tip point
    ctx.fillRect(14, 3, 1, 1); // Right ear tip point

    // 4. Eyes (Whites & Pupils)
    ctx.fillStyle = '#ffffff';
    if (dir === 'down' || dir === 'left') ctx.fillRect(5, 5, 2, 2);
    if (dir === 'down' || dir === 'right') ctx.fillRect(9, 5, 2, 2);
    ctx.fillStyle = '#0f172a';
    if (dir === 'down' || dir === 'left') ctx.fillRect(6, 5, 1, 2);
    if (dir === 'down' || dir === 'right') ctx.fillRect(9, 5, 1, 2);

    // 5. Tunic Torso
    ctx.fillStyle = pal.heroHair;
    ctx.fillRect(4, 8, 8, 5);

    // 6. Belt Accent
    ctx.fillStyle = pal.heroCape;
    ctx.fillRect(4, 11, 8, 2);

    // 7. Animated Walking Legs (Toggles back and forth when moving)
    ctx.fillStyle = pal.pants;
    const legOffset = (Math.floor(frame) % 2 === 1) ? 1 : 0;
    ctx.fillRect(4, 13 - legOffset, 3, 3);
    ctx.fillRect(9, 13 + legOffset, 3, 3);

    // 8. Flowing Red Cape (Adapts to facing direction)
    ctx.fillStyle = pal.heroCape;
    if (dir === 'down') {
        ctx.fillRect(3, 8, 2, 6);
        ctx.fillRect(11, 8, 2, 6);
    } else if (dir === 'up') {
        ctx.fillRect(3, 7, 10, 7);
    } else if (dir === 'left') {
        ctx.fillRect(10, 7, 3, 7);
    } else if (dir === 'right') {
        ctx.fillRect(3, 7, 3, 7);
    }

    // 9. Two-Tone Dreadlocks Hair Layers
    const darkHair = '#0f172a';      // Dark shadow roots
    const midHair = pal.heroHair;    // Main blue loc body
    const highlightHair = '#38bdf8'; // Bright cyan/blue loc tips

    // Crown Base Hair Block
    ctx.fillStyle = midHair;
    ctx.fillRect(3, 1, 10, 4);

    // Left Dreadlock Spike
    ctx.fillStyle = darkHair;
    ctx.fillRect(2, -2, 3, 4);
    ctx.fillStyle = highlightHair;
    ctx.fillRect(2, -2, 2, 2);

    // Center Top Crown Dreadlock
    ctx.fillStyle = midHair;
    ctx.fillRect(6, -3, 3, 5);
    ctx.fillStyle = highlightHair;
    ctx.fillRect(7, -3, 2, 2);

    // Right Dreadlock Spike
    ctx.fillStyle = darkHair;
    ctx.fillRect(10, -2, 3, 4);
    ctx.fillStyle = highlightHair;
    ctx.fillRect(11, -2, 2, 2);

    // Side Hanging Locs
    ctx.fillStyle = midHair;
    ctx.fillRect(0, 1, 3, 4);
    ctx.fillRect(13, 1, 3, 4);
    ctx.fillStyle = highlightHair;
    ctx.fillRect(0, 1, 1, 2);
    ctx.fillRect(15, 1, 1, 2);

    // Directional Front Bangs (Facing Down / Left / Right)
    if (dir === 'down' || dir === 'left' || dir === 'right') {
        ctx.fillStyle = darkHair;
        ctx.fillRect(4, 2, 2, 3);
        ctx.fillRect(8, 2, 2, 3);
        ctx.fillStyle = highlightHair;
        ctx.fillRect(4, 4, 1, 1);
        ctx.fillRect(9, 4, 1, 1);
    }

    // Directional Back Loc Coverage (Facing Up)
    if (dir === 'up') {
        ctx.fillStyle = midHair;
        ctx.fillRect(3, 2, 10, 6);
        ctx.fillStyle = darkHair;
        ctx.fillRect(4, 4, 8, 3);
        ctx.fillStyle = highlightHair;
        ctx.fillRect(5, -1, 2, 2);
        ctx.fillRect(9, -1, 2, 2);
    }

    ctx.restore();
}