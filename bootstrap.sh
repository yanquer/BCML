#!/bin/bash
# 使用 uv 管理开发环境，并依次构建文档、前端资源和 Rust 扩展。
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v uv >/dev/null 2>&1; then
    echo "uv is required: https://docs.astral.sh/uv/getting-started/installation/" >&2
    exit 1
fi

if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
    echo "Node.js v14+ and npm are required to build BCML" >&2
    exit 1
fi
if [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 14 ]; then
    echo "Node.js v14+ is required to build BCML" >&2
    exit 1
fi

if ! command -v rustup >/dev/null 2>&1; then
    echo "rustup is required to install the project's pinned Rust toolchain: https://rustup.rs/" >&2
    exit 1
fi

echo "Installing locked Python dependencies with uv..."
# 先安装依赖，生成资源后再安装包含 Rust 扩展的项目。
uv sync --locked --no-install-project

echo "Building docs..."
uv run --frozen --no-sync mkdocs build -q -d bcml/assets/help

echo "Installing npm packages..."
export NODE_OPTIONS=--openssl-legacy-provider
pushd bcml/assets >/dev/null
npm install --loglevel=error
echo "Building webpack bundle..."
npm run build --loglevel=error
popd >/dev/null

echo "Compiling Rust extension module and installing BCML..."
uv sync --locked

echo "Done! You are now ready to work on BCML."
echo 'Run with `uv run --locked bcml` or build a wheel with `uv build --wheel`.'
