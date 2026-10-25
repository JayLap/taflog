# Releasing taflog

Releases use [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC) from GitHub Actions, with [staged
publishing](https://docs.npmjs.com/staged-publishing): CI stages the package
and a maintainer approves it with 2FA before it goes live. No long-lived npm
token is involved.

## One-time setup

On npm, under the package's **Settings → Trusted publishing**, add a GitHub
Actions publisher:

- **Organization or user:** `JayLap`
- **Repository:** `taflog`
- **Workflow filename:** `release.yml`
- **Allowed actions:** leave `npm publish` (and `npm dist-tag`) unchecked, so
  the publisher is **stage-only**. `npm stage publish` is always allowed.

Then, under **Settings → Publishing access**, choose *"Require two-factor
authentication and disallow tokens"* for the strongest posture. This does not
affect trusted publishers, which use OIDC.

No `NPM_TOKEN` repository secret is required.

## Cut a release

1. Bump `version` in `package.json`; commit and push to `main`.
2. Push a matching tag:

   ```console
   $ git tag v0.2.0
   $ git push origin v0.2.0
   ```

3. The workflow verifies the tag against `package.json`, runs `npm test`, and
   runs `npm stage publish`. Provenance is generated automatically.
4. Review and approve the staged package:

   ```console
   $ npm stage list
   $ npm stage view <stage-id>
   $ npm stage approve <stage-id>   # prompts for 2FA
   ```

   You can also approve on npmjs.com (package → Staged versions). Staging needs
   no 2FA; approval does.

## Notes

- Trusted publishing requires npm CLI `>= 11.5.1` and Node `>= 22.14.0`; the
  workflow uses Node 24.
- A newly created trusted publisher configuration expires if it does not
  complete its first successful publish within 2 days.
- `npm test` runs both in the workflow and via the `prepublishOnly` script,
  which `npm stage publish` also triggers.
- `npm publish --dry-run` reproduces the packaging step locally without staging
  anything. The test suite's pack smoke test runs `npm pack` →
  `npm install -g` into a temp prefix.
