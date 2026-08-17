#!/usr/bin/env bash
# One command from a funded address to a live Sepolia deployment.
set -euo pipefail
cd "$(dirname "$0")/.."

export NETWORK=sepolia
echo "── 1/4  checking funding"
npx tsx scripts/check-funding.ts

echo "── 2/4  deploying the account"
npx tsx scripts/deploy-account.ts

echo "── 3/4  building contracts"
(cd ../../cairo && scarb build)

echo "── 4/4  declaring and deploying CrewKill"
set -a; . ./.env.sepolia; set +a
npx tsx scripts/deploy.ts

echo
echo "Done. deployments/sepolia.json written."
echo "Start the keeper with:  NETWORK=sepolia pnpm --filter @crewkill/keeper dev"
