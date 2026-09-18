# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Design Principles**: Keep It Simple, Stupid (KISS) and You Aren't Gonna Need It (YAGNI). This setup is for learning purposes - prioritize simplicity and clarity over advanced features.

## Project Overview

A collection of four static browser tools for endurance training analysis, published as a
GitHub Pages site. Everything runs client-side in the browser - there is no backend, no
build step and no bundler. Each tool is a directory with its own `index.html`.

The tools share one idea: a handful of parameters (a *fitness signature*) describe an
athlete's capacity, and curves, race times, training load and interval prescriptions are
all derived from it.

| Directory | Tool | Parameters |
|---|---|---|
| `power-curve/` | Cycling power curve, Critical Power model | TP, HIE (= CP, W') |
| `running/` | Running performance, Critical Speed model and race prediction | CS, D' |
| `fit-analysis/` | FIT file analysis, NP/TSS, workout editor | FTP, exponent, window length |
| `wbal/` | Interval Optimizer, prescribes interval power from a target W'bal | CP, W', tau |

UI text is in Swedish.

## Directory Structure

```
.
├── index.html              # Landing page linking the tools
├── CLAUDE.md
├── .github/workflows/
│   ├── pages.yml           # Deploy to GitHub Pages on push to master
│   └── check.yml           # Syntax, lint and tests on every push
├── docs/                   # Documentation of the training models (Swedish)
├── power-curve/
│   └── index.html          # Self-contained: markup, styles and logic in one file
├── running/
│   └── index.html          # Self-contained
├── fit-analysis/
│   ├── index.html          # Loads only module-loader.js; the rest is injected on DOMContentLoaded
│   ├── fit-analysis.js     # Main logic
│   ├── module-loader.js    # CommonJS shim + sequential loader for the scripts below
│   ├── dist/               # Vendored fit-parser (binary, fit, fit-parser, helper, messages)
│   ├── sample-workout.json # Default workout, loaded with fetch()
│   └── styles.css
└── wbal/
    ├── index.html
    ├── model.js            # Templates, W'bal simulation and solver - no DOM
    ├── script.js           # DOM and rendering; calls model.js
    ├── test/model.test.js  # node --test: invariants and the documented baseline
    ├── styles.css
    ├── package.json        # Lint and test tooling only - not a build or a runtime dependency
    ├── eslint.config.mjs   # Flat config, with sonarjs rules
    ├── .eslintrc.js        # Legacy config, still present
    └── .jshintrc
```

## Common Commands

```bash
# Serve the site locally (open http://localhost:8000)
python3 -m http.server 8000

# Lint wbal/
cd wbal && npx eslint script.js model.js
cd wbal && npx jshint script.js model.js

# Test wbal/ (node --test, no dependencies beyond Node itself)
cd wbal && npm test
```

`fit-analysis/` fetches `sample-workout.json` at startup, so it must be served over HTTP -
opening the file directly from disk breaks that fetch. The other tools work either way, but
serving the whole repo is the simplest approach.

## External Dependencies

Loaded from CDN at runtime, not installed:

- **Chart.js 4.4.0** (cdnjs) - `power-curve/`, `running/`, `fit-analysis/`
- **Tailwind CSS** (play CDN) - `index.html`, `power-curve/`

`power-curve/` and `running/` load Chart.js with a plain `<script>` tag; `fit-analysis/`
loads it dynamically through `module-loader.js`. `wbal/` has no external dependencies, and
the FIT parser is vendored in `fit-analysis/dist/`.

## Deployment

`.github/workflows/pages.yml` deploys to GitHub Pages on every push to `master`, and can be
run manually via `workflow_dispatch`. It copies the repository to `_site` with rsync,
excluding `.git`, `.github`, `node_modules` and `CLAUDE.md`. There is no build step.

`.github/workflows/check.yml` runs on every push and pull request: `node --check` on every
`.js` file outside `wbal/node_modules/`, eslint and jshint on `wbal/script.js` and
`wbal/model.js`, and `npm test` in `wbal/`. It installs nothing - `wbal/node_modules/` is
committed and `node --test` ships with Node. Only `wbal/` has tests; the other three tools
are single HTML files and are verified in the browser.

## Documentation

`docs/` documents the physiological and coaching models embedded in the tools - not the code
or the UI. `docs/README.md` is the index. `docs/06-etablerat-vs-eget.md` separates
established published models from home-grown constructions and is the one to read first.
`docs/07`-`docs/10` are per-tool lists of known faults, each with file and line, mechanism,
measured magnitude and a classification as model or implementation error. Consult these
before changing any calculation - a formula that looks wrong may already be documented, and
one that looks right may be a known fault.

## Conventions

- No build step. Edit the files and reload the browser.
- Keep each tool self-contained; the tools share no code with each other.
- `wbal/node_modules/` is committed to the repository. It is lint tooling and is excluded
  from the deploy; leave it alone unless the lint setup is the task at hand.
- `.gitignore` contains only `.env`.

## Adding a New Tool

1. Create a directory with an `index.html`
2. Add a card linking to it in the root `index.html`
3. Push to `master` - the Pages workflow picks it up with no configuration change
