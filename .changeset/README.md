# Changesets

This folder is managed by `@changesets/cli`. Use it to record release notes,
version `@anarchitecture/madrigal`, and publish the package to npm.

For release-bearing PRs, add a changeset and let the generated
`chore: version packages` PR update `package.json` and `CHANGELOG.md`. Do not
manually bump versions for normal releases.

Common workflow for local testing:

```bash
pnpm changeset
pnpm version-packages
pnpm release
```
