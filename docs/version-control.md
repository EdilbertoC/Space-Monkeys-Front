# What to commit

## Required project files

Commit application source, tests, contracts, generated API types, public assets, and the configuration needed to reproduce the build:

- `src/`, including `src/shared/api/generated/schema.ts`.
- `tests/`, `scripts/`, and `contracts/openapi.yaml`.
- `public/`, including the world map, favicon, and `data-attribution.txt`.
- `package.json` and `package-lock.json` together.
- `index.html`, `vite.config.ts`, `tsconfig.json`, and `.oxfmtrc.json`.
- `.gitignore`, `.gitattributes`, and `public/.gitattributes`.
- `.env.example`, with public example values only. Its current API URL is `http://localhost:8000`.
- `README.md`, `LICENSE`, and the relevant documentation in `docs/`.

The generated schema belongs in Git because `api:check` compares it against the versioned contract. The lockfile belongs in Git because `npm ci` uses it for reproducible installation. Public assets are source inputs, not generated build output.

## Optional tooling

- Keep `.figma/` with the current setup: `vite.config.ts` imports its site configuration, and its scripts support Figma previews and publishing. Removing it requires migrating that configuration first.
- `.mise.toml` is an optional Node version helper and is used by the Figma environment.
- `AGENTS.md` and `CLAUDE.md` are optional development-agent instructions. They can be shared if their contents are public; they currently contain project guidance rather than credentials.

## Keep out of Git

- `node_modules/`, `dist/`, build caches, Python virtual environments, logs, and temporary files.
- Actual `.env` files, including `.env.local` and `.env.production`.
- Private keys, signing certificates, cloud credentials, package registry tokens, and service-account credentials.
- Raw satellite downloads, sensitive operational records, personal data, or third-party material without permission to redistribute it.

The ignore rules cover the common credential filenames and locations listed above. Filename rules cannot detect secrets stored in arbitrary source files. Browser environment values prefixed with `VITE_` are public in the built application and must never contain private credentials.

## Attribution and scientific transparency

Retain `LICENSE`, the map attribution, and the notices that distinguish synthetic demonstration data from NASA observations. Preserve authorship and provenance information supplied with third-party material. Do not present demonstration alerts as verified incidents or imply NASA endorsement. Before adding new datasets or artwork, confirm that the team has permission to publish them and retain their applicable notices; the project license does not automatically cover every third-party asset.

## Review before committing or pushing

```powershell
git status --short
git diff --check
git diff
git diff --cached --stat
git diff --cached
```

Inspect the staged diff after adding files. `.gitignore` does not remove files that were already committed. If a real credential is exposed, revoke or rotate it; removing the latest copy does not remove it from history.

The repository review examined 125 candidate files, including 124 text files, using common private-key, access-token, credential-assignment, email, and local-path patterns. No recognizable credential was found. The only filename flagged was the safe `.env.example`; a path-pattern match in the documentation referred to keyboard navigation, not a personal filesystem path. This was a local pattern review, not a dedicated secret scanner, dependency vulnerability audit, complete history scan, or guarantee that no secret exists.
