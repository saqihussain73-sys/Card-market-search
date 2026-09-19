# Card Market Search

Standalone Express app for comparing sealed TCG product prices using tcgcsv (TCGplayer daily mirror). Prices are in USD and may be delayed.

## Run

Requires Node.js 20+. Run `npm install` then `npm start`. Open http://localhost:8080. Health check: `/health`. APIs: `/api/categories` and `/api/compare-boxes?game=riftbound`.

## Railway

Create a new Railway project, select Deploy from GitHub repo and choose this repository. Railway detects Node.js and runs `npm start`; it supplies `PORT`. No API key is needed.

## Limitations

Sealed product detection uses name matching. Prices are daily-mirror TCGplayer data, not live UK retail prices; no graded-card prices or GBP conversion.
