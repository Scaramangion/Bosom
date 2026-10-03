        // ================= WEBGL POST LAYER (visual only: reads the 2D canvas, never changes game state) =================
        // The pixel canvas stays the source of truth. This layer adds lighting, fog, cloud-shadow depth layers and
        // a vignette, sampling the pixels with NEAREST so the sprites stay crisp.
        const BG_IDS = { town: 'bg-town', wastes: 'bg-wastes', emporium: 'bg-emporium', haven: 'bg-haven', trail: 'bg-trail' }; // photo data lives in <script type="text/plain"> blocks above, read only when needed // background art for the town; gameplay still comes from MAP_DATA
        const FX_GL = {
            ok: false, ambient: 0.85, lamps: null, ema: 16, last: 0, slow: 0, level: 0, LEVELS: [[960, 864], [720, 648], [480, 432], [320, 288]],
            VERT: 'attribute vec2 a;varying vec2 vUv;void main(){vUv=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}',
            FRAG: `#ifdef GL_FRAGMENT_PRECISION_HIGH
            precision highp float;
            #else
            precision mediump float;
            #endif
            varying vec2 vUv;uniform float uDS;uniform vec3 uTint;uniform float uDesat;uniform sampler2D uTex,uBG,uNoise,uDecalTex,uVista,uNbr;uniform vec4 uNbrR;uniform vec2 uNbrT;uniform float uNbrOn,uYaw;uniform float uBGOn,uDecalOn,uDOF,uMag,uFogD,uHY,uVistaOn,uVPan;uniform vec4 uDecal;uniform vec2 uFocus;uniform vec2 uCam,uWorld;uniform vec3 uView;uniform float uTime,uAmb,uMode,uNight,uTP,uGrade;uniform vec2 uHero,uTileS;uniform vec3 uFogC;uniform vec3 uL[8];uniform float uZ0;
            float nz(vec2 p){return texture2D(uNoise,p/32.).r;}
            vec3 bgAt(vec2 w){ if(uTileS.x>0.){ // a seamless tile, repeated, with a second copy at another scale blended in by noise so the repeat never lines up
                vec3 a=texture2D(uBG,fract(w/uTileS)).rgb,b2=texture2D(uBG,fract(w/(uTileS*1.61)+vec2(.37,.71))).rgb;
                return mix(a,b2,smoothstep(.3,.7,nz(w/83.))); }
              return texture2D(uBG,clamp(w/uWorld,0.,1.)).rgb; }
            vec3 ground(vec2 w){vec3 b=mix(vec3(.85,.7,.45),bgAt(w),uBGOn);
              if(uDecalOn>.5){vec2 d=(w-uDecal.xy)/uDecal.zw;if(d.x>=0.&&d.y>=0.&&d.x<=1.&&d.y<=1.){vec4 k=texture2D(uDecalTex,d);b=mix(b,k.rgb,k.a);}}
              return b;}
            vec3 groundDOF(vec2 p){ // tilt-shift: sharp band around the hero's feet, soft focus above and below it
              vec2 w=p+uCam;vec3 c0=ground(w);
              float r=clamp((abs(p.y-uFocus.y)-14.)*.05,0.,2.6)*uDOF,q=max(r,.7);
              vec3 a=(ground(w+vec2(q,q))+ground(w+vec2(-q,q))+ground(w+vec2(q,-q))+ground(w+vec2(-q,-q)))*.25;
              float f=smoothstep(0.,1.,r);
              vec3 col=mix(c0+(c0-a)*.4*uDOF,mix(c0,a,.85),f);
              return col*(1.+(nz(w*2.3)-.5)*.07*(1.-f)*uDOF);}
            float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}float bayer(vec2 a){return b2(.5*a)*.25+b2(a);}
            void main(){
              vec2 sc=vec2(80.,72.);vec2 dd=vUv*vec2(160.,144.)-sc;
              float cyl=uView.x;dd/=uView.y*(1.+.22*cyl);
              float R=92.;float th=asin(clamp(dd.x/R,-.98,.98));
              vec2 px=sc+vec2(mix(dd.x,R*th,cyl)+uView.z*R*cyl,dd.y/mix(1.,max(cos(th),.55),cyl));
              float skyA=0.,fogA=0.,nbrA=0.;vec3 nbrC=vec3(0.);
              if(uTP>.001){ // third person: the painted ground seen from behind and above the hero, receding to a horizon
                float sy=vUv.y*144.,hY=uHY,yH=112.,mag=uMag,z0=uZ0;
                float z=(yH-hY)*z0/max(sy-hY,.35);
                vec2 oT=vec2((vUv.x*160.-80.)*z/(mag*110.),-(z-z0)),pT=uHero+vec2(oT.x*cos(uYaw)-oT.y*sin(uYaw),oT.x*sin(uYaw)+oT.y*cos(uYaw)); // turned by the camera's yaw
                px=mix(px,pT,uTP);
                skyA=uTP*(1.-smoothstep(hY-.5,hY+7.,sy));
                vec2 wT=pT+uCam;float offW=step(wT.x,0.)+step(uWorld.x,wT.x)+step(wT.y,0.)+step(uWorld.y,wT.y);
                float bank=nz(wT/44.+vec2(uTime*.035,uTime*.012))-.5,zf=z-z0+110.;            // slow rolling fog banks
                if(uNbrOn>.001&&offW>0.){ // past the edge of this place: a hazy window onto the next one, lined up with the way through
                  vec2 nw=wT-uNbrR.xy;
                  if(nw.x>=0.&&nw.y>=0.&&nw.x<=uNbrR.z&&nw.y<=uNbrR.w){ nbrA=uNbrOn;
                    nbrC=uNbrT.x>0.?mix(texture2D(uNbr,fract(nw/uNbrT)).rgb,texture2D(uNbr,fract(nw/(uNbrT*1.61)+vec2(.37,.71))).rgb,smoothstep(.3,.7,nz(nw/83.))):texture2D(uNbr,nw/uNbrR.zw).rgb; }
                }
                fogA=uTP*clamp(.10+(1.-uFogD)*.5+smoothstep(110.*1.02*uFogD,110.*3.4*uFogD,zf)*.95+bank*.35*smoothstep(110.*.8*uFogD,110.*2.2*uFogD,zf)+min(offW,1.)*(1.-nbrA*.85),0.,1.)*(1.-nbrA*.3);
                if(nbrA>0.){ float od=max(max(-wT.x,wT.x-uWorld.x),max(-wT.y,wT.y-uWorld.y)); nbrC+=vec3(.55,.75,1.)*(1.-smoothstep(0.,3.5,od))*.5; } // the seam of the pane
              }
              vec2 suv=px/vec2(160.,144.);
              float inside=step(0.,suv.x)*step(suv.x,1.)*step(0.,suv.y)*step(suv.y,1.);
              vec4 s=texture2D(uTex,clamp(suv,0.,1.));s.a*=inside;vec3 c=s.rgb*(uMode>.5&&uMode<1.5?1.:inside);
              if(uMode>.5){
                bool sky=uMode<1.5;bool room=uMode>2.5;
                bool dun=uMode>1.5&&uMode<2.5;
                if(sky||room||dun){
                  c=mix(sky?groundDOF(px):ground(px+uCam),s.rgb,s.a);
                  if(room&&s.a>.5&&distance(s.rgb,vec3(1.,0.,1.))<.06)c=ground(px+uCam);
                }
                if(sky){
                  c*=mix(vec3(1.04,.98,.9),vec3(.9,.95,1.),vUv.y);
                  float cl=nz((px+uCam*.35)/46.+vec2(uTime*.03,uTime*.01));
                  c*=1.-.2*smoothstep(.5,.78,cl)*(1.-uNight*.6);
                }
                vec3 lit=vec3(0.);
                for(int i=0;i<8;i++){vec3 L=uL[i];if(L.z>0.){float f=smoothstep(L.z,0.,distance(px,L.xy));lit+=vec3(1.,.74,.38)*f*f*(.9+.1*sin(uTime*7.+float(i)*2.3));}}
                c=c*(vec3(uAmb)+lit*1.15)+lit*.05;
                if(sky){float fg=smoothstep(.5,.88,nz((px+uCam*.6)/38.+vec2(uTime*.04,0.)));
                  c=mix(c,vec3(.85,.8,.7),fg*(.12+.25*uNight)*(.5+vUv.y*.5));}
              }
              if(nbrA>0.){ float gl=.5+.5*sin(vUv.x*40.+uTime*.6);                  // the pane: cool glass tint, a faint moving sheen
                c=mix(c,nbrC*vec3(uAmb)*vec3(.9,.97,1.08)+vec3(.04,.05,.07)*gl*.6,nbrA*.92); }
              if(uTP>.001){ c=mix(c,uFogC,fogA); c=mix(c,uFogC,skyA); }   // no sky: the fog is the horizon
              if(uVistaOn>.001&&uTP>.001){ // the far vista (Brennan's Theme): ruins under a turning black hole, the ground fog melting into its foot
                float sy2=vUv.y*144.,bot=uHY+16.;
                vec2 vu=vec2((vUv.x-.5)*.9+.5+uVPan-.05+uYaw/2.4,clamp(sy2/bot,0.,1.)); // ~140 degrees of vista centred on north
                vec2 dv=(vu-vec2(.547,.19))*vec2(2.3,1.);float rr=length(dv);           // the vortex breathes and swirls, it never smears
                float th=.22*sin(uTime*.3-rr*14.)*smoothstep(.34,.0,rr);
                vu=vec2(.547,.19)+mat2(cos(th),-sin(th),sin(th),cos(th))*dv/vec2(2.3,1.);
                vec3 vc=texture2D(uVista,vu).rgb;
                float va=uVistaOn*uTP*(1.-smoothstep(uHY+3.,bot,sy2))*smoothstep(0.,.07,vu.x)*smoothstep(1.,.93,vu.x);
                c=mix(c,vc,va);
              }
              if(uGrade>.5){ // the eerie grade: drained, cold, grainy
                float l=dot(c,vec3(.299,.587,.114));
                c=mix(c,vec3(l)*vec3(.94,.98,1.04),uDesat);c*=uTint;
                c=pow(max(c,0.),vec3(1.12));
                float g=fract(sin(dot(floor(vUv*vec2(480.,432.))+floor(uTime*24.)*vec2(7.,13.),vec2(12.9898,78.233)))*43758.5453);
                c+=(g-.5)*.055;
              }
              c*=1.-smoothstep(.36,.86,distance(vUv,vec2(.5)))*mix(.35,.62,uGrade);
              if(uGrade>.5) c=floor(clamp(c,0.,1.)*31.+bayer(gl_FragCoord.xy/uDS))/31.; // PS1: 5 bits a channel, ordered dither
              gl_FragColor=vec4(c,1.);
            }`,
            init() {
                try {
                    const cv = document.createElement('canvas');
                    const want = Math.max(3, Math.min(6, Math.round((window.innerWidth || 400) * (window.devicePixelRatio || 1) / 160)));
                    this.level = want >= 6 ? 0 : want >= 4 ? 1 : 2; if (this.level === 0 && (navigator.maxTouchPoints || 0) > 0) this.level = 1; // phones: 720x648 is plenty and saves several MB of GPU memory [cv.width, cv.height] = this.LEVELS[this.level]; // 6x, 4.5x, 3x, 2x of the 160x144 game
                    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:pixelated;';
                    const gl = cv.getContext('webgl', { alpha: false, antialias: false });
                    if (!gl) throw new Error('WebGL unavailable');
                    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); crashGLLost(); }); // the phone took the GPU back: drop to 2D instead of freezing
                    const mk = (t, src) => { const sh = gl.createShader(t); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
                    const pr = gl.createProgram();
                    gl.attachShader(pr, mk(gl.VERTEX_SHADER, this.VERT)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, this.FRAG));
                    gl.linkProgram(pr);
                    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
                    gl.useProgram(pr);
                    this.quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
                    const loc = this.locA = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
                    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
                    [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
                    const mkTex = (unit, rep_) => { gl.activeTexture(gl.TEXTURE0 + unit); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
                        const w = rep_ ? gl.REPEAT : gl.CLAMP_TO_EDGE;
                        [[gl.TEXTURE_MIN_FILTER, rep_ ? gl.LINEAR : gl.NEAREST], [gl.TEXTURE_MAG_FILTER, rep_ ? gl.LINEAR : gl.NEAREST], [gl.TEXTURE_WRAP_S, w], [gl.TEXTURE_WRAP_T, w]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([226, 192, 140, 255])); return t; };
                    this.bgTex = mkTex(4, false); gl.activeTexture(gl.TEXTURE4);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
                    // Baked tileable value noise (3 octaves, period 32 cells, 128x128): one texture read replaces ~12 hashes per pixel per layer
                    const N = 128, P = 32, nd = new Uint8Array(N * N), hh = (x, y) => { let t = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; t = Math.imul(t ^ (t >>> 13), 1274126177); return ((t ^ (t >>> 16)) >>> 0) / 4294967295; };
                    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
                        let v = 0;
                        for (let o = 0; o < 3; o++) {
                            const f = 1 << o, per = P * f, qx = i / N * per, qy = j / N * per, x0 = Math.floor(qx), y0 = Math.floor(qy);
                            let fx = qx - x0, fy = qy - y0; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
                            const xa = x0 % per, xb = (x0 + 1) % per, ya = y0 % per, yb = (y0 + 1) % per;
                            const a = hh(xa, ya) + (hh(xb, ya) - hh(xa, ya)) * fx, b = hh(xa, yb) + (hh(xb, yb) - hh(xa, yb)) * fx;
                            v += (a + (b - a) * fy) * 0.5 / f;
                        }
                        nd[j * N + i] = Math.min(255, Math.round(v * 1.0714 * 255)); // rescale to the old 4-octave range so the thresholds still fit
                    }
                    gl.activeTexture(gl.TEXTURE5); const nt = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, nt);
                    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, N, N, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, nd);
                    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
                    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.activeTexture(gl.TEXTURE0);
                    gl.activeTexture(gl.TEXTURE3); const dtex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dtex);
                    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeRiteSealCanvas()); gl.activeTexture(gl.TEXTURE0); this.decalReady = true;
                    [['uBG', 4], ['uTex', 0], ['uNoise', 5], ['uDecalTex', 3], ['uVista', 2], ['uNbr', 1]].forEach(([n, i]) => gl.uniform1i(gl.getUniformLocation(pr, n), i));
                    { const vi = new Image(); vi.onload = () => { // the vista: its own texture unit, uploaded once
                        gl.activeTexture(gl.TEXTURE2); const vt = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, vt);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vi); gl.activeTexture(gl.TEXTURE0); this.vistaReady = true; };
                      const ve = document.getElementById('bg-vista'); if (ve) vi.src = ve.textContent.trim(); }
                    this.frame = 0;
                    this.tex = tex; this.gl = gl; this.cv = cv; this.pr = pr; this.imgs = {}; this.bgKey = null;
                    this.useBg(PAPER.on ? 'blank' : 'town'); // the paper town paints its own street: don't decode the old town photo
                    try { this.initHero(gl); } catch (e) { console.warn('HD hero disabled:', e); }
                    const ucache = {}; this.u = n => (n in ucache ? ucache[n] : (ucache[n] = gl.getUniformLocation(pr, n))); // look each uniform up once
                    gl.viewport(0, 0, cv.width, cv.height);
                    canvas.insertAdjacentElement('afterend', cv);
                    canvas.style.opacity = '0'; // 2D canvas keeps running (and receiving taps) but the GL layer is what you see
                    this.ok = true;
                } catch (e) { console.warn('WebGL layer disabled:', e); this.ok = false; }
                if (!this.ok) { PALETTES.desert.light = '#e2c08c'; }
            },
            initHero(gl) { // second program: draws the hero (and the tool in his hand) as textured quads over the finished scene
                const mk = (t, src) => { const sh = gl.createShader(t); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
                const sp = this.sp = gl.createProgram();
                gl.attachShader(sp, mk(gl.VERTEX_SHADER, 'precision mediump float;attribute vec2 aPos;attribute vec2 aUv;uniform vec2 uRes;uniform float uZ;varying vec2 vUv;varying vec2 vPx;void main(){vPx=aPos;vUv=aUv;gl_Position=vec4(aPos.x/uRes.x*2.-1.,1.-aPos.y/uRes.y*2.,uZ,1.);}'));
                gl.attachShader(sp, mk(gl.FRAGMENT_SHADER, `precision mediump float;uniform float uDS;uniform vec3 uTint;uniform float uDesat;varying vec2 vUv;varying vec2 vPx;uniform sampler2D uAtlas,uTex;uniform vec2 uRes;uniform float uAmb,uMode,uEmit,uGrade,uFogA;uniform vec3 uL[8],uFogC;
                    float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}float bayer(vec2 a){return b2(.5*a)*.25+b2(a);}
                    void main(){
                      vec4 t=texture2D(uAtlas,vUv);if(t.a<.5)discard;
                      vec2 sUv=vPx/uRes;
                      if(uMode>2.5){vec4 s=texture2D(uTex,sUv);if(s.a>.5&&distance(s.rgb,vec3(1.,0.,1.))<.06)discard;}
                      vec3 c=t.rgb;
                      if(uMode>.5){
                        if(uMode<1.5)c*=mix(vec3(1.04,.98,.9),vec3(.9,.95,1.),sUv.y);
                        vec3 lit=vec3(0.);
                        for(int i=0;i<8;i++){vec3 L=uL[i];if(L.z>0.){float f=smoothstep(L.z,0.,distance(vPx,L.xy));lit+=vec3(1.,.74,.38)*f*f;}}
                        c=c*(vec3(uAmb)+lit*1.15)+lit*.05;
                      }
                      c=mix(c,t.rgb,uEmit*step(.9,t.a));
                      if(uGrade>.5){float l=dot(c,vec3(.299,.587,.114));c=mix(c,vec3(l)*vec3(.94,.98,1.04),uDesat*.85);c=pow(max(c,0.),vec3(1.1));c*=uTint;}
                      c=mix(c,uFogC,uFogA);
                      c*=1.-smoothstep(.36,.86,distance(sUv,vec2(.5)))*mix(.35,.62,uGrade);
                      if(uGrade>.5) c=floor(clamp(c,0.,1.)*31.+bayer(gl_FragCoord.xy/uDS))/31.;
                      gl_FragColor=vec4(c,1.);
                    }`));
                gl.bindAttribLocation(sp, 0, 'aPos'); gl.bindAttribLocation(sp, 1, 'aUv'); gl.linkProgram(sp);
                if (!gl.getProgramParameter(sp, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(sp));
                this.spBuf = gl.createBuffer(); this.spU = {};
                const tex = (unit, filter) => { gl.activeTexture(gl.TEXTURE0 + unit); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
                    [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); return t; };
                tex(6, gl.LINEAR); this.tex7 = tex(7, gl.LINEAR);
                this.toolCv = document.createElement('canvas'); this.toolCv.width = this.toolCv.height = 128; this.toolCtx = this.toolCv.getContext('2d'); this.toolReady = false;
                this.heldCv = document.createElement('canvas'); this.heldCv.width = this.heldCv.height = 256; this.heldCtx = this.heldCv.getContext('2d'); // held items + the slash trail (64 game units square around the hand)
                gl.activeTexture(gl.TEXTURE0);
                const img = new Image(); heroHD.img = img;
                img.onload = () => { gl.activeTexture(gl.TEXTURE6); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.activeTexture(gl.TEXTURE0); heroHD.ready = true; refreshOutfitUI(); };
                img.src = document.getElementById('hero-atlas').textContent.trim();
            },
            bindMain(gl) { gl.useProgram(this.pr); gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf); gl.vertexAttribPointer(this.locA, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(this.locA); gl.disableVertexAttribArray(1); },
            viewForward(px, py) { // where a point of the flat 2D picture ends up on screen after the panorama curve/zoom or the third-person tilt (mirror of the shader); [x, y, scale]
                const cyl = diorama.cur.cyl, zm = diorama.cur.zoom * (1 + 0.22 * cyl), R = 92;
                let n = [px, py];
                if (!(cyl < 0.001 && Math.abs(zm - 1) < 0.001)) {
                    const tx = px - 80 - diorama.yaw * R * cyl; let lo = -R * 0.98, hi = R * 0.98;
                    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2, g = mid + (R * Math.asin(mid / R) - mid) * cyl; if (g < tx) lo = mid; else hi = mid; }
                    const dx = (lo + hi) / 2, th = Math.asin(dx / R), dy = (py - 72) * (1 + (Math.max(Math.cos(th), 0.55) - 1) * cyl);
                    n = [80 + dx * zm, 72 + dy * zm];
                }
                const t = COMBAT.amt; if (t < 0.001) return [n[0], n[1], 1, 0];
                const [hx, hy] = tpAnchor(), hY = CINE.hY, yH = 112, mag = CINE.mag, z0 = CINE.z0;
                const yw = camYaw(), cs = Math.cos(yw), sn = Math.sin(yw), ddx = px - hx, ddy = py - hy, lx = ddx * cs + ddy * sn, ly = -ddx * sn + ddy * cs; // into the camera's frame
                const z = z0 - ly; if (z < Math.min(12, z0 * 0.4)) return [-999, -999, 0, 0]; // behind the camera
                const sc = mag * 110 / z, T = [80 + lx * sc, hY + (yH - hY) * z0 / z]; // the lens keeps its focal length: pulled in close, the camera drops toward his feet and he looms larger
                return [n[0] + (T[0] - n[0]) * t, n[1] + (T[1] - n[1]) * t, 1 + (sc - 1) * t, z];
            },
            fogColor(mode, night) { if (currentMapName === 'wolf_hollow') return night ? [0.03, 0.05, 0.04] : [0.10, 0.16, 0.11]; if (mode === 1 && this.rhythm && this.rhythm.fog) { const f = this.rhythm.fog, b = [0.29, 0.30, 0.33], v = CINE.vista * 0.6; return f.map((x, i) => x + (b[i] * (night ? 0.45 : 1) - x) * v); } if (mode !== 2 && CINE.vista > 0.01) { const b = night ? [0.13, 0.14, 0.18] : [0.29, 0.30, 0.33], f = night ? [0.05, 0.055, 0.075] : [0.70, 0.71, 0.72]; return f.map((v, i) => v + (b[i] - v) * CINE.vista); } return mode === 2 ? [0.015, 0.015, 0.025] : night ? [0.05, 0.055, 0.075] : [0.70, 0.71, 0.72]; },
            spriteFog(scale) { // the shader's ground fog, for a sprite standing at the depth implied by its on-screen scale
                const t = COMBAT.amt; if (t < 0.001 || !scale) return 0;
                const z = CINE.mag * 110 / Math.max(0.05, 1 + (scale - 1) / t) - CINE.z0 + 110, a = 110 * 1.02 * CINE.fogD, b = 110 * 3.4 * CINE.fogD, u = Math.min(1, Math.max(0, (z - a) / (b - a)));
                return t * Math.min(1, 0.06 + (1 - CINE.fogD) * 0.5 + u * u * (3 - 2 * u) * 0.95);
            },
            spUniforms(gl, U, fogA) { gl.uniform1f(U('uDS'), this.cv.width / 240); { const R = this.rhythm || { tint: [1, 1, 1], ds: 0.45 }; gl.uniform3f(U('uTint'), R.tint[0], R.tint[1], R.tint[2]); gl.uniform1f(U('uDesat'), R.ds); } const fc = this.fogColor(this.curMode, isNight()); gl.uniform1f(U('uGrade'), gameStarted ? 1 : 0); gl.uniform3f(U('uFogC'), fc[0], fc[1], fc[2]); gl.uniform1f(U('uFogA'), fogA || 0); },
            drawCards(gl, far) { // standing creature cards (third person): far ones before the hero, near ones after, back to front
                const hy = player.pixelY + 15, list = CARDS.list.filter(e => far ? e.fy <= hy : e.fy > hy).sort((a, b) => a.fy - b.fy);
                if (!list.length || !this.sp) return;
                gl.useProgram(this.sp);
                const U = n => this.spU[n] || (this.spU[n] = gl.getUniformLocation(this.sp, n));
                gl.uniform2f(U('uRes'), GAME_WIDTH, GAME_HEIGHT); gl.uniform1f(U('uAmb'), this.ambient); gl.uniform1f(U('uMode'), this.curMode); gl.uniform1i(U('uTex'), 0);
                gl.uniform3fv(U('uL[0]'), this.Ls || this.L); gl.uniform1f(U('uEmit'), 0); gl.uniform1i(U('uAtlas'), 7); this.spUniforms(gl, U, 0);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.spBuf); gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
                gl.activeTexture(gl.TEXTURE7); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                for (const e of list) {
                    const S = e.S || 128, p = this.viewForward(e.fx - lastCamX, e.fy - lastCamY); if (!p[2] || (COMBAT.amt > 0.5 && p[2] > 2.9 * 110 / CINE.z0 && e.orient == null)) continue; // nothing looms up against the lens
                    if (e.orient == null && p[3] && p[3] < CINE.z0 * 0.72 && viewStreet()) continue; // street camera: nothing standing between the lens and him
                    let quadPts;
                    if (e.orient != null) { // a plane fixed in the world (a fence): each end projected on its own, so it turns edge-on as the camera goes round
                        const hw = S / 4, c = Math.cos(e.orient), sn = Math.sin(e.orient);
                        const pl = this.viewForward(e.fx - hw * c - lastCamX, e.fy - hw * sn - lastCamY), pr = this.viewForward(e.fx + hw * c - lastCamX, e.fy + hw * sn - lastCamY);
                        if (!pl[2] || !pr[2]) continue; const kl = pl[2] * 0.5, kr = pr[2] * 0.5;
                        quadPts = [pl[0], pl[1] - (S - 8) * kl, pr[0], pr[1] - (S - 8) * kr, pr[0], pr[1] + 8 * kr, pl[0], pl[1] + 8 * kl];
                    }
                    const k = p[2] * 0.5, x0 = p[0] - S / 2 * k, x1 = p[0] + S / 2 * k, y0 = p[1] - (S - 8) * k, y1 = p[1] + 8 * k;
                    gl.uniform1f(U('uFogA'), this.spriteFog(p[2])); gl.uniform1f(U('uZ'), this.paperZ ? this.zN(p[3]) : 0);
                    if (e.cached) { // static prop: its own texture, uploaded once
                        if (!e.cached.tex) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
                            [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
                            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, e.cv); e.cached.tex = t; }
                        else gl.bindTexture(gl.TEXTURE_2D, e.cached.tex);
                    } else { gl.bindTexture(gl.TEXTURE_2D, this.tex7); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, e.cv); }
                    const Q = quadPts || [x0, y0, x1, y0, x1, y1, x0, y1];
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([Q[0], Q[1], 0, 0, Q[2], Q[3], 1, 0, Q[4], Q[5], 1, 1, Q[0], Q[1], 0, 0, Q[4], Q[5], 1, 1, Q[6], Q[7], 0, 1]), gl.DYNAMIC_DRAW);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                }
                gl.bindTexture(gl.TEXTURE_2D, this.tex7); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.activeTexture(gl.TEXTURE0); gl.disableVertexAttribArray(1); this.bindMain(gl);
            },
            drawHero(gl) {
                const req = heroHD.req; if (!req || !heroHD.ready) return;
                const p = this.viewForward(req.x, req.y), fr = heroHD.pick(), f = HERO_FRAMES[fr.name]; heroHD.lastP = p; if (!f) return;
                if (actionTimer > 0 && (equippedItem === 'sword' || equippedItem === 'axe') && !fr.attacking && !fr.holding && !fr.riding && !fr.pouch && !fr.jumping && !fr.rolling) { // a rigged swing: the body rocks back on the wind-up and lunges into the cut
                    const q = 1 - actionTimer / actionTotal, vk = String(fr.view), sideV = !(vk.startsWith('down') || vk.startsWith('up')), sgn = (vk.endsWith('left') !== !!fr.flip) ? -1 : 1;
                    const push = q < 0.28 ? -0.45 * Math.sin(q / 0.28 * Math.PI / 2) : q < 0.46 ? -0.45 + 1.45 * ((q - 0.28) / 0.18) : q < 0.72 ? 1 : 1 - (q - 0.72) / 0.28;
                    fr.swing = q; fr.swingSgn = sgn;
                    if (sideV) { fr.lx = sgn * push * 0.09 * f[3]; fr.rot = (fr.rot || 0) + sgn * push * 0.09; }
                    else { fr.bob = (fr.bob || 0) - Math.max(0, push) * 1.2; fr.sy = (fr.sy || 1) * (1 - 0.05 * Math.max(0, push)); fr.sx = (fr.sx || 1) * (1 + 0.04 * Math.max(0, push)); }
                }
                const k = (HERO_TARGET_H / (fr.riding || fr.pouch ? 88 : heroHD.refH(HERO_OUTFITS[heroHD.outfit]))) * req.s * (p[2] || 1), quad = (pts, uv) => { const v = []; [0, 1, 2, 0, 2, 3].forEach(i => v.push(pts[i][0], pts[i][1], uv[i][0], uv[i][1])); return new Float32Array(v); };
                const ax = f[4], w = f[2], h = f[3], sx = fr.sx || 1, sy = fr.sy || 1, pv = (fr.piv || 0) * h;
                // local frame coords (x right of the feet, y up is negative) -> screen: squash/stretch and turn about the pivot, then ride the bob
                const cs = Math.cos(fr.rot), sn = Math.sin(fr.rot), place = (x, y) => { const X = (x + (fr.lx || 0)) * sx, Y = (y + pv) * sy; return [p[0] + (X * cs - Y * sn) * k, p[1] - fr.bob * req.s + (X * sn + Y * cs - pv) * k]; };
                const L = fr.flip ? -(w - ax) : -ax, R = fr.flip ? ax : w - ax, u0 = f[0] / HERO_ATLAS[0], u1 = (f[0] + w) / HERO_ATLAS[0], v0 = f[1] / HERO_ATLAS[1], v1 = (f[1] + h) / HERO_ATLAS[1];
                const uL = fr.flip ? u1 : u0, uR = fr.flip ? u0 : u1;
                gl.useProgram(this.sp);
                const U = n => this.spU[n] || (this.spU[n] = gl.getUniformLocation(this.sp, n));
                gl.uniform2f(U('uRes'), GAME_WIDTH, GAME_HEIGHT); gl.uniform1f(U('uAmb'), this.ambient); gl.uniform1f(U('uMode'), this.curMode); gl.uniform1i(U('uTex'), 0);
                gl.uniform3fv(U('uL[0]'), this.Ls || this.L); gl.uniform1f(U('uEmit'), 0); this.spUniforms(gl, U, 0); const heroZ = this.paperZ ? this.zN(p[3] - 14) : 0; // a little forward of his feet: the wall he's leaning on never slices him gl.uniform1f(U('uZ'), heroZ);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.spBuf); gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
                const oH = HERO_OUTFITS[heroHD.outfit] || {}, held = HELD_ITEMS[equippedItem], showHeld = held && !(equippedItem === 'sword' && !COMBAT.on && oH.drawn) && !fr.attacking && !fr.holding && !fr.drawnRoll && !fr.jumping && !fr.riding && !fr.pouch; // tucked away while curled into a roll or a jump
                const drawHeld = () => { // the held item, composited around the grip on a 256px canvas (4px per game unit), drawn as one quad centred on the hand
                    const c = this.heldCtx, t = performance.now() / 1000, sw = fr.moving || fr.rolling ? Math.sin(fr.p * Math.PI * 2) : 0;
                    const vk = String(fr.view), sideV = !(vk.indexOf('down') === 0 || vk.indexOf('up') === 0);
                    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 256, 256); c.imageSmoothingEnabled = true;
                    let hand, ang, S = null;
                    if (fr.swing != null) { S = swingPose(fr.swing, vk, sideV, fr.swingSgn, h); hand = S.hand; ang = S.ang; }
                    else {
                        hand = heroHandLocal(fr, f);
                        const tilt = sideV ? held.tilt * sw + (fr.moving ? held.lean || 0 : 0) : held.tilt * 0.3 * sw;
                        const rest = sideV ? -(held.rest || 0) * (vk.endsWith('left') ? -1 : 1) : 0; // side-on, long tools lean back over the shoulder instead of covering his face
                        ang = (fr.flip ? -1 : 1) * (tilt + rest);
                    }
                    const hp = place(hand[0], hand[1]), fpx = 4 * HERO_TARGET_H / heroHD.refH(HERO_OUTFITS[heroHD.outfit]); // frame px -> canvas px
                    c.translate(128, 128); c.rotate(fr.rot); c.scale(sx, sy);
                    if (S && S.trail) { // the slash: a pale crescent swept behind the blade, brightest at its leading edge
                        const cx = (S.ctr[0] - hand[0]) * fpx, cy = (S.ctr[1] - hand[1]) * fpx, r0 = S.r * fpx + 6, r1 = S.r * fpx + 11.5 * 4 * 0.95;
                        const [a0, a1] = S.trail, N = 7;
                        for (let n = 0; n < N; n++) {
                            const b0 = a0 + (a1 - a0) * n / N - Math.PI / 2, b1 = a0 + (a1 - a0) * (n + 1) / N - Math.PI / 2, ccw = a1 < a0;
                            c.globalAlpha = 0.06 + 0.5 * Math.pow((n + 1) / N, 1.6) * S.trailA; c.fillStyle = n === N - 1 ? '#ffffff' : '#dbeafe';
                            c.beginPath(); c.arc(cx, cy, r1, b0, b1, ccw); c.arc(cx, cy, r0 + (r1 - r0) * 0.45 * (1 - n / N), b1, b0, !ccw); c.closePath(); c.fill();
                        }
                        c.globalAlpha = 1;
                    }
                    c.rotate(ang);
                    const ok = held.draw(c, 4, t); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; if (!ok) return;
                    gl.activeTexture(gl.TEXTURE7); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.heldCv); gl.activeTexture(gl.TEXTURE0);
                    const sz = 64 * req.s * (p[2] || 1), ox = hp[0] - sz / 2, oy = hp[1] - sz / 2;
                    gl.uniform1i(U('uAtlas'), 7); gl.uniform1f(U('uEmit'), 1);
                    gl.bufferData(gl.ARRAY_BUFFER, quad([[ox, oy], [ox + sz, oy], [ox + sz, oy + sz], [ox, oy + sz]], [[0, 0], [1, 0], [1, 1], [0, 1]]), gl.DYNAMIC_DRAW);
                    gl.drawArrays(gl.TRIANGLES, 0, 6); gl.uniform1f(U('uEmit'), 0);
                };
                const hq = HORSE.req, heroWY = player.pixelY + 15;
                const drawHorse = () => { // the waiting horse, same atlas and scale as the hero
                    const g = HERO_FRAMES[hq.name]; if (!g) return; const hp = this.viewForward(hq.x, hq.y), kk = (HERO_TARGET_H / 88) * hq.s * (hp[2] || 1), br = Math.sin(performance.now() / 700) * 0.25 * hq.s;
                    const P = (x, y) => [hp[0] + x * kk, hp[1] - br + y * kk], u0 = g[0] / HERO_ATLAS[0], u1 = (g[0] + g[2]) / HERO_ATLAS[0], v0 = g[1] / HERO_ATLAS[1], v1 = (g[1] + g[3]) / HERO_ATLAS[1];
                    gl.uniform1i(U('uAtlas'), 6); gl.uniform1f(U('uEmit'), 0); gl.uniform1f(U('uFogA'), this.spriteFog(hp[2])); gl.uniform1f(U('uZ'), this.paperZ ? this.zN(hp[3]) : 0);
                    gl.bufferData(gl.ARRAY_BUFFER, quad([P(-g[4], -g[3]), P(g[2] - g[4], -g[3]), P(g[2] - g[4], 0), P(-g[4], 0)], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]), gl.DYNAMIC_DRAW);
                    gl.drawArrays(gl.TRIANGLES, 0, 6); gl.uniform1f(U('uFogA'), 0); gl.uniform1f(U('uZ'), heroZ);
                };
                if (hq && hq.wy <= heroWY) drawHorse();
                const behind = showHeld && String(fr.view).startsWith('up') && !(fr.swing != null && fr.swing > 0.12 && fr.swing < 0.8); // seen from behind, the hand (and what it holds) is on the far side of the body
                if (behind) drawHeld();
                gl.uniform1i(U('uAtlas'), 6);
                gl.bufferData(gl.ARRAY_BUFFER, quad([place(L, -h), place(R, -h), place(R, 0), place(L, 0)], [[uL, v0], [uR, v0], [uR, v1], [uL, v1]]), gl.DYNAMIC_DRAW);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                if (showHeld && !behind) drawHeld();
                if (hq && hq.wy > heroWY) drawHorse();
                else if (!held && equippedItem && equippedItem !== 'none' && !fr.attacking && !fr.holding && !fr.riding && !fr.pouch && !fr.drawnRoll && !fr.jumping) { // tools without held art yet (the lens), drawn after him
                    drawHeroTool(this.toolCtx, hero.dir || 'down', actionTimer > 0, equippedItem);
                    gl.activeTexture(gl.TEXTURE7); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.toolCv); gl.activeTexture(gl.TEXTURE0);
                    const kt = 1.3 * req.s * (p[2] || 1), ox = p[0] - 8 * kt - 8 * kt, oy = p[1] - fr.bob * req.s - 15.5 * kt - 8 * kt, sz = 32 * kt;
                    gl.uniform1i(U('uAtlas'), 7);
                    gl.bufferData(gl.ARRAY_BUFFER, quad([[ox, oy], [ox + sz, oy], [ox + sz, oy + sz], [ox, oy + sz]], [[0, 0], [1, 0], [1, 1], [0, 1]]), gl.DYNAMIC_DRAW);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                }
                gl.disableVertexAttribArray(1); this.bindMain(gl);
            },
            zN(z) { return z > 0 ? (1400 + 3) / (1400 - 3) - 2 * 1400 * 3 / (1400 - 3) / z : 0; }, // camera depth -> the depth buffer (same as the paper shader)
            initPaper(gl) { // third program: the folded town, real geometry with a depth buffer
                const mk = (t, src) => { const sh = gl.createShader(t); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
                const pp = gl.createProgram();
                gl.attachShader(pp, mk(gl.VERTEX_SHADER, PAPER_GLSL.vert));
                gl.attachShader(pp, mk(gl.FRAGMENT_SHADER, PAPER_GLSL.frag));
                gl.bindAttribLocation(pp, 0, 'aP'); gl.bindAttribLocation(pp, 1, 'aT'); gl.bindAttribLocation(pp, 2, 'aS'); gl.linkProgram(pp);
                if (!gl.getProgramParameter(pp, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pp));
                this.pp = pp; this.ppU = {};
                const mesh = paperBuild(); this.ppBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.ppBuf); gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
                this.ppTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.ppTex);
                [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paperSheet()); PAPER.sheet = null; // on the GPU now: free the 4 MB canvas
                gl.bindTexture(gl.TEXTURE_2D, this.tex7); gl.activeTexture(gl.TEXTURE0);
            },
            drawPaper(gl) {
                if (!this.pp) { try { this.initPaper(gl); } catch (e) { console.warn('papercraft town disabled:', e); PAPER.on = false; return false; } }
                const U = n => this.ppU[n] || (this.ppU[n] = gl.getUniformLocation(this.pp, n));
                gl.useProgram(this.pp);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.ppBuf);
                gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
                gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 28, 20);
                gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.ppTex); gl.uniform1i(U('uSheet'), 7);
                const a = tpAnchor(), yw = camYaw();
                gl.uniform2f(U('uA'), a[0] + lastCamX, a[1] + lastCamY); gl.uniform2f(U('uCS'), Math.cos(yw), Math.sin(yw));
                gl.uniform1f(U('uMag'), CINE.mag); gl.uniform1f(U('uZ0'), CINE.z0); gl.uniform1f(U('uZc'), CINE.z0); gl.uniform1f(U('uHY'), CINE.hY);
                gl.uniform1f(U('uAmb'), this.ambient); gl.uniform1f(U('uFogD'), CINE.fogD); gl.uniform1f(U('uGlow'), Math.max(0, Math.min(1, (0.62 - this.ambient) / 0.22)));
                gl.uniform1f(U('uDS'), this.cv.width / 240); gl.uniform2f(U('uRes'), this.cv.width, this.cv.height); gl.uniform1f(U('uTime'), Date.now() / 1000 % 1000);
                const R = this.rhythm || { tint: [1, 1, 1], ds: 0.45 }; gl.uniform3f(U('uTint'), R.tint[0], R.tint[1], R.tint[2]); gl.uniform1f(U('uDesat'), R.ds); gl.uniform1f(U('uGrade'), gameStarted ? 1 : 0);
                { const fc = this.fogColor(1, isNight()); gl.uniform3f(U('uFogC'), fc[0], fc[1], fc[2]); }
                const L = this.L, LW = this.LW || (this.LW = new Float32Array(24)); for (let i = 0; i < 8; i++) { LW[i * 3] = L[i * 3] + lastCamX; LW[i * 3 + 1] = L[i * 3 + 1] + lastCamY; LW[i * 3 + 2] = L[i * 3 + 2]; }
                gl.uniform3fv(U('uLW[0]'), LW);
                gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
                gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(PAPER.front || gl.CCW);
                gl.drawArrays(gl.TRIANGLES, 0, PAPER.verts);
                gl.disable(gl.CULL_FACE);
                this.heroPaper = false;
                if (heroHD.req && paperHeroLive() && !viewFirst()) { // the rigged paper hero: posed on the CPU each frame, drawn through the same shader and depth buffer
                    const pv = paperHeroPose();
                    if (!this.phBuf) { this.phBuf = gl.createBuffer(); this.phTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.phTex);
                        [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, PAPER_HERO.img); }
                    else gl.bindTexture(gl.TEXTURE_2D, this.phTex);
                    gl.bindBuffer(gl.ARRAY_BUFFER, this.phBuf); if (this.phLen !== pv.length) { gl.bufferData(gl.ARRAY_BUFFER, pv, gl.DYNAMIC_DRAW); this.phLen = pv.length; } else gl.bufferSubData(gl.ARRAY_BUFFER, 0, pv); // one buffer, refilled in place
                    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 28, 20);
                    gl.drawArrays(gl.TRIANGLES, 0, PAPER_HERO.bodyVerts); this.heroPaper = true; heroHD.lastP = this.viewForward(heroHD.req.x, heroHD.req.y); // the pouch fan and the held-item effects still read where he stands
                    if (PAPER_HERO.toolVerts) { gl.uniform1i(U('uSheet'), 6); gl.drawArrays(gl.TRIANGLES, PAPER_HERO.bodyVerts, PAPER_HERO.toolVerts); gl.uniform1i(U('uSheet'), 7); } // the tool card samples the hero atlas (unit 6)
                }
                gl.bindTexture(gl.TEXTURE_2D, this.tex7); gl.activeTexture(gl.TEXTURE0);
                gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(1); this.bindMain(gl);
                return true;
            },
            photoFor(room) { return this.ok && this.bgReady && this.bgKey === 'emporium'; }, // true once the room picture is on the GPU
            nbrPick() { // the place beyond the nearest edge doorway of this zone (photo zones and the town only), and where it sits in this zone's coordinates
                const here = currentMapName, ARR = { 'overworld>wastes': [2, 34] };
                const bgOf = m => m === 'overworld' ? (PAPER.on ? null : 'town') : BG_IDS[m] && ZONES[m] && ZONES[m].photo ? m : null;
                if (!bgOf(here)) return null;
                const g = navGrid(here); if (!g) return null; const [, cols, rows] = g;
                let best = null;
                for (const e of navExits(here)) {
                    const bk = bgOf(e.to); if (!bk) continue;
                    const dir = e.y <= 1 ? 'up' : e.y >= rows - 2 ? 'down' : e.x <= 1 ? 'left' : e.x >= cols - 2 ? 'right' : null; if (!dir) continue; // inner doors are walls, not windows
                    const d = Math.hypot(e.x - player.gridX, e.y - player.gridY); if (best && d >= best.d) continue;
                    const zx = ZONES[here] && ZONES[here].exits, ex = zx ? Object.values(zx).find(v => v.to === e.to) : null, arr = ex ? [ex.x, ex.y] : ARR[here + '>' + e.to]; if (!arr) continue;
                    best = { d, to: e.to, bk, dir, ex: e.x, ey: e.y, arr };
                }
                if (!best) return null;
                const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[best.dir], nz = ZONES[best.to];
                const nW = (nz ? nz.cols : MAP_COLS) * TILE_SIZE, nH = (nz ? nz.rows : MAP_ROWS) * TILE_SIZE;
                // the arrival tile over there sits one step past the doorway here
                const ox = (best.ex + step[0] - best.arr[0]) * TILE_SIZE, oy = (best.ey + step[1] - best.arr[1]) * TILE_SIZE;
                return { key: best.bk, rect: [ox, oy, nW, nH], tile: nz && nz.tile ? nz.tile : [0, 0] };
            },
            nbrUniforms(gl) {
                const now = performance.now();
                if (!this.nbrT || now - this.nbrT > 600 || this.nbrMap !== currentMapName) { this.nbrT = now; this.nbrMap = currentMapName; this.nbr = this.nbrPick();
                    if (this.nbr && this.nbrKey !== this.nbr.key) { // decode once, upload to unit 1
                        const key = this.nbr.key; this.nbrKey = key; this.nbrReady = false;
                        const img = this.imgs[key] || (this.imgs[key] = Object.assign(new Image(), { src: document.getElementById(BG_IDS[key]).textContent.trim() }));
                        const up = () => { if (this.nbrKey !== key) return; gl.activeTexture(gl.TEXTURE1); if (!this.nbrTex) { this.nbrTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.nbrTex);
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); } else gl.bindTexture(gl.TEXTURE_2D, this.nbrTex);
                            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.activeTexture(gl.TEXTURE0); this.nbrReady = true; };
                        if (img.complete && img.naturalWidth) up(); else img.addEventListener('load', up, { once: true });
                    }
                }
                const n = this.nbr, on = n && this.nbrReady && this.nbrKey === n.key ? 1 : 0;
                if (!n && this.nbrTex && (this.nbrOn || 0) < 0.01) { this.gl.deleteTexture(this.nbrTex); this.nbrTex = null; delete this.imgs[this.nbrKey]; this.nbrKey = null; this.nbrReady = false; } // memory: let the neighbour picture go
                this.nbrOn = (this.nbrOn || 0) + (on - (this.nbrOn || 0)) * 0.08;
                gl.uniform1f(this.u('uNbrOn'), this.nbrOn < 0.01 ? 0 : this.nbrOn);
                if (n) { gl.uniform4f(this.u('uNbrR'), n.rect[0], n.rect[1], n.rect[2], n.rect[3]); gl.uniform2f(this.u('uNbrT'), n.tile[0], n.tile[1]); }
            },
            useBg(key) { // one photo per zone: decode once, upload to unit 4 when the zone changes
                if (!this.ok && !this.gl) return;
                if (this.bgKey === key) return;
                if (this.gl && this.bgTex) { this.gl.activeTexture(this.gl.TEXTURE4); this.gl.bindTexture(this.gl.TEXTURE_2D, this.bgTex); this.gl.activeTexture(this.gl.TEXTURE0); } // the shared picture slot (the town's street has its own, below)
                this.bgKey = key; this.bgReady = false;
                for (const k in this.imgs) if (k !== key && k !== this.nbrKey) delete this.imgs[k]; // memory: keep only the photos in use (they decode again if we come back)
                for (const k in GEN_CACHE) if (k !== 'overworld' && 'gen:' + k !== key) delete GEN_CACHE[k]; // painted floors of other zones are repainted on return
                if (key === 'blank') { const gl = this.gl; gl.activeTexture(gl.TEXTURE4); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([58, 60, 62, 255])); gl.activeTexture(gl.TEXTURE0); this.bgReady = true; return; } // a plain stand-in while the street is painted
                if (key === 'gen:overworld' && PAPER.on) { // the town's street lives in its own texture for good, so its 7 MB canvas can go once it is on the GPU
                    const gl = this.gl; gl.activeTexture(gl.TEXTURE4); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([58, 60, 62, 255])); // empty the shared slot (the last zone's floor can be 11 MB)
                    if (!this.owTex) { this.owTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.owTex);
                        [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, genGround('overworld')); GEN_CACHE.overworld = true; } // keep the 'painted' flag, drop the canvas
                    else gl.bindTexture(gl.TEXTURE_2D, this.owTex);
                    gl.activeTexture(gl.TEXTURE0); this.bgReady = true; return; }
                if (key.startsWith('gen:')) { const gl = this.gl, cv = genGround(key.slice(4)); gl.activeTexture(gl.TEXTURE4); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.activeTexture(gl.TEXTURE0); this.bgReady = true; return; } // painted, not photographed
                if (key === 'emporium' && !document.getElementById(BG_IDS.emporium)) { // no photo supplied yet: use the stand-in picture drawn on the frame
                    const gl = this.gl; gl.activeTexture(gl.TEXTURE4); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, roomBackdrop(ROOMS.emporium)); gl.activeTexture(gl.TEXTURE0); this.bgReady = true; return;
                }
                const gl = this.gl, img = this.imgs[key] || (this.imgs[key] = Object.assign(new Image(), { src: document.getElementById(BG_IDS[key]).textContent.trim() }));
                const up = () => { if (this.bgKey !== key) return; gl.activeTexture(gl.TEXTURE4); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.activeTexture(gl.TEXTURE0); this.bgReady = true; };
                if (img.complete && img.naturalWidth) up(); else img.addEventListener('load', up, { once: true });
            },
            lights() { // pixel-space light list: lamps / torches / room lamps near the camera + the hero's lantern
                const z = ZONES[currentMapName], room = roomOfMap(currentMapName);
                if (!this.lamps) { this.lamps = []; MAP_DATA.forEach((row, r) => row.forEach((t, c) => { if (t === 13) this.lamps.push([c * TILE_SIZE + 8, r * TILE_SIZE + 5]); })); }
                const list = room ? room.lights : z ? z.torches : this.lamps, out = this.L || (this.L = new Float32Array(24));
                const cx = lastCamX + GAME_WIDTH / 2, cy = lastCamY + GAME_HEIGHT / 2;
                out.fill(0);
                const near = !room && !z && COMBAT.amt > 0.5, hx = player.pixelX + 8, hy = player.pixelY + 8, nite = isNight(); // third person sees far: the lamps nearest him, not the ones in the old screen box
                const src = near ? list.filter(l => Math.abs(l[0] - hx) < 230 && Math.abs(l[1] - hy) < 230).sort((a, b) => Math.hypot(a[0] - hx, a[1] - hy) - Math.hypot(b[0] - hx, b[1] - hy)) : list;
                for (let i = 0, k = 0; i < src.length && k < 7; i++) {
                    const l = src[i];
                    if (near || (Math.abs(l[0] - cx) < 110 && Math.abs(l[1] - cy) < 100)) { out[k * 3] = l[0] - lastCamX; out[k * 3 + 1] = l[1] - lastCamY; out[k * 3 + 2] = l[2] || (z ? 46 : near && nite ? 54 : 34); k++; }
                }
                if (room) { const p = roomProject(room, player.pixelX / TILE_SIZE + 0.5, player.pixelY / TILE_SIZE + 0.5); out[21] = p.x; out[22] = p.y - 8; }
                else { out[21] = player.pixelX + 8 - lastCamX; out[22] = player.pixelY + 8 - lastCamY; }
                out[23] = (onRiteSite() ? 50 : (HELD_ITEMS[equippedItem] && HELD_ITEMS[equippedItem].light) ? HELD_ITEMS[equippedItem].light + 6 : 38) + (z && z.dungeon ? 14 : 0); // underground the lantern reaches further // standing on a rite seal, the light around you swells
                return out;
            },
            render() {
                if (!this.ok) return;
                this.bindMain(this.gl);
                this.gl.activeTexture(this.gl.TEXTURE0); this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
                const now = performance.now(); // adaptive resolution: slow phones drop the shader canvas to 3x, then 2x
                if (this.last) this.ema = this.ema * 0.95 + (now - this.last) * 0.05;
                this.last = now;
                if (this.ema > 28 && this.level < this.LEVELS.length - 1 && ++this.slow > 90) {
                    const [w, h] = this.LEVELS[++this.level];
                    this.slow = 0; this.ema = 16; this.cv.width = w; this.cv.height = h; this.gl.viewport(0, 0, w, h);
                }
                const gl = this.gl, night = isNight() ? 1 : 0;
                const z = ZONES[currentMapName], playing = gameState === 'PLAYING' || gameState === 'INVENTORY';
                if (PAPER.on && !GEN_CACHE.overworld && gameStarted && currentMapName !== 'overworld') paperGroundStep(4); // paint the town's street in the background, a sliver a frame
                const mode = !playing ? 0 : z ? (z.dungeon ? 2 : 1) : currentMapName === 'overworld' || currentMapName === 'wolf_hollow' ? 1 : roomOfMap(currentMapName) ? 3 : 0;
                this.useBg(currentMapName === 'wolf_hollow' || (z && z.dungeon) || (currentMapName === 'overworld' && PAPER.on && mode === 1 && paperGroundStep(currentMapName === 'overworld' ? 10 : 6)) ? 'gen:' + currentMapName : currentMapName === 'overworld' && PAPER.on && mode === 1 ? 'blank' : z && z.photo && BG_IDS[currentMapName] ? currentMapName : mode === 3 ? 'emporium' : 'town');
                this.ambient += ((mode === 2 ? (z && z.home ? 0.5 : 0.28) : mode === 3 ? 0.72 : night ? 0.42 : currentMapName === 'overworld' && PAPER.on ? 0.8 : 0.64) - this.ambient) * 0.02; // slow dusk/dawn blend (kept low: the eerie look leans on the hero's own light)
                if (this.texReady) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas); // update in place, no reallocation
                else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); this.texReady = true; }
                gl.uniform2f(this.u('uCam'), lastCamX, lastCamY);
                gl.uniform3f(this.u('uView'), diorama.cur.cyl, diorama.cur.zoom, diorama.yaw);
                viewApply(); { const wz = viewFirst() ? VIEW.FP_Z : viewStreet() ? STREET.z0 : 110; /* the camera holds its distance; walls in the way are cut away instead */ CINE.z0 += (wz - CINE.z0) * (wz < CINE.z0 ? 0.3 : 0.05); if (Math.abs(wz - CINE.z0) < 0.05) CINE.z0 = wz; } gl.uniform1f(this.u('uZ0'), CINE.z0);
                gl.uniform1f(this.u('uTP'), COMBAT.amt); gl.uniform1f(this.u('uMag'), CINE.mag); gl.uniform1f(this.u('uFogD'), CINE.fogD); gl.uniform1f(this.u('uHY'), CINE.hY); this.nbrUniforms(gl); gl.uniform1f(this.u('uYaw'), camYaw()); gl.uniform1f(this.u('uDS'), this.cv.width / 240); this.rhythm = nerveGrade(this.curMode === 1 ? rhythmNow() : { tint: [1, 1, 1], ds: 0.45, fog: null }); gl.uniform3f(this.u('uTint'), this.rhythm.tint[0], this.rhythm.tint[1], this.rhythm.tint[2]); gl.uniform1f(this.u('uDesat'), this.rhythm.ds); gl.uniform1f(this.u('uVistaOn'), CINE.vista); gl.uniform1f(this.u('uVPan'), currentMapName === 'overworld' ? 0.1 * Math.min(1, Math.max(0, (player.pixelX + 8) / (MAP_COLS * TILE_SIZE))) : 0.05); gl.uniform2f(this.u('uTileS'), z && z.tile ? z.tile[0] : 0, z && z.tile ? z.tile[1] : 0); gl.uniform1f(this.u('uGrade'), gameStarted ? 1 : 0);
                { const fc = this.fogColor(mode, night); gl.uniform3f(this.u('uFogC'), fc[0], fc[1], fc[2]); } { const a = tpAnchor(); gl.uniform2f(this.u('uHero'), a[0], a[1]); }
                gl.uniform1f(this.u('uTime'), Date.now() / 1000 % 1000);
                gl.uniform1f(this.u('uAmb'), this.ambient);
                gl.uniform1f(this.u('uMode'), mode);
                gl.uniform2f(this.u('uWorld'), mode === 3 ? GAME_WIDTH : z ? z.cols * TILE_SIZE : currentMapName === 'wolf_hollow' ? WOLF_HOLLOW_MAP[0].length * TILE_SIZE : MAP_COLS * TILE_SIZE, mode === 3 ? GAME_HEIGHT : z ? z.rows * TILE_SIZE : currentMapName === 'wolf_hollow' ? WOLF_HOLLOW_MAP.length * TILE_SIZE : MAP_ROWS * TILE_SIZE);
                gl.uniform1f(this.u('uBGOn'), this.bgReady ? 1 : 0);
                gl.uniform1f(this.u('uNight'), night ? this.ambient < 0.7 ? 1 : 0.5 : 0);
                const Lts = this.lights(); gl.uniform3fv(this.u('uL[0]'), Lts);
                { // the same lights, moved to where they land on screen in third person, for the standing sprites (hero, cards, horse)
                    const Ls = this.Ls || (this.Ls = new Float32Array(24));
                    for (let i = 0; i < 8; i++) {
                        const x = Lts[i * 3], y = Lts[i * 3 + 1], r = Lts[i * 3 + 2];
                        if (r > 0 && COMBAT.amt > 0.001) {
                            const q = i === 7 ? this.viewForward(player.pixelX + 8 - lastCamX, player.pixelY + 15 - lastCamY) : this.viewForward(x, y);
                            Ls[i * 3] = q[0]; Ls[i * 3 + 1] = i === 7 ? q[1] - 12 * q[2] : q[1]; Ls[i * 3 + 2] = q[2] ? r * Math.max(1, q[2]) : 0;
                        } else { Ls[i * 3] = x; Ls[i * 3 + 1] = y; Ls[i * 3 + 2] = r; }
                    }
                }
                gl.uniform2f(this.u('uFocus'), Lts[21], Lts[22]);
                gl.uniform1f(this.u('uDOF'), 0); // tilt-shift blur removed per request; keep uniform wired in case it returns
                const site = RITE_SITES.find(r => r.map === currentMapName);
                gl.uniform1f(this.u('uDecalOn'), site && this.decalReady && mode === 1 ? 1 : 0);
                if (site) gl.uniform4f(this.u('uDecal'), site.decal[0] * TILE_SIZE, site.decal[1] * TILE_SIZE, site.decal[2] * TILE_SIZE, site.decal[3] * TILE_SIZE);
                gl.disable(gl.DEPTH_TEST); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                this.curMode = mode;
                this.paperZ = mode === 1 && paperLive() && this.drawPaper(gl); // the folded town, then everything standing is depth-tested against it
                if (this.paperZ) { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); }
                this.drawCards(gl, true);
                if (heroHD.req) { if (!this.heroPaper && !viewFirst()) this.drawHero(gl); heroHD.req = null; }
                this.drawCards(gl, false); CARDS.list.length = 0;
                if (this.paperZ) { gl.disable(gl.DEPTH_TEST); this.paperZ = false; }
            }
        };

