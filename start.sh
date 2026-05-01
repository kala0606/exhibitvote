#!/bin/bash
# Start both servers concurrently
cd "$(dirname "$0")"

echo "Starting ExhibitVote..."
(cd backend && npm run dev) &
(cd frontend && npm run dev) &

wait
