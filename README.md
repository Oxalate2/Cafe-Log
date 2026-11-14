# Cafe Log

A flip-through journal of every cafe you visit, made to be added to an iPhone or iPad home screen.
Live at https://oxalate2.github.io/Cafe-Log/

The app is plain HTML, CSS and JavaScript (no build step). Journal pages are stored only on each device.

## Run it on this computer

    npm run serve        # http://localhost:5173

## Tests

Browser tests (`tests/app.spec.js`) use the app like a person would on an iPhone 14 Pro and an iPad (A16),
upright and sideways, in Safari's engine (WebKit) and in Chrome. Screenshot tests (`tests/visual.spec.js`)
compare key screens with reference pictures in `tests/screens/`.

    npm install                       # first time only
    npx playwright install webkit     # first time only
    npm test                          # run everything
    npm run test:report               # see results, including screenshot differences side by side
    npm run test:update-screens       # after an intended change to the look, re-take the reference pictures
