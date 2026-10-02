        // ===== Guard targets: a generic "defend this from the wolves" mechanic. =====
        // Any feature can call registerGuardTarget() to plant something wolves will stalk and bite instead of
        // (or as well as) the player, with its own HP bar and a callback for when it finally goes down. Nothing
        // is registered by default — this is just the plumbing, ready for whatever needs defending later.
        const GUARD_TARGETS = new Map();
        function registerGuardTarget(opts) {
            const t = Object.assign({ hp: 100, maxHp: 100, radius: 6, alive: true, name: 'It', draw: null, onDamaged: null, onDestroyed: null }, opts);
            t.hp = t.maxHp; // opts.hp, if given, only sets the ceiling
            if (typeof opts.hp === 'number') t.hp = t.maxHp = opts.hp;
            GUARD_TARGETS.set(t.id, t);
            return t;
        }
        function unregisterGuardTarget(id) { GUARD_TARGETS.delete(id); }
        function guardTargetsOnMap(map) {
            const out = [];
            for (const t of GUARD_TARGETS.values()) if (t.alive && t.map === map) out.push(t);
            return out;
        }
        function damageGuardTarget(t, amount, attacker) {
            if (!t.alive) return;
            t.hp = Math.max(0, t.hp - amount);
            if (t.onDamaged) t.onDamaged(t, amount, attacker);
            if (t.hp <= 0) {
                t.alive = false;
                if (t.onDestroyed) t.onDestroyed(t);
            }
        }


