# Changelog

All notable changes to this project are documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.3] - 2026-08-19

### Fixed

- Restored balanced specialist participation under global Agent instructions: non-trivial work now delegates at least one separable task, truly small changes stay local, and the Primary avoids duplicating work while a child is running.
- Prevented duplicate orchestrator preset choices across historical installations by adopting exact official pre-marker bundles and hiding legacy entries by their stable ID and official display name instead of a version-specific description.

## [0.6.2] - 2026-08-19

### Fixed

- Hid the legacy `orchestrator` compatibility preset from Web selection lists while keeping it available to resume existing sessions.

## [0.6.1] - 2026-08-19

### Fixed

- Provisioned a non-destructive legacy `orchestrator` preset alias so sessions created with the historical ID can resume after installing or updating the plugin. Existing user-managed `orchestrator` presets are preserved.

## [0.6.0] - 2026-08-19

### Added

- Reduced normal installation to one `dsh plugin --profile web add` command; the Host provisions the Agent preset automatically on startup.
- Added a managed preset marker with SHA-256 hashes for safe, idempotent adoption and upgrades.

### Changed

- Preserved manually edited preset files by refusing automatic overwrite when their content differs from the managed hashes.
- Kept `dsh-orchestrator-install --force` as an explicit repair path for users who choose to discard conflicting local edits.
- Simplified delegation guidance around useful delegation, dependency-aware parallel work, continuable child reuse, and risk-proportionate verification.

### Fixed

- Applied each specialist's configured reasoning effort from the actual child request context, after the continuable child identity is available.
- Recognized the unmodified pre-marker `v0.5.0` preset so its prompt can migrate automatically without overwriting user edits.

## [0.5.0] - 2026-08-19

### Added

- Added release management documentation and GitHub Actions automation.
- Added expanded client and host route tests.
- Added a rebuilt client bundle.

### Changed

- Aligned integration with DSH 0.1.0-rc.7.
- Added strict typecheck coverage.
- Enforced a shared 32-Agent cap and warning when more than 8 Agents are configured.
- Excluded stable Client draft keys from request payloads.
- Added localized save and validation feedback.

### Fixed

- Added unavailable-model validation.
- Protected against aborted or stale requests.
- Protected dirty pages from unsafe navigation or replacement.

[Unreleased]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.6.3...HEAD
[0.6.3]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/releases/tag/v0.5.0
