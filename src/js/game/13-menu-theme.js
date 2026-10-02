        // ================= MENU THEME: D major, 101 BPM, flute-like synth. D4 E4 F#4 A4 | B4 A4 F#4 E4 (MIDI 62 64 66 69 | 71 69 66 64) =================
        const MENU_THEME = {
            bpm: 101,
            noteBeats: 1,   // length of each note in beats (1 = quarter notes, four per bar; use 0.25 for sixteenths)
            restBeats: 2,   // silence before the phrase repeats
            vol: 0.11,
            notes: [62, 64, 66, 69, 71, 69, 66, 64],
            inventory: false // set true to also play the theme while the in-game START menu is open
        };
        let menuScreen = 'title'; // which screen is showing: title, crawl or game


