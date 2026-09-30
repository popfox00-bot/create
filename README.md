# Inkling

**Sketch it. Describe it. Find it.**

Inkling is a private, freeform alternative to a keyword search box. You describe what you're looking for by **drawing** and **writing**, and Inkling searches the web for matches:

- Draw a couch, highlight the curved arm, and write "mustard velvet, tapered legs". Inkling finds couches that match.
- Draw a scene and describe the plot. Inkling works out which movie it is.
- Add **several sketches** to one search, each showing a different feature or view of the same thing, and give each one its own caption.

## Features

- **Sketch pad** that works with a mouse on desktop and with touch or a stylus on mobile (Pointer Events, with stylus pressure).
- **Collapsible toolbox**: pen, marker, highlighter (for "this part matters"), eraser, colours, size, undo/redo and clear.
  - Shortcuts: `P` pen, `M` marker, `H` highlighter, `E` eraser, `[` / `]` size, `Ctrl+Z` / `Ctrl+Shift+Z`, `Ctrl+Enter` to search.
- **Multiple sketches per search**, shown as thumbnail tabs (up to 6), each with an optional caption.
- **Results** show what Inkling understood, the features it picked out, ranked matches with thumbnails, "why it matches" notes, a confidence bar, and the queries and pages it used.
- **Private by design**: no accounts, no tracking and no third-party scripts (the Anthropic SDK is bundled locally).

## Two ways to run it

### 1. GitHub Pages (no server): https://popfox00-bot.github.io/inkling/

Open the site, tap the ⚙ settings button, and paste your own [Anthropic API key](https://console.anthropic.com/settings/keys). Searches then run directly from your browser to `api.anthropic.com`.

- The key is stored only in that browser (`localStorage`, or for the current tab only if you untick "Remember on this device"). It is never sent anywhere except Anthropic.
- Anyone else who opens the site needs their own key, so your key is never shared.
- Set a monthly spend limit on the key in the Anthropic Console, since anyone with access to your browser could use it.
- Result thumbnails come only from images the search found. Pages can't fetch preview images from other sites.

Pages serves the repository root: `index.html` is the app, and `.nojekyll` stops Jekyll from processing it.

### 2. Your own server (the key stays on the server)

Requires Node 20 or newer.

```bash
npm install
cp .env.example .env      # then add your ANTHROPIC_API_KEY
npm start                 # http://localhost:3000
```

When the server has a key, the app uses it automatically and never asks visitors for one. The server also fetches `og:image` preview thumbnails for results, with a guard against requests to private addresses.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required. Used only on the server. |
| `PORT` | Port to listen on (default `3000`). |
| `APP_PASSWORD` | Optional. Requires HTTP basic auth (any username) to use the app. |
| `SEARCH_MODEL` | Optional. Overrides the model (default `claude-opus-5-5`). |

To use it from your phone, run it on a machine your phone can reach, set `APP_PASSWORD`, and ideally put it behind HTTPS (for example with a reverse proxy or a tunnel).

## How it works

```
browser (sketches → PNG + text)
   ├─► server mode:  POST /api/search (server.js) ─┐
   └─► Pages mode:   Anthropic SDK in the browser ─┴─► searchWithClient() (public/search-core.js)
                                                         Claude (vision + web_search tool)
                                                         · reads the sketches and text together
                                                         · runs several web searches, checks candidates
                                                         · returns ranked matches as JSON
```

## Project layout

```
index.html              The app page (served by Pages and by server.js)
server.js               Express server: /, /public, /api/search, optional password
search.js               Server-side search: API client and og:image thumbnails
public/
  search-core.js        Prompt, Claude call with web search, result parsing (shared)
  canvas.js             SketchPad drawing engine (vector strokes, undo/redo, export)
  app.js                UI: tools, sketch tabs, settings, submit, results
  styles.css            Inkling look, light and dark themes, mobile layout
  logo.svg              Ink-and-quill logo (also favicon.svg)
  vendor/anthropic-sdk.js  Bundled browser build of @anthropic-ai/sdk
scripts/vendor-entry.js  Entry point for `npm run build:vendor`
```

After upgrading `@anthropic-ai/sdk`, run `npm run build:vendor` to rebuild the browser bundle.
