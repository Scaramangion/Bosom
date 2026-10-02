# Put Bosom on your iPhone home screen

You need a free place to host these files. GitHub Pages works from your phone.

## One time setup
1. In Safari go to github.com, sign in (or make a free account).
2. Tap **+** then **New repository**. Name it `bosom`, keep it **Public**, tap **Create repository**.
3. Tap **uploading an existing file**. Pick all 6 files from this folder:
   `index.html`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
   Tap **Commit changes**.
4. Go to **Settings > Pages**. Under Source choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
5. Wait about a minute. Your game address is `https://YOURNAME.github.io/bosom/`.
6. Open that address in **Safari** (not another browser), tap **Share > Add to Home Screen > Add**.
7. Open the new Bosom icon once while online. That saves the game and its font for offline play.

## Every time I give you a new build
Upload the new `index.html` (and `sw.js` if I say it changed) to the same repo with **Add file > Upload files**, using the same file names, then commit. The next time you open the app with internet, you get the new version. Without internet you get the last one you loaded.

## Good to know
- Your progress saves automatically on your phone. Journal > NEW GAME erases it.
- GitHub Pages sites are public. Anyone with the address can play.
- `index.html` also works on its own as an offline file if you'd rather not host it.
