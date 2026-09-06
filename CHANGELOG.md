# Changelog

All notable changes to this project are documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.7.6] - 2026-09-06

### Changed

- Raised the DSH compatibility baseline to 0.1.2-rc.1, migrated model discovery to the typed Remote catalog, and moved legacy-preset filtering to the Host roster export.
- Applied each specialist's reasoning effort through the native subagent `agentOptions` contract and placed orchestration guidance at DSH's centralized `TEAM_POLICY` prompt order.
- Aligned the managed preset with the 0.1.2 standard preset's goal command and protected public WebFetch defaults.

## [0.7.5] - 2026-08-31

### Fixed

- Permitted agent descriptions to preserve multi-line prompt text: internal line breaks are now accepted in the configured description instead of being rejected as invalid newlines.
- Prevented the primary Agent from treating elapsed time, silence, unchanged child status, or another child completing as deadlock evidence, and explicitly prohibited interrupts used to solicit early reports or avoid waiting.
- Clarified that the three configured specialist tools are reusable across any number of meaningful child tasks, with runtime capacity and overlapping files, ownership, or dependencies governing concurrency.

## [0.7.4] - 2026-08-26

### Fixed

- Permitted agent descriptions to preserve multi-line prompt text: internal line breaks are now accepted in the configured description instead of being rejected as invalid newlines.

## [0.7.3] - 2026-08-23

### Fixed

- Added explicit reliability guidance for foreground child calls when dependencies leave no independent work, bounded status observation without polling or false stalls, narrowly justified interrupts, queued `send_message` follow-ups, and model-agnostic specialist recovery after repeated tool or execution-protocol errors.

## [0.7.2] - 2026-08-21

### Changed

- Raised the DSH compatibility baseline and peer dependencies to 0.1.1-rc.1 after verifying the subagent integration contract remains compatible.

## [0.7.1] - 2026-08-21

### Fixed

- Strengthened orchestration phase barriers so the Primary re-checks every child before each analysis, edit, and test step, waits for all formal returns, and allows a short observation window after partial child completion.

## [0.7.0] - 2026-08-20

### Changed

- Reframed orchestration around a product/engineering-manager Primary that defines acceptance criteria and delegates development before implementation, with exclusive child scope ownership, capacity-aware parallel dispatch, dependency waiting, and Primary-owned integration and final acceptance.
- Limited the configured specialist roster to 3 Agents, removed the obsolete warning for rosters above 8, and preserved oversized legacy rosters for non-destructive reduction after upgrade.

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

[Unreleased]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.7.6...HEAD
[0.7.6]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.7.5...v0.7.6
[0.7.5]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.6.3...v0.7.0
[0.6.3]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ToxicantX/dsh-multi-model-orchestrator/releases/tag/v0.5.0
