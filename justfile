# Madrigal development tasks

set dotenv-load

# Install dependencies
setup:
    pnpm install

# Run all checks (lint + format + typecheck)
check:
    pnpm biome check .
    pnpm tsc --noEmit

# Format code
fmt:
    pnpm biome format --write .

# Check formatting without modifying
fmt-check:
    pnpm biome format .
    pnpm biome check .

# Run unit tests
test:
    pnpm vitest run

# Build the project
build:
    pnpm tsc -p tsconfig.build.json

# Full CI gate: check + test + build
ci: check test build

# Clean build artifacts
clean:
    rm -rf dist
