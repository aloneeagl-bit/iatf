# Project Rules & Guidelines

## 1. Strictly Prohibit Mock / Dummy / Fake Sample Data
- **No Mock or Initial Placeholder Data**: Do NOT initialize components with hardcoded sample records, fake checklist items, fake documents, or artificial dummy data.
- **Clean Initial States**: Initial component states must start empty (`[]`, `{}`, `""`) or load from actual local storage (`localStorage`) / real backend database records (`QmsDatabase`).
- **User-Authored & Real Data Only**: All records displayed in the UI must be created by the user or dynamically loaded from real QMS Database entries.
- **Future Changes**: Any future additions, components, or updates in this project must strictly comply with this rule. Do not add mock/sample data generators or pre-populated fake items.

## 2. Deletion Action User Confirmation Mandate
- Every delete or remove operation in the application MUST ask for user confirmation (`window.confirm` or custom modal confirmation prompt) before performing any deletion.
- Silent or unconfirmed deletion of user data, columns, references, or records is strictly prohibited across all modules.

## 3. Database-Driven Architecture & Principles Mandate
- **Real Database Integration**: All dynamic options, document selections, station mappings, and QMS checklist items MUST strictly originate from real user-authored records in `QmsDatabase` or `localStorage`.
- **Strict Station & Record Alignment**: AI smart generation algorithms and data extraction workflows MUST parse and bind strictly to valid linked records in `QmsDatabase` matching active workstation blocks, without defaulting or falling back to unverified station blocks or mock fallbacks.

