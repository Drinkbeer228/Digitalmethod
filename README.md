# Masterson Case Digital

An offline-first field notebook for equine bodywork practitioners. It records a palpation session on an anatomical map of the horse, keeps photos and voice notes, and produces a clean A4 PDF report for the owner or a colleague. Everything runs in the browser and stays on the device.

**Live app:** https://drinkbeer228.github.io/Digitalmethod/ (installable as a PWA)

> Independent field tool inspired by Jim Masterson's *Beyond Horse Massage* and research on equine myofascial kinetic lines (V.S. Elbrønd & R.M. Schultz). Not an official product of The Masterson Method®. Not veterinary advice.

## Features

- **Evaluation map.** 21 anatomical zones on left / right profile and top-view diagrams. Each side of each zone records reaction level (1–3), restriction and release, response and release signs, resistance signs, techniques and a note. The diagram markers stay in sync with the zone table.
- **Zone reference.** For any zone: which myofascial kinetic lines pass through it, the related zones on each line (highlighted when marked), Masterson techniques with pressure range, and the zone's place in the session order. Every entry cites its source and page.
- **Clinical insights.** Optional hints that match the marked zones against a base of compensation patterns. Read-only practitioner aid; nothing is diagnosed or shown to the owner automatically.
- **Voice notes.** Record audio and transcribe it fully on-device with Whisper (ONNX via `@huggingface/transformers`). The model is downloaded once (or imported from files) and cached locally.
- **Before / after photos**, compressed on the device and embedded in the report.
- **PDF report** (A4, generated offline with `pdf-lib`, Latin + Cyrillic fonts):
  - "For owner" and "For specialist" presets, plus per-section toggles (zones & responses, myofascial lines, Masterson work plan, owner care, notes, pattern lines, photos). The choice is remembered.
  - Long notes flow onto extra pages instead of being cut.
  - Share via the system share sheet (iOS / Android) or download.
- **Horses & sessions** stored in IndexedDB (Dexie), with JSON backup export / import.
- **English and Russian** interface and reports.
- **Works offline** once loaded: service worker, local fonts, local model cache.

## What the app does not do

Palpation of a standing horse cannot tell primary lameness from compensatory movement; that needs gait analysis and a veterinary exam. The app records findings and shows source-backed reference material. It makes no diagnosis, and the reports say so.

## Getting started

Requirements: Node.js 22.

```bash
npm ci --legacy-peer-deps
```

```bash
npm run dev
```

The dev server runs on http://localhost:3000. Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npx tsc --noEmit` | Type check (`npm run lint` does the same) |
| `npx tsx --test 'src/**/*.test.ts'` | Unit tests (Node test runner) |

Some PDF tests also check the extracted text with `pdftotext` (poppler-utils) when it is installed; without it those checks are skipped.

## Deployment

Every push to `main` runs `.github/workflows/main.yml`: type check, unit tests, build with `VITE_BASE_PATH=/Digitalmethod/`, and deploy to GitHub Pages.

## Project structure

```
src/
  App.tsx                 app shell: evaluation, report and horses views
  components/             UI: zone table and editor, diagrams, PDF export panel, sheets
  data/
    anatomicalAreas.ts    the 21 zones, regions, filters, diagram coordinates
    clinicalReference.ts  myofascial lines, Masterson techniques, session order (cited)
    biomechanicalPatterns.ts  pattern base used by Clinical Insights
    translations.ts       EN / RU strings
  db/                     IndexedDB (Dexie), backups, photos, audio recovery
  utils/
    pdfExport.ts          A4 PDF generation
    pdfExportOptions.ts   PDF section presets and saved choice
    reportGenerator.ts    report text from the session
    patternDetection.ts   pattern matching for Clinical Insights
    caseParser.ts         turns practitioner notes into zone suggestions
  whisper/                on-device speech-to-text
  pwa/                    install banner
public/                   diagrams, fonts, icons, manifest, service worker, ONNX runtime files
```

## Data and privacy

Horses, sessions, photos, recordings and the speech model are stored only in the browser (IndexedDB / OPFS) on the device where the app is used. Nothing is sent to a server. Use **Backup** in the Horses view to move data between devices or keep a copy.

## Sources

- V.S. Elbrønd, R.M. Schultz (2015). *Myofascia — the unexplored tissue: myofascial kinetic lines in horses.* Medical Research Archives 3.
- V.S. Elbrønd, R.M. Schultz (2021). *Deep myofascial kinetic lines in horses, comparative dissection studies derived from humans.* Open Journal of Veterinary Medicine 11(1), 14–40.
- J. Masterson (2012). *Beyond Horse Massage.*

## Acknowledgements

Parts of the on-device Whisper storage and inference code are adapted from *browser-whisper* by Tanpreet Singh Jolly (MIT License).
