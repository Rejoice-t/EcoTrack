# Security and privacy overview

| Area                 | What EcoTrack does                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secrets              | `.env` holds the n8n URL and shared secret and is git-ignored. `.env.example` has no values. The LLM API key lives only in n8n's credential store. `SecretStr` hides the secret if settings are printed.                                                           |
| Browser              | Never calls the LLM or n8n. It only talks to EcoTrack's own `/api`.                                                                                                                                                                                                |
| Input validation     | Pydantic schemas on every request: allowed activity types, non-negative numbers with sensible maximums, text length limits, cross-field rules (e.g. litres _or_ flow + duration). Invalid input returns 422. Calculation functions check again (defence in depth). |
| SQL injection        | All database access goes through SQLAlchemy, which parameterises queries.                                                                                                                                                                                          |
| XSS                  | All user and AI text is inserted with `textContent`, never `innerHTML`.                                                                                                                                                                                            |
| AI data minimisation | Only aggregates are sent to n8n: totals, shares, goal status. No notes, IDs, names or addresses. Prompts and household data are not logged.                                                                                                                        |
| AI output            | Validated in n8n and again in FastAPI against a strict schema. Invalid replies, errors and timeouts (20 s) fall back to rule-based tips.                                                                                                                           |
| Webhook              | Protected by a shared-secret header (n8n Header Auth).                                                                                                                                                                                                             |
| CORS                 | Off by default: the frontend is served from the same origin. Only enabled for origins listed in `ALLOWED_ORIGINS`.                                                                                                                                                 |
| Honesty              | Every figure is labelled (estimate, demo data, illustrative rate, AI suggestion). No invented tariffs or live readings.                                                                                                                                            |

## Limitations of the prototype

- No authentication: anyone who can reach the server can read and change the data. Run it locally or on a trusted network.
- Single household.
- For a real deployment: add accounts, HTTPS, rate limiting on `/api/coach`, and move to a managed database.

## Development process (SDLC)

1. **Design**: brief reviewed, contradictions resolved, architecture and data model documented before coding.
2. **Build in layers**: pure calculation functions with tests first, then database, API, frontend, AI.
3. **Test**: 47 automated tests (pytest) covering calculations, validation, CRUD, aggregation without double counting, goals, and AI success, invalid response and timeout.
4. **Version control**: Git and GitHub with small commits; secrets never committed.
5. **Review**: manual end-to-end runs on desktop and mobile widths.
