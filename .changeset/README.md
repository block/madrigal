# Changesets

This folder is managed by `@changesets/cli`. Use it to record release notes,
version `@anarchitecture/madrigal`, and prepare an explicit release.

Common workflow:

```bash
pnpm changeset
pnpm version-packages
pnpm release
```

Merges to `main` create version PRs only. Publish the release tarball by pushing
an `anarchitecture-madrigal@<version>` tag or by running the GitHub Actions
tarball workflow manually with the version from `package.json`.
