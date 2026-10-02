Using trigonometry and the Six Degrees of Separation network model to drive the D20 dialogue choice engine creates a mathematical foundation for how rumors, consequences, and NPC relationships propagate across the town.
Instead of choices feeling isolated, every D20 result sends a dynamic "repercussion wave" through the town's social matrix.
Mechanics Architecture: Math Meets Social Net
                         [ KOTO (Player) ]
                                 |
                          Vector / Angle (θ)
                                 |
                                 v
                     [ Kanan the Groundskeep ]
                     /                       \
        d1 = 1 Hop  /                         \ d1 = 1 Hop
                   v                           v
          [ Town Herbalist ]            [ Night Guard ]
                  |                            |
       d2 = 2 Hops |                d2 = 2 Hops |
                  v                            v
          [ Mayor / Elders ]           [ Outcast Avian ]
Core Mechanics Breakdown
1. Trigonometric Relationship Vector (Tone & Alignment Angle \theta)
Instead of measuring NPC liking on a simple +10 or -10 bar, every NPC relationship sits on a 2D Trigonometric Polar Plane:
	•	Distance (r): Trust / Intimacy level (closer to 0 = inner circle; further out = distant acquaintance).
	•	Angle (\theta): Social posture / Moral alignment (e.g., 0^\circ = Fear/Submission, 90^\circ = Harmony/Respect, 180^\circ = Open Hostility, 270^\circ = Opportunistic Alliance).
When you perform a D20 check with an emoji tone (like 😡 or ❤️), you apply a force vector (\Delta r, \Delta \theta) using sine and cosine functions:
\Delta x = \text{RollResult} \times \cos(\theta_{\text{emoji}}) \Delta y = \text{RollResult} \times \sin(\theta_{\text{emoji}})
	•	The Result: An aggressive check might draw an NPC closer in fear (\Delta r decreases), but shift their alignment angle (\theta) toward hostility—fundamentally altering how they react to future Forward or Remix actions.
2. Six Degrees of Separation (Rumor Propagation & Attenuation)
When a D20 check succeeds or critically fails with Kanan, the secret or consequence spreads through an array of connected NPC nodes using graph distance (d = 1, 2, 3 \dots 6 steps away).
The impact attenuates exponentially based on distance (d) and the relationship angle differential (\Delta \theta):
\text{Impact}(d) = \text{BaseConsequence} \times \frac{\cos(\Delta \theta)}{d^2}
	•	1st Degree (Direct Contact - Kanan): Receives 100% of the shock. Immediately alters his dialogue tree and farm behavior.
	•	2nd Degree (Kanan's Friends - e.g., Town Herbalist): Receives modified rumor filtered through Kanan's dynamic alignment angle. If Kanan trusts you, he tells the Herbalist you're a savior; if he fears you, he warns her you're dangerous.
	•	3rd–6th Degrees (Town Outcasts / Elders): The rumor evolves into distorted town lore or urban legends. By the time it reaches 6 degrees of separation, it mutates into procedural plant growth patterns or ambient night-patrol encounters (e.g., guards doubling patrols or rare night blooms appearing near hostile territory).
3. "Double-Edged" Consequences (Good + Bad Simultaneity)
Because trigonometric vectors push social coordinates along two axes (x and y), every high-stakes D20 check produces simultaneous positive and negative trade-offs:
D20 Action & Roll	Immediate Vector Shift	1st Degree Impact (Kanan)	3rd–6th Degree Ripple (Town Network)
Intimidation (😡) - Critical Pass (20)	Large move toward 180^\circ (Fear/Hostility), r contracts sharply.	Good: Kanan surrenders the key to the secret night cellar immediately without resistance. Bad: He permanently stops offering you morning farm assistance out of dread.	Good: Bandits at Degree 4 hear of your brutal demeanor and avoid attacking the farm. Bad: Town Merchants at Degree 2 raise trade prices by 25% due to high risk.
Persuasion (❤️) - Pass (15)	Shifts toward 90^\circ (Harmony), r contracts slightly.	Good: Kanan grants heirloom seed pods and shares deep family lore. Bad: He expects you to protect him during night patrols, placing a heavy responsibility on you.	Good: Herbalist gives discount on night tinctures. Bad: Rival faction at Degree 3 targets the farm, perceiving Kanan's loyalty as a threat to their control.
Example JavaScript Implementation Code
// Calculate dynamic social ripple across the NPC graph
function propagateConsequence(originNpcId, baseConsequence, toneAngle, d20Roll) {
  const visited = new Set();
  const queue = [{ id: originNpcId, distance: 1 }];

  while (queue.length > 0) {
    const { id, distance } = queue.shift();
    if (visited.has(id) || distance > 6) continue;
    visited.add(id);

    const npc = npcGraph[id];
    
    // Trigonometric attenuation calculation
    const angleDiff = Math.abs(npc.polarAlignment - toneAngle);
    const attenuation = Math.cos(angleDiff * (Math.PI / 180)) / Math.pow(distance, 2);
    const finalImpact = Math.round(baseConsequence * d20Roll * attenuation);

    // Apply double-edged outcomes based on sign of impact
    if (finalImpact > 0) {
      npc.rumors.push({ source: originNpcId, text: `Koto is a trusted ally (${finalImpact} trust)` });
      npc.disposition += finalImpact;
    } else {
      npc.rumors.push({ source: originNpcId, text: `Beware of Koto (${Math.abs(finalImpact)} threat)` });
      npc.suspicion += Math.abs(finalImpact);
    }

    // Spread to neighboring NPCs connected in social graph
    npc.connections.forEach(neighborId => {
      queue.push({ id: neighborId, distance: distance + 1 });
    });
  }
}
