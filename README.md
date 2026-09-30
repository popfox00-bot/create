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
- **Private by design**: no accounts, no tracking and no third-party scripts. The API key stays on the server. You can put the whole app behind a password with `APP_PASSWORD`.

## How it works

```
browser (sketches → PNG + text)
   └─► POST /api/search  (server.js)
          └─► Claude (vision + web_search tool)  (search.js)
                 · reads the sketches and text together
                 · runs several web searches and checks the candidates
                 · returns ranked matches as JSON
          └─► fetches og:image thumbnails for results (SSRF-guarded)
```

## Setup

Requires Node 20 or newer.

```bash
npm install
cp .env.example .env      # then add your ANTHROPIC_API_KEY
npm start                 # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required. Used only on the server. |
| `PORT` | Port to listen on (default `3000`). |
| `APP_PASSWORD` | Optional. Requires HTTP basic auth (any username) to use the app. |
| `SEARCH_MODEL` | Optional. Overrides the model (default `claude-opus-5-5`). |

To use it from your phone, run it on a machine your phone can reach, set `APP_PASSWORD`, and ideally put it behind HTTPS (for example with a reverse proxy or a tunnel).

## Project layout

```
server.js        Express server, static files, /api/search, optional password
search.js        Prompt, Claude call with web search, result parsing, thumbnails
public/
  index.html     Page shell and toolbox markup
  canvas.js      SketchPad drawing engine (vector strokes, undo/redo, export)
  app.js         UI: tools, sketch tabs, submit, results rendering
  styles.css     Inkling look, light and dark themes, mobile layout
  logo.svg       Ink-and-quill logo (also favicon.svg)
```
