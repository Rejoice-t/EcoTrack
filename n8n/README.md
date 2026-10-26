# n8n: AI Resource Coach workflow

EcoTrack works without this. If n8n is missing, slow, or returns something unexpected, EcoTrack uses its built-in tips automatically.

## Flow

```
Webhook (header auth) → Validate and build prompt → Ask the LLM → Parse and validate reply → Respond to EcoTrack
```

## Setup

1. **Run n8n**
   - Local: `npx n8n` (needs Node.js 20+), then open http://localhost:5678
   - Or use an n8n Cloud trial.
2. **Import** `workflows/ecotrack-coach.json` (Workflows → Import from file).
3. **Create two credentials** (type _Header Auth_):
   - `EcoTrack shared secret`: Name `X-EcoTrack-Secret`, Value: a long random string.
   - `Anthropic API key`: Name `x-api-key`, Value: your API key.
     Open the **Webhook** and **Ask the LLM** nodes and select these credentials.
4. **Activate** the workflow and copy the **Production URL** from the Webhook node.
5. In EcoTrack's `.env`:
   ```ini
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/ecotrack-coach
   N8N_SHARED_SECRET=<the same random string as step 3>
   ```
6. Restart EcoTrack. `http://127.0.0.1:8000/api/health` should show `"coach_mode": "ai"`. Coach answers then show the **AI suggestion** badge.

Generate a secret in PowerShell:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

## Using a different LLM provider

Only the **Ask the LLM** node and the first lines of **Parse and validate reply** depend on the provider.

| Provider  | URL                                          | Auth header               | Reply text is at             |
| --------- | -------------------------------------------- | ------------------------- | ---------------------------- |
| Anthropic | `https://api.anthropic.com/v1/messages`      | `x-api-key`               | `content[0].text`            |
| OpenAI    | `https://api.openai.com/v1/chat/completions` | `Authorization: Bearer …` | `choices[0].message.content` |

For OpenAI, change the body to `{ model, messages: [{role:'system', content: $json.system}, {role:'user', content: $json.user}] }`.

## What is sent

Aggregated totals, daily averages, top activities and appliance categories with shares, goal status, whether the data is demo data, and whether costs are available. **Never** notes, record IDs, names or addresses. Successful executions are not saved (`saveDataSuccessExecution: none`).
