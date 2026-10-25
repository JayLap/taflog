# Releasing taflog

Releases are published from CI by
[`.github/workflows/release.yml`](../.github/workflows/release.yml).

## Cut a release

1. Bump `version` in `package.json`.
2. Commit the bump and push it to `main`.
3. Push a matching tag:

   ```console
   $ git tag v0.1.0
   $ git push origin v0.1.0
   ```

The workflow checks that the tag matches `package.json`, runs `npm test`, and
publishes `@jlap/taflog` with a signed provenance statement. `npm test` is also
gated locally by `prepublishOnly`, so a broken build cannot publish.

## Authentication

Add an `NPM_TOKEN` repository secret: a granular token with read/write access
to the `@jlap` scope. Once the package exists you can switch to
[npm trusted publishing](https://docs.npmjs.com/generating-provenance-statements)
and drop the token.

## Try it locally

`npm publish --dry-run` reproduces the release packaging and upload steps
without uploading. The test suite's pack smoke test already runs
`npm pack` → `npm install -g` into a temp prefix.
