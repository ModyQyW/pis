# 安装与第一次运行

PiS 是一个**外壳**：它要求你已经有一个可用的 pi。PiS 本身不包含模型、凭据或 pi 运行时。

## 系统要求

- macOS 12 或更新版本；Windows 10/11；常见 x86_64 或 arm64 Linux 桌面。
- 已安装并登录 **pi >= 1.6 < 2**。
- 从源码构建时需要 Go 1.27.3+ 和 Bun 1.4.5。

验证 pi：

```sh
pi --version
pi auth login
```

## 安装

从 [GitHub Releases](https://github.com/ModyQyW/pis/releases) 下载对应架构的产物：

- macOS：`.dmg`
- Windows：`pis-setup-<version>-<arch>.exe`
- Linux：`.tar.gz`、`.deb` 或 `.rpm`

### macOS

把 `PiS.app` 拖进 `/Applications` 后打开。

当前发布使用 **ad-hoc 签名，不做 notarization**。第一次打开如果被 Gatekeeper 拦截：

1. 打开“系统设置 → 隐私与安全性”。
2. 在“仍要打开”处允许 PiS。
3. 或者对已安装的应用执行：

```sh
xattr -dr com.apple.quarantine "/Applications/PiS.app"
```

### Windows

运行安装器。当前安装包未做代码签名，SmartScreen 可能显示“未知发布者”；选择“更多信息 → 仍要运行”。确认来源是你信任的 Release 后再继续。

### Linux

`install.sh` 会安装桌面入口和 `pis` 命令；也可以直接使用包管理器安装 deb/rpm。首次运行：

```sh
chmod +x pis
./pis
```

## 第一次启动

1. 选择或打开一个项目目录。
2. 如果项目包含 `.pi/extensions`、`.pi/skills` 等可执行资源，PiS 会先询问是否信任。**信任前不要加载陌生项目。**
3. 在设置中确认 pi 路径。PiS 会依次检查设置、`PIS_PI`、`PATH`、常见安装位置和登录 shell。
4. 如果还没有登录 provider，打开“Connect a provider”，在应用内的终端完成 `pi auth login`。
5. 在输入框描述目标，按 Enter 发送。

## 第一次验证清单

- 侧边栏能看到项目和会话。
- 发送一条短消息，回答和工具卡片能流式出现。
- 打开设置，确认 pi 版本在支持范围内。
- 切换一次浅色/深色主题。
- 退出应用，确认运行中的会话会触发保护提示。

## 数据在哪里

macOS 的应用数据目录：

```text
~/Library/Application Support/PiS
```

设置、窗口状态和内置 bridge 扩展写在这里。pi 自己的凭据、session、模型和扩展仍在 pi 的目录中，PiS 不会替换它们。

下一步：[日常使用](/guide/daily-use)。
