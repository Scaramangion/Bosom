        // ================= SECURITY ROSTER: the other heroes, for hire =================
        // Koto is the one you play. Everyone else who used to be an outfit is now a person in this array: someone you can hire as
        // city security. Once hired, they walk their beat through the town in real time, on their shift, while you're out on your
        // own patrol. For now this is the record (who they are, what they cost, when and where they walk); the walking comes next.
        // Each entry keeps its outfit id, so their sprite art is ready the day they step out.
        const HIRE_ROSTER = [
            { id: 'rahjai',  name: 'RAHJAI',         outfit: 'rahjai',  role: 'city security', wage: 4, shift: 'night', beat: 'the fountain square and the lantern house', hired: false, note: 'Swordsman. Draws on wolves; the strongest guard you can hire.' },
            { id: 'kael',    name: 'KAEL',           outfit: 'kael',    role: 'city security', wage: 3, shift: 'dusk',  beat: 'the market street, east to west',             hired: false, note: 'Fast. Runs down whatever he sees.' },
            { id: 'basic',   name: 'BASIC STANDARD', outfit: 'basic',   role: 'city security', wage: 2, shift: 'day',   beat: 'the town gates and the road out',             hired: false, note: 'Steady and cheap. Keeps the gates.' },
            { id: 'starter', name: 'STARTER',        outfit: 'starter', role: 'city security', wage: 1, shift: 'day',   beat: 'the homestead fields',                        hired: false, note: 'Green. Walks the fields by the farm.' },
            { id: 'child',   name: 'THE CHILD',      outfit: 'child',   role: 'lookout',       wage: 1, shift: 'dusk',  beat: 'the rooftops round the square (lookout only)', hired: false, note: 'Too young to fight. Shouts when something moves.' }
        ];
        function rosterOf(outfit) { return HIRE_ROSTER.find(r => r.outfit === outfit) || null; }
        function rosterSay(outfit) { const r = rosterOf(outfit); if (r) showFluidMessage(r.name + ' is on the security roster now: ' + r.shift + ' shift, ' + r.beat + '. Hiring opens soon.', 2600); }
