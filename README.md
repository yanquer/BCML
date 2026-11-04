# BCML

BCML 是《塞尔达传说：旷野之息》的模组合并与管理工具，支持 Wii U 和 Switch 游戏数据。本仓库基于上游 3.10.8，使用 uv 管理 Python 环境，并增加固定 Rust 工具链和 macOS 源码安装支持。

上游已停止维护，并提示原有合并逻辑和模组兼容性存在风险。使用前请阅读[上游说明](docs/README.md#notice-bcml-has-been-discontinued)；这些上游限制仍需考虑。

- [快速开始](#快速开始)
- [平台与验证范围](#平台与验证范围)
- [开发与构建](#开发与构建)
- [变更记录](CHANGELOG.md)
- [模组安装](docs/install.md) · [导出到主机](docs/export.md) · [故障排查](docs/trouble.md)

## 快速开始

以下命令针对当前 `yq-dev` 分支；从 PyPI 安装上游 `bcml` 不会获得本分支的改动。

```sh
git clone --branch yq-dev https://github.com/yanquer/BCML.git
cd BCML
```

运行前需要准备合法、已解包的游戏数据：Wii U 版 1.5.0 或 Switch 版 1.6.0。Cemu 为可选项，也可以在设置中选择不使用 Cemu，再手动导出合并结果。

### macOS

安装 Xcode 命令行工具；如果已经安装，可以跳过第一条命令。下列包管理命令需要先安装 [Homebrew](https://brew.sh/)。

```sh
xcode-select --install
brew install uv rustup node sevenzip
```

在仓库根目录初始化并启动：

```sh
./bootstrap.sh
uv run --locked bcml
```

初始化脚本会安装锁定的 Python 依赖、生成帮助文档和前端资源，并编译 Rust 扩展。构建入口会按仓库声明选择和安装 Rust 工具链，无需手动切换全局 nightly 或调整 Homebrew Rust 的 PATH。

配置原生 Cemu 时，先启动 Cemu 一次，再在 **Cemu Directory（Cemu 目录）** 中选择包含 `Cemu.app` 的文件夹，例如 `/Applications`；也可以直接输入应用包路径。

| 内容 | 默认位置 |
| --- | --- |
| BCML 设置与日志 | `~/Library/Application Support/bcml` |
| BCML 错误日志 | `~/Library/Application Support/bcml/bcml.log` |
| Cemu 设置与图形包 | `~/Library/Application Support/Cemu` |
| Cemu 便携数据 | `Cemu.app` 同级的 `portable` 目录（存在时优先使用） |

macOS 使用 Cocoa/WebKit 窗口和系统 `7zz` 或 `7z`，无需安装 Qt 或 .NET。当前源码安装方式不注册 `bcml://` 协议，请通过界面手动导入下载的 BNP、ZIP、7z 或 RAR 文件。更多说明见 [macOS 安装与配置](docs/README.md#macos-source-installation)。

### Windows / Linux

准备 [uv](https://docs.astral.sh/uv/getting-started/installation/)、[rustup](https://rustup.rs/)、Node.js 与 npm，以及对应平台的 C/C++ 构建工具。建议使用 Node.js 20+；Windows 还需要 [Visual C++ 运行库](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)。

以下命令在仓库根目录执行。先根据终端设置前端构建选项：

```sh
# Bash / zsh
export NODE_OPTIONS=--openssl-legacy-provider
```

```powershell
# PowerShell
$env:NODE_OPTIONS = "--openssl-legacy-provider"
```

然后安装依赖并生成资源：

```sh
uv sync --locked --no-install-project
npm --prefix bcml/assets ci
npm --prefix bcml/assets run build
uv run --frozen --no-sync mkdocs build -d bcml/assets/help
uv sync --locked
uv run --locked bcml
```

Linux 也可以使用 `./bootstrap.sh` 初始化。Linux 的 Qt 系统依赖与游戏目录要求见[原有安装说明](docs/README.md#setup)及[故障排查](docs/trouble.md#setup)。

## 平台与验证范围

| 平台 | 当前情况 |
| --- | --- |
| macOS Apple Silicon | 已在本机验证依赖安装、ARM64 wheel、Cocoa 设置页、目录选择取消、中文归档和原生导出；macOS 兼容提交的 29 项自动检查通过 |
| macOS Intel | 使用相同的平台分支，尚未本机实测 |
| Windows / Linux | 保留原有平台流程，仓库包含对应构建任务；本轮未进行真实系统运行验证 |

原生导出验证使用隔离测试数据；Cemu 启动命令包含模拟验证，实际 Cemu 和游戏启动尚未实测。CI 配置见[构建工作流](.github/workflows/build.yml)，运行结果以对应任务记录为准。

## 开发与构建

Python 默认版本由 [.python-version](.python-version) 指定为 3.9，uv 管理仓库内的 `.venv`，不需要手动激活虚拟环境。Rust 使用 [rust-toolchain.toml](rust-toolchain.toml) 中固定的 `nightly-2023-12-01`，依赖分别锁定在 [uv.lock](uv.lock) 和 [Cargo.lock](Cargo.lock)。

原有源码和 Rust 依赖仍使用不稳定特性；修改工具链时需要一起验证依赖兼容性。构建入口复用 Maturin，并显式选择固定版本的 `cargo` 和 `rustc`。Rust 源码变化会使 uv 的构建缓存失效。

```sh
# 调试启动
uv run --locked bcml-debug

# 便携模式：设置、日志和默认存储目录使用当前工作目录下的 bcml-data
uv run --locked bcml --portable

# 生成 wheel 或源码包，产物位于 dist/
uv build --wheel
uv build --sdist

# 已安装开发依赖后执行检查；macOS 运行检查在其他平台会跳过
uv run --locked python -m unittest discover -s tests -v
```

macOS 的 `oead` 来源固定到官方已合并的 [Apple Silicon 构建修复](https://github.com/zeldamods/oead/pull/41)，uv 同时管理其隔离构建工具和 SDK 设置。请使用本仓库的 uv 流程安装，以保留这些依赖来源设置。

更新源码并同步依赖：

```sh
git pull --rebase
uv sync --locked
```

前端源码变化后需要重新执行 `npm --prefix bcml/assets ci` 和 `npm --prefix bcml/assets run build`，并按上述终端说明设置 `NODE_OPTIONS`。macOS 源码安装通过这套流程更新，应用内的 PyPI 更新入口会提示使用 uv。

更完整的构建说明见 [docs/README.md](docs/README.md#building-from-source)。本分支的功能和兼容性变化记录在 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

本项目沿用上游的 GPLv3 或更新版本许可证，详见 [LICENSE](docs/LICENSE.md)。第三方组件说明见[上游许可证章节](docs/README.md#license)。
