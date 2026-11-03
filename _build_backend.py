"""为 Maturin 构建统一选择项目固定的 Rust 工具链，避免系统 PATH 命中其他编译器。"""

import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from typing import Any, List

import maturin

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib


def _rustup(rustup: str, arguments: List[str], timeout: int = 30) -> str:
    """执行 rustup 并保留失败原因，向构建日志记录阶段、耗时和退出状态。"""
    started = time.monotonic()
    operation = " ".join(arguments)
    print(f"[bcml build] rustup {operation}: start", file=sys.stderr, flush=True)
    try:
        result = subprocess.run(
            [rustup, *arguments],
            check=True,
            stdout=subprocess.PIPE,
            text=True,
            timeout=timeout,
        )
    except (subprocess.SubprocessError, OSError) as error:
        print(
            f"[bcml build] rustup {operation}: failed after "
            f"{time.monotonic() - started:.2f}s: {error!r}",
            file=sys.stderr,
            flush=True,
        )
        raise
    print(
        f"[bcml build] rustup {operation}: success in "
        f"{time.monotonic() - started:.2f}s",
        file=sys.stderr,
        flush=True,
    )
    return result.stdout.strip()


def _configure_rust() -> None:
    """按仓库声明安装缺少的工具链，并为构建子进程指定真实的 Cargo 和 rustc。"""
    root = Path(__file__).resolve().parent
    with (root / "rust-toolchain.toml").open("rb") as stream:
        channel = tomllib.load(stream)["toolchain"]["channel"]
    rustup = shutil.which("rustup")
    if rustup is None:
        raise RuntimeError("BCML builds require rustup: https://rustup.rs/")
    installed = _rustup(rustup, ["toolchain", "list"])
    if not any(line.startswith(channel + "-") for line in installed.splitlines()):
        _rustup(rustup, ["toolchain", "install", channel, "--profile", "minimal"], 300)
    cargo = _rustup(rustup, ["which", "--toolchain", channel, "cargo"])
    rustc = _rustup(rustup, ["which", "--toolchain", channel, "rustc"])
    if not Path(cargo).is_file() or not Path(rustc).is_file():
        raise RuntimeError(
            f"rustup returned invalid tool paths: cargo={cargo!r}, rustc={rustc!r}"
        )
    # 显式路径同时覆盖 Homebrew 编译器与调用方遗留的 CARGO/RUSTC 设置。
    os.environ["PATH"] = (
        str(Path(cargo).parent) + os.pathsep + os.environ.get("PATH", "")
    )
    os.environ["CARGO"] = cargo
    os.environ["RUSTC"] = rustc
    os.environ["RUSTUP_TOOLCHAIN"] = channel
    print(
        f"[bcml build] selected {channel}: cargo={cargo}, rustc={rustc}",
        file=sys.stderr,
        flush=True,
    )


def __getattr__(name: str) -> Any:
    """复用 Maturin 的 PEP 517/660 钩子，仅在原生构建与元数据阶段选择 Rust。"""
    hook = getattr(maturin, name)
    if not name.startswith(("build_", "prepare_metadata_")):
        return hook

    def build_hook(*args: Any, **kwargs: Any) -> Any:
        """准备固定工具链后执行对应 Maturin 钩子，原样传递结果与异常。"""
        _configure_rust()
        return hook(*args, **kwargs)

    return build_hook
