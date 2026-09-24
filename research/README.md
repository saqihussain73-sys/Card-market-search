# Historical TCG research (isolated)

The existing Node/Express dashboard and Railway start command remain unchanged. This directory is a separate research component, not a deployed API.

Install: `python -m pip install -r research/requirements.txt`.

The historical scanner source supplied in chat still needs to be added and validated before enabling scheduled execution. Do not schedule archive downloads or rely on backtest profitability until archive compatibility, missing exits, purchase costs and persistence are tested. Railway ephemeral filesystem is not suitable for a durable SQLite history; mount a persistent volume or use a managed database first.
