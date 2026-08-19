# Changelog

All notable changes to this project are documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/releases/tag/v0.5.0
