        // ================= CRASH GUARD: what to do (and what to remember) when the phone pulls the rug =================
        // A script error already shows the red box (boot-check). Two failures don't throw:
        //  1. the phone takes the GPU back (WebGL context lost): the 3D layer goes blank and the game looks frozen. We drop to the
        //     plain 2D view so play carries on, and say so.
        //  2. the phone closes the whole page to free memory: nothing can run, so every 2 s we note where he was. If the next
        //     start finds that note without a clean exit, it says what was happening when the page died.
        // A third, rarer one: the frame loop stops ticking while the page is visible. The watchdog reports it.
        const CRASH = { KEY: 'bosom-alive', tick: 0, lastWrite: 0, said: false };
        function crashState(clean) {
            let o = '?'; try { o = heroHD.outfit; } catch (e) {}
            return { t: Date.now(), clean: !!clean, build: BUILD_VERSION, map: currentMapName, x: player.gridX, y: player.gridY, gs: gameState,
                outfit: o, paper: !!FX_GL.heroPaper, gl: !!FX_GL.ok, moving: !!player.isMoving, horse: !!HORSE.mounted, view: VIEW.mode };
        }
        function crashWrite(clean) { try { if (gameStarted) localStorage.setItem(CRASH.KEY, JSON.stringify(crashState(clean))); } catch (e) {} }
        function crashTick() { // called from the frame loop
            const now = performance.now(); CRASH.tick = now;
            if (now - CRASH.lastWrite > 2000) { CRASH.lastWrite = now; crashWrite(false); }
        }
        (function crashBoot() {
            let last = null; try { last = JSON.parse(localStorage.getItem(CRASH.KEY) || 'null'); } catch (e) {}
            if (last && !last.clean && Date.now() - last.t < 30 * 60 * 1000 && window.__bosomShowError) {
                window.__bosomShowError('Last time, the page closed by itself (usually the phone running out of memory).\n  build ' + last.build + ', ' + last.map + ' (' + last.x + ',' + last.y + '), ' +
                    (last.moving ? 'walking' : 'standing') + ', outfit ' + last.outfit + ', paper hero ' + (last.paper ? 'on' : 'off') + ', 3D ' + (last.gl ? 'on' : 'off') + (last.horse ? ', riding' : '') + (last.view && last.view !== 'normal' ? ', view ' + last.view : ''));
            }
            try { localStorage.removeItem(CRASH.KEY); } catch (e) {}
            const bye = () => crashWrite(true); // leaving on purpose (switching apps, closing the tab) is not a crash
            window.addEventListener('pagehide', bye); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') bye(); else CRASH.tick = performance.now(); });
            setInterval(() => { // the frame loop stopped while the page is on screen
                if (!gameStarted || document.visibilityState !== 'visible' || CRASH.said || !CRASH.tick) return;
                if (performance.now() - CRASH.tick > 5000 && window.__bosomShowError) { CRASH.said = true; const s = crashState(false); window.__bosomShowError('The game stopped drawing (no frame for 5 s) at ' + s.map + ' (' + s.x + ',' + s.y + '), outfit ' + s.outfit + ', paper hero ' + (s.paper ? 'on' : 'off') + '.'); }
            }, 1500);
        })();
        function crashGLLost() { // the GPU was taken back: carry on in 2D
            if (!FX_GL.ok) return; FX_GL.ok = false; FX_GL.lostAt = Date.now();
            try { FX_GL.cv.style.display = 'none'; canvas.style.opacity = '1'; PALETTES.desert.light = '#e2c08c'; } catch (e) {} // show the 2D canvas the 3D layer was covering (same setup as a phone without WebGL)
            try { showFluidMessage('The phone took the graphics memory back. Carrying on in the simple view; reopen the game to get the 3D back.', 4200); } catch (e) {}
            crashWrite(false);
        }
