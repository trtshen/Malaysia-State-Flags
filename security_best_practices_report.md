# Security Review: GitHub Pages Catalogue and CI/CD

Review date: 2026-07-20

## Executive summary

**Approval recommendation: approve after these changes are merged through the protected pull-request path and the required `validate` check passes.** No confirmed critical or high-severity exploit was found in the static website, no repository secret was detected, and the project has no npm dependencies or install scripts.

The previously identified deployment-boundary, mutable-build-tool, CSP, URL-scheme, checkout-token, and repository-governance findings have been remediated. The repository remains public, which does not conflict with the controls: `main` is protected, production deployment is limited to protected branches, and no second reviewer is required for the solo-maintainer workflow.

One accepted medium residual risk remains. GitHub's official Pages actions contain bundled transitive packages reported by `npm audit`. The actions are GitHub-owned, pinned to full commit SHAs, constrained by least-privilege jobs and a protected environment, and the reviewed vulnerable code paths were not shown to be reachable from this workflow's inputs. Dependabot for GitHub Actions is configured to surface upstream updates.

## Scope and verification

- Reviewed `site/app.js`, `scripts/site.mjs`, `scripts/lib.mjs`, the generated `output/site/` artifact, and both GitHub Actions workflows.
- Searched for DOM injection sinks, dynamic execution, unsafe navigation, remote scripts, storage, messaging, secrets, and executable or symlinked artifact content.
- Ran `npm test`: 17 source SVGs, 170 PNGs, 17 WebP stickers, metadata, documentation, links, and site generation passed.
- Tested search, classification filtering, preview/size changes, clipboard copy, and the Content Security Policy in a real browser; no browser policy errors were logged.
- Confirmed the project dependency tree is empty and has no install lifecycle scripts.
- Resolved workflow action SHAs against official GitHub-owned releases and audited their exact lockfiles.
- Verified live branch protection, Pages/environment configuration, Actions restrictions, SHA enforcement, secret scanning, push protection, and Dependabot security updates.

## Remediated findings

### CI-001: Production deployment boundary — resolved

- Severity before remediation: High
- Code controls: the deploy job has `if: github.ref == 'refs/heads/main'`, production permissions remain isolated to that job, and only the same-run build artifact is deployed.
- Repository controls: `main` requires a pull request, strict success from the `validate` check, linear history, and resolved conversations. Enforcement includes the administrator; force-pushes and deletion are disabled. Required approvals are zero to support a solo maintainer.
- Environment controls: `github-pages` accepts only protected branches. Pages uses the GitHub Actions source and HTTPS is enforced.

### SC-002: Mutable Homebrew dependency in production build — resolved

- Severity before remediation: Medium
- The Pages workflow no longer installs ImageMagick or any other package.
- Source checksum and SVG active-content validation were moved into a shared dependency-free function used directly by `npm run site`.
- ImageMagick's deeper raster checks remain in the required validation workflow and do not participate in creation of the production artifact.

### WEB-001: Missing Content Security Policy — resolved

- Severity before remediation: Low
- The generated page declares an early policy: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`.
- Browser testing confirmed that catalogue controls and clipboard behavior continue to work under the policy.

### WEB-002: Manifest URL schemes not fully allowlisted — resolved

- Severity before remediation: Low
- Site generation now parses every manifest-sourced external link and rejects non-HTTPS URLs, invalid URLs, and URLs containing embedded credentials.
- Link labels and URL values continue to be HTML-escaped.

### CI-002: Persisted checkout credentials — resolved

- Severity before remediation: Low
- Both workflows set `persist-credentials: false`; neither build needs authenticated Git operations after checkout.

### CI-003: Preventative repository controls — resolved

- Severity before remediation: Low
- Secret scanning, secret-scanning push protection, and Dependabot security updates are enabled.
- Actions are restricted to GitHub-owned actions and immutable SHA pinning is enforced at repository level.
- `.github/dependabot.yml` monitors the `github-actions` ecosystem weekly.

## Accepted residual risk

### SC-001: Vulnerable transitive code bundled in official Pages actions

- Severity: Medium
- Current controls: `actions/checkout`, `actions/upload-pages-artifact`, and `actions/deploy-pages` are GitHub-owned and pinned to full SHAs; obsolete `actions/configure-pages` was removed; upload/deploy were upgraded to their Node.js 24 major releases.
- Evidence: auditing the exact official action lockfiles still reports high-severity dependencies in checkout and critical/high dependencies in deploy-pages, including advisories affecting `form-data`, `unzip-stream`, `lodash`, and HTTP client packages.
- Reachability assessment: package presence is not proof of exploitability. The normal deploy path lists artifact metadata and creates a Pages deployment; it does not extract attacker-provided archives or construct attacker-controlled multipart field names. The reviewed critical `form-data` preconditions are absent from this workflow.
- Treatment: accept temporarily, monitor Dependabot/upstream releases, and update pinned SHAs promptly when GitHub publishes patched action bundles.

Risk:
Official GitHub action bundles execute transitive code inside CI, and deploy-pages receives production-scoped credentials.

Reason:
GitHub currently provides the supported Pages deployment flow through these actions, and the advisories were not confirmed reachable in this constrained invocation.

Safer alternative:
There is no equally supported dependency-free Pages deployment mechanism. Keep the protected environment, least-privilege job split, immutable SHAs, GitHub-owned-only policy, and automated action update monitoring.

## Controls that passed

- No `innerHTML`, `outerHTML`, `document.write`, `eval`, dynamic script creation, remote script/style loading, browser storage, or cross-window messaging.
- Browser search input reaches only string comparison, `hidden`, and `textContent`; it never reaches an HTML parser or navigation sink.
- SVG validation rejects scripts, event handlers, external references, embedded rasters, doctypes, entities, `foreignObject`, remote CSS resources, and checksum drift.
- The project has zero npm runtime/development dependencies and no install lifecycle scripts.
- The Pages artifact contains only the intended static files, with no symlinks or executable files.
- Workflow production permissions are limited to `pages: write` and `id-token: write` in the deployment job.
- No `pull_request_target`, untrusted pull-request deployment, shell expression interpolation, or repository secrets are used.

## Deployment gate

The security controls are sufficient for this public, static, unauthenticated catalogue. The remaining gate is procedural: merge these files through a pull request, require the `validate` check to pass, and let the protected `main` push trigger the first Pages deployment.
