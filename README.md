# EcoTrack — Smart Household Resource Management

**Understand your usage. Reduce your waste. Save your resources.**

EcoTrack helps Namibian households see where their water and electricity go. You log everyday activities (a 10-minute shower, a kettle boiled 4 times a day), and EcoTrack estimates the litres, kWh and N$ cost, ranks the biggest contributors, tracks budget goals and gives practical advice through an AI coach.

> EcoTrack **estimates** consumption from recorded activities. It is not connected to a meter, and every figure is labelled as an estimate, demo data, an illustrative rate, or an AI suggestion.

Built for the FNB App of the Year Hackathon 2026 (climate resilience and essential services).

## Features

| Feature | What it does |
|---|---|
| Your household | An isometric view of your household: a water tank filled to the litres used, and a stack of energy blocks per appliance. Totals, estimated cost, change from the previous period, top uses and goal progress |
| Track water | Add, edit and delete activities. Estimate by *time × flow rate* or by *known litres* |
| Track electricity | Add, edit and delete appliance use. Estimate by *watts × time*, or enter kWh directly (better for fridges) |
| Analytics | Daily charts, use by activity and appliance, cost by category, and **Where are my resources going?** |
| Resource coach | Ask questions about your data. Uses an LLM through n8n, with a rule-based fallback that always works |
| Goals | Budget goals (e.g. stay under 12,000 L this month) with progress bars |
| Tips | 12 practical, safe conservation tips |
| Settings | Your own tariffs (flat rate), demo data controls, and the formulas used |

## Quick start (Windows PowerShell)

Requires Python 3.11+.

```powershell
git clone https://github.com/Rejoice-t/EcoTrack.git
cd EcoTrack
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --app-dir backend --reload
```

Open **http://127.0.0.1:8000** and click **Load demo household**.

- API documentation: http://127.0.0.1:8000/docs
- Run the tests: `python -m pytest -q`

## How the numbers are calculated

| Quantity | Formula |
|---|---|
| Water (L) | flow rate (L/min) × duration (min) × times, or litres × times |
| Energy (kWh) | watts × hours per use × uses per day × days ÷ 1000, or kWh entered directly |
| Water cost (N$) | litres ÷ 1000 × tariff per m³ |
| Electricity cost (N$) | kWh × rate per kWh |

- **No tariff, no cost.** Costs are hidden until you enter your own rates.
- **Flat rate only.** Real bills can include block tariffs, fixed charges, levies and VAT, so costs are a usage estimate, not a bill.
- **No double counting.** A record covering several days (e.g. a fridge for a month) is spread evenly over its days, so weekly and monthly views add up correctly. This is covered by tests.
- **Default values are illustrative.** Flow rates and wattages in the forms are starting points; users should check their own appliance labels.

## Architecture

```
Browser (HTML, CSS, vanilla JS, Chart.js, Lucide icons, local fonts — all served locally, works offline)
   │ fetch /api/...
   ▼
FastAPI ── routes (Pydantic validation) ── services (calculations, aggregation, goals, coach) ── SQLAlchemy ── SQLite
   │
   │ POST aggregated summary only + shared-secret header, 20 s timeout
   ▼
n8n webhook → validate → prompt → LLM → validate JSON → respond
   (any failure, timeout or invalid reply → EcoTrack's rule-based coach)
```

```
backend/app/   main.py, config.py, database.py, models.py, seed.py
               routes/  schemas/  services/
frontend/      index.html, css/, fonts/, js/ (app, api, utils, iso, views/, vendor/)
data/          seed_data.json (fictional household), tips.json
n8n/           workflows/ecotrack-coach.json, README.md
tests/         47 tests: calculations, CRUD, aggregation, goals, coach success and failure
docs/          architecture.md, security.md
```

## Design

Flat colour only: no gradients, no drop shadows, no emoji. Icons are Lucide. Headings use Bricolage Grotesque and body text uses Atkinson Hyperlegible, a typeface designed for readability. The household view is drawn as flat-shaded isometric SVG.

## AI Resource Coach

The coach works without any setup using built-in rules. To switch on the LLM version, follow [`n8n/README.md`](n8n/README.md) and set `N8N_WEBHOOK_URL` and `N8N_SHARED_SECRET` in `.env`. `GET /api/health` shows `coach_mode: "ai"` when it is configured.

Only totals and rankings are sent: no notes, no names, no addresses. The reply is validated twice (in n8n and in FastAPI) and shown with `textContent` only.

## Security and privacy

See [`docs/security.md`](docs/security.md). In short: secrets live in `.env` (never committed) and n8n credentials; all input is validated; the AI receives aggregates only; AI and user text is never inserted as HTML.

## Limitations

- Single household, no login. Intended to run locally or on a trusted network.
- Estimates depend on what users record and on their assumptions.
- Flat-rate tariffs only.

## Future work

Block tariffs and fixed charges, meter-reading entry to compare estimates with real readings, multiple households with accounts, offline-first mobile app, MySQL deployment (change `DATABASE_URL`).