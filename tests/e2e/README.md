# Safe browser checks

These tests never press **Send**, call Telnyx, create leads, or modify Supabase data.

## First-time setup

1. Install the browser once:
   ```bash
   npx playwright install chromium
   ```
2. Start the app locally with its normal environment variables:
   ```bash
   npm run dev
   ```
3. In a second terminal, save an authenticated test session. Sign in manually when the browser opens, then close it:
   ```bash
   npx playwright codegen --save-storage=playwright/.auth/user.json http://127.0.0.1:3000/login
   ```
4. Run the safe Inbox smoke checks:
   ```bash
   PLAYWRIGHT_STORAGE_STATE=playwright/.auth/user.json npm run test:e2e
   ```

`playwright/.auth/` must stay private. It contains login cookies and is ignored by Git.
