# Third-Party Notices

Music Cue Pad v0.4.0 contains no bundled third-party runtime library code.

Browser APIs and system fonts are used directly. The GitHub Actions workflows reference their respective GitHub-maintained actions under the terms published by those projects.

When a future version adds a package to `dependencies.json`:

1. Add its name, exact version, license, and homepage to this file.
2. Sync and commit the corresponding `dependencies.lock.json` entry.
3. Include every copyright notice and license text required for redistribution.
4. Update both README files when the dependency materially affects privacy, size, or capability.
5. Commit regenerated dependency metadata according to repository policy.

Do not assume that a package being available from npm makes it compatible with MIT redistribution.
