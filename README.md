# Nexus Bank

A React and Material UI portal for Nexus Bank (P629) on the SharedBank test network. Sign in with a Nexus customer account to view balances, review and send an INR transfer, and search transaction history. Select a transfer for its status and downloadable details. CSV export includes the rows matching the current filters.

Choose **Explore browser demo** on the sign-in page to try the same interface using the local Nexus and Lyra sample accounts. Demo transfers use the existing browser ledger. **Live sign-in** returns to the Worker-backed portal.

## Run and publish

With Node.js 22, run `npm ci` and `npm run dev`. Run `npm run build` to create the production site in `dist/`. The repository's **Deploy bank page** workflow publishes pushes to `main` using GitHub Pages.

## Worker connection

The portal uses the Worker origin in `src/cloudflare-config.js`. The existing GitHub Actions variable `VITE_X42_API_URL` can override it at build time. The Worker must allow the origin of the portal.

| Action | Existing endpoint |
| --- | --- |
| Sign in | `POST /api/v1/banks/P629/sign-in` |
| Accounts and recent activity | `GET /api/v1/banks/P629/dashboard` |
| Bank directory | `GET /api/v1/directory/banks` |
| Send a reviewed transfer | `POST /api/v1/banks/P629/transfers` |

Dashboard requests use the session token and refresh once a minute while the tab is visible. Use **Refresh** for an immediate update. Transfers send an idempotency key. If a response is lost, check activity and retry with the same details in the same tab. A pending transfer shows its current status until the Worker reports completion.
