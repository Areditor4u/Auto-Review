# Ray Choice Center — AI Smart Review Assistant (Pro)

Mobile-friendly review-draft assistant with Hindi, Hinglish, and English options, service/tone selection, copy-and-open Google Review, and QR poster generation.

## Project files
- `index.html` — frontend UI
- `api/ai.js` — Vercel serverless endpoint (`POST /api/ai`)
- `.env.example` — variable names only; never put a real key here

## Important
GitHub Pages only serves static files and cannot execute `api/ai.js`. Deploy this repository on Vercel so `/api/ai` runs. The Gemini API key is kept server-side in `GEMINI_API_KEY`, not in HTML.

## Deploy using a phone
1. Upload `index.html`, the `api` folder containing `ai.js`, `README.md`, and `.gitignore` to the root of your GitHub repository.
2. Sign in to Vercel and import that GitHub repository as a new project.
3. In Vercel, open **Project → Settings → Environment Variables**.
4. Add `GEMINI_API_KEY` as the name and paste your Gemini API key as the value. Select Production (and Preview if needed).
5. Optional: add `GEMINI_MODEL` with value `gemini-2.5-flash`. If omitted, this model is used automatically.
6. Save variables and redeploy the project.
7. Open the deployed Vercel URL, select language/service, add true customer-experience notes, and generate a draft.

## Troubleshooting
- `GEMINI_API_KEY is not set`: add the environment variable and redeploy.
- `401/403`: verify the API key and API permissions in Google AI Studio.
- `404/model not found`: check `GEMINI_MODEL`; default is `gemini-2.5-flash`.
- `429/quota`: check Gemini quota and retry later.
- `/api/ai` 404: ensure `api/ai.js` is in the repository root's `api` folder and deployment is on Vercel, not GitHub Pages alone.

## Security and review authenticity
Never commit a real API key to GitHub or put it in browser code. Generated text is only a draft; the customer should edit it to reflect their genuine experience. This starter includes input validation, timeout handling, and readable errors, but public production use may also need rate limiting.
