# 安装与第一次运行

PiS 是桌面窗口，不是完整的 agent。你必须先安装 pi，并完成一次登录。

## 准备条件

- 一台 macOS、Windows 10/11 或常见 Linux 桌面电脑。
- 已安装 **pi >= 1.6 < 2**。
- 已为至少一个提供商完成登录。

检查 pi：

```sh
pi --version
```

版本低于 1.6 或高于 1.x 时，PiS 会显示警告，并拒绝启动会话。请在终端升级 pi，再回到 PiS 检查。

检查登录：

```sh
pi auth login
```

`pi auth login` 是 pi 自己的登录命令。PiS 不会保存凭据。你可以在终端完成登录，也可以在 PiS 里完成登录。参考[模型与登录](/guide/models)。

## 下载安装包

打开 [GitHub Releases](https://github.com/ModyQyW/pis/releases)，按系统下载对应文件：

| 系统 | 文件 |
|---|---|
| macOS | `.dmg` |
| Windows | `pis-setup-<版本>-<架构>.exe` |
| Linux | `.tar.gz`、`.deb` 或 `.rpm` |

架构分为 `arm64` 和 `amd64`。Apple Silicon Mac 使用 `arm64`，Intel Mac 使用 `amd64`。

## 在 macOS 上安装

1. 打开 `.dmg`。
2. 把 `PiS.app` 拖到「应用程序」文件夹。
3. 打开 `PiS.app`。

当前 macOS 构建使用 ad-hoc 签名，没有做 notarization。第一次打开时，Gatekeeper 可能拦截。

如果出现「无法打开，因为 Apple 无法检查」：

1. 打开「系统设置」。
2. 进入「隐私与安全性」。
3. 在页面底部找到 PiS，点击「仍要打开」。
4. 再次打开 PiS，确认允许。

也可以在终端移除隔离标记：

```sh
xattr -dr com.apple.quarantine "/Applications/PiS.app"
```

只对来自本仓库 Release 的文件这样做。不得对来源不明的应用移除隔离标记。

## 在 Windows 上安装

1. 运行安装器。
2. 如果 SmartScreen 显示「未知发布者」，点击「更多信息」。
3. 点击「仍要运行」。
4. 完成安装并启动 PiS。

当前 Windows 安装器没有代码签名。安装前确认文件来自本仓库 Release。

## 在 Linux 上安装

使用包管理器安装 `.deb` 或 `.rpm`，或者解压 `.tar.gz`。

`.tar.gz` 中包含 `install.sh`。运行它，可以把 PiS 安装到桌面菜单，并添加 `pis` 命令：

```sh
chmod +x install.sh
./install.sh
```

也可以直接运行解压后的程序：

```sh
chmod +x pis
./pis
```

## 第一次启动

PiS 打开后，先显示空状态页面。

![PiS 空状态页面](/images/empty.png)

空状态页面显示当前项目和最近会话。你需要先打开一个项目。

### 1. 打开项目

点击侧边栏的「打开项目文件夹」，或按 `⌘O`（Windows/Linux 为 `Ctrl+O`）。

选择项目根目录，例如代码仓库的根目录。PiS 会把项目加入最近列表。

### 2. 处理项目信任

如果项目包含 pi 的项目级资源，PiS 会显示信任对话框。

![项目信任对话框](/images/trust.png)

对话框列出检测到的资源，例如：

- `.pi/settings.json`
- `.pi/extensions`
- `.pi/skills`
- `.agents/skills`

选择「信任项目」后，pi 会加载这些资源。选择「不信任」后，pi 会跳过它们。决定保存在 PiS 的设置中，不会写入 pi 的信任文件。

只信任你确认过的项目。扩展可以运行代码，并拥有与 pi 相同的系统权限。

### 3. 检查 pi 路径

打开设置，找到「pi 可执行文件」。

![设置中的 pi 路径](/images/zh-settings.png)

PiS 会自动查找 pi。查找顺序是：

1. 设置里的路径。
2. `PATH`。
3. 常见安装位置，例如 `~/.bun/bin/pi`、Homebrew、npm、pnpm 和 Volta 的目录。
4. 登录 shell 的 `PATH`。

如果找不到 pi，或者版本不兼容，设置页会显示原因。

你也可以填写 pi 的绝对路径，再点击「使用此路径」。填写后，这个路径成为唯一来源。路径不能运行时，PiS 不会悄悄换用其他安装。

### 4. 登录提供商

如果还没有可用模型，聊天区域会显示提示。

![登录提供商](/images/login.png)

点击「连接提供商」，或打开设置里的「登录提供商」。PiS 会运行：

```sh
pi auth login <provider>
```

登录在应用内的终端中完成。你可以选择账户登录，也可以选择 API key。

凭据由 pi 保存。PiS 不记录终端输出，也不把凭据写进诊断报告。

### 5. 发送第一条消息

在输入框里描述目标，按 Enter 发送。

适合第一条消息的内容：

- 「解释这个项目的入口和数据流。」
- 「找出一个真实的 bug，说明原因并修复。」
- 「检查当前未提交的更改。」

pi 会自己选择工具。工具调用会显示成卡片，回答会流式出现。

## 第一次检查

完成以下检查，确认安装可用：

1. 侧边栏显示项目和会话。
2. 发送一条短消息，流式回答出现。
3. 工具卡片可以展开，并显示输出。
4. 设置页显示兼容的 pi 版本。
5. 切换一次浅色和深色主题。
6. 关闭一个运行中的会话，退出保护提示出现。

## 下一步

- [窗口与界面](/guide/interface)：认识窗口的各个区域。
- [项目](/guide/projects)：打开、切换和移除项目。
- [会话](/guide/sessions)：新建、恢复和整理会话。
- [模型与登录](/guide/models)：切换模型，管理提供商。
