#!/bin/bash
set -e
# Use --no-frozen-lockfile so task-agent merges that update package.json
# without regenerating the lockfile don't block setup.
pnpm install --no-frozen-lockfile
pnpm --filter @workspace/db run push-force
