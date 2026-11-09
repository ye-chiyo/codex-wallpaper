# Issue tracker: Local Markdown

本项目的规格和任务以 Markdown 文件保存在 `.scratch/` 下。

## 文件约定

- 每项功能使用独立目录：`.scratch/<feature-slug>/`。
- 规格文档为 `.scratch/<feature-slug>/spec.md`。
- 实施任务逐张保存为
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，
  从 `01` 开始编号，不合并为一个总任务文件。
- 普通任务的 triage 状态使用文件顶部附近的 `Status:` 行记录；
  状态名称和含义见 `triage-labels.md`。
- 评论和讨论记录追加到文件底部的 `## Comments` 标题下。

## 当技能要求“发布到 issue tracker”

在 `.scratch/<feature-slug>/` 下按上述约定创建文件，
必要时创建目录。

## 当技能要求“获取相关任务”

读取用户引用的任务文件。用户可以提供文件路径，
或提供所属功能与任务编号。

只有编号而无法确定所属功能时，先根据当前任务上下文查找；
仍存在歧义时再确认，不任意选择。

## Wayfinding operations

供 `wayfinder` 工作流使用。地图与每个子任务分别存储。

- 地图：`.scratch/<effort>/map.md`，
  包含 Notes、Decisions-so-far 和 Fog。
- 子任务：`.scratch/<effort>/issues/NN-<slug>.md`，
  从 `01` 编号，在正文记录要解决的问题。
- 类型：使用 `Type:` 行记录
  `research`、`prototype`、`grilling` 或 `task`。
- 工作状态：使用 `Status:` 行记录
  `open`、`claimed` 或 `resolved`。
  这是 wayfinding 的工作状态，与普通任务的 triage 状态分开使用。
- 依赖：使用 `Blocked by: NN, NN` 行记录。
  所有被依赖任务均为 `resolved` 时，当前任务才解除阻塞。
- Frontier：扫描该 effort 的 `issues/`，
  选择状态为 `open`、无阻塞且未被领取的任务，按编号优先。
- Claim：开始工作前，将状态改为 `claimed` 并保存。
- Resolve：将答案追加到 `## Answer` 下，
  把状态改为 `resolved`，
  再将结论摘要和文件链接追加到地图的 Decisions-so-far。
