# 技能

技能是 pi 的资源。一个技能是一个文件夹，包含 `SKILL.md` 和可选的脚本、参考资料和素材。pi 在系统提示中列出技能名称和描述，任务匹配时再加载完整说明。

PiS 不实现第二套技能加载器。它读取 pi 的配置并显示技能；加载和使用由 pi 完成。

## pi 查找技能的位置

常用位置：

```text
<pi agent 目录>/skills/       用户级，通常是 ~/.pi/agent/skills
~/.agents/skills/             Agent Skills 用户目录
<项目>/.pi/skills/            项目级
<项目>/.agents/skills/        Agent Skills 项目目录
```

pi 还会读取仓库根目录之前的上级 `.agents/skills`、`settings.json` 中 `skills` 列表的路径，以及已安装包中的技能。

项目级技能只在信任项目后加载。信任前，从信任对话框或文件管理器检查项目的 `.pi/skills` 和 `.agents/skills` 文件夹；技能可以要求模型运行程序。信任前，「pi 配置」对话框只列出项目配置的路径，不读取内容。

## 查看和添加技能

打开「设置 → pi 配置」。

技能列表显示每个技能的名称、描述、路径和来源：

- `user`：pi 的用户技能文件夹。
- `agents`：全局 `~/.agents/skills` 目录。
- `project`：信任后加载的项目或上级文件夹。
- `configured`：`settings.json` 中配置的路径。

添加技能时，输入技能文件或文件夹路径，点击「添加技能路径」。配置的文件可以是 `SKILL.md`，也可以是独立的 Markdown 技能。PiS 把路径写入 pi 用户 `settings.json` 的 `skills` 列表。相对路径从 pi 的 agent 目录解析。

移除自己配置的路径时，点击移除按钮。自动发现的技能没有移除按钮。要停止加载，删除或移动其文件夹。

## 使用技能

由 pi 决定何时加载技能。强制使用时输入：

```text
/skill:<名称> <可选请求>
```

例如：

```text
/skill:repo-docs 更新 README
```

PiS 把文本发送给 pi。pi 报告技能命令后，它会出现在输入框的命令菜单中。

## 重新加载

技能在会话启动时加载。添加、移除或修改技能后：

1. 关闭会话。
2. 重新打开会话。

在 pi 中运行 `/reload` 也可以在活动会话中重新加载技能。

## 下一步

- [扩展](/guide/extensions)：添加工具和命令。
- [模型与登录](/guide/models)：选择模型。
- [设置](/guide/settings)：查看 pi 配置。
