## 实现原则

- 按当前任务的验收标准做最小实现，优先复用已有逻辑。只有明确需求或实测问题需要时，才增加抽象、校验、重试或兜底分支。
- 保留已约定的保护：核验 Codex 版本和主界面目标，避免重复加载，确保停用可清理。不匹配时保持原界面。

## Agent skills

### Issue tracker

本项目使用本地 Markdown 跟踪规格和任务，文件位于 `.scratch/<feature>/`。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认五种 triage 标签，并在本地任务文件中记录状态。详见 `docs/agents/triage-labels.md`。

### Domain docs

采用 single-context：根目录 `GLOSSARY.md` 与 `docs/adr/`。探索和修改项目时遵循 `docs/agents/domain.md`。
