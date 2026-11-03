"""验证 uv 构建自动选择固定 Rust 工具链，以及安装失败时的错误与日志传递。"""

from contextlib import ExitStack, redirect_stderr
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import _build_backend as backend


class BuildBackendTests(unittest.TestCase):
    """通过受控子进程结果覆盖系统编译器抢占、首次安装和构建失败场景。"""

    def setUp(self) -> None:
        """隔离进程环境，并创建 rustup 返回的模拟工具路径。"""
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        root = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        self.cargo = root / "pinned" / "cargo"
        self.rustc = root / "pinned" / "rustc"
        self.cargo.parent.mkdir()
        self.cargo.touch()
        self.rustc.touch()
        with (Path(backend.__file__).parent / "rust-toolchain.toml").open(
            "rb"
        ) as stream:
            self.channel = backend.tomllib.load(stream)["toolchain"]["channel"]
        self.stack.enter_context(
            patch.dict(
                os.environ,
                {
                    "PATH": "/system/stable/bin",
                    "CARGO": "/system/stable/bin/cargo",
                    "RUSTC": "/system/stable/bin/rustc",
                    "RUSTUP_TOOLCHAIN": "stable",
                },
                clear=True,
            )
        )
        self.stack.enter_context(
            patch.object(backend.shutil, "which", return_value="rustup")
        )
        self.run = self.stack.enter_context(patch.object(backend.subprocess, "run"))
        self.logs = self.stack.enter_context(redirect_stderr(io.StringIO()))

    def installed_responses(self) -> list:
        """提供固定工具链已安装时各次 rustup 调用的有效结果。"""
        return [
            subprocess.CompletedProcess([], 0, f"{self.channel}-test-host\n"),
            subprocess.CompletedProcess([], 0, str(self.cargo)),
            subprocess.CompletedProcess([], 0, str(self.rustc)),
        ]

    def test_pinned_tools_override_system_compiler(self) -> None:
        """系统 PATH 与调用方变量指定 stable 时，实际构建仍选择固定工具链。"""
        self.run.side_effect = self.installed_responses()
        backend._configure_rust()
        self.assertEqual(
            os.environ["PATH"].split(os.pathsep)[0], str(self.cargo.parent)
        )
        self.assertEqual(os.environ["CARGO"], str(self.cargo))
        self.assertEqual(os.environ["RUSTC"], str(self.rustc))
        self.assertEqual(os.environ["RUSTUP_TOOLCHAIN"], self.channel)
        self.assertEqual(self.run.call_count, 3)
        self.assertIn(f"selected {self.channel}", self.logs.getvalue())
        self.assertIn(str(self.rustc), self.logs.getvalue())

    def test_missing_toolchain_installs_exact_pin(self) -> None:
        """仅有其他工具链时自动安装指定日期的 nightly，而非滚动 nightly。"""
        self.run.side_effect = [
            subprocess.CompletedProcess([], 0, "stable-test-host (default)\n"),
            subprocess.CompletedProcess([], 0, ""),
            *self.installed_responses()[1:],
        ]
        backend._configure_rust()
        install = self.run.call_args_list[1]
        self.assertEqual(
            install.args[0],
            [
                "rustup",
                "toolchain",
                "install",
                self.channel,
                "--profile",
                "minimal",
            ],
        )
        self.assertEqual(install.kwargs["timeout"], 300)
        self.assertTrue(install.kwargs["check"])

    def test_missing_rustup_fails_before_build(self) -> None:
        """缺少 rustup 时明确失败，不回退到系统 stable。"""
        with patch.object(backend.shutil, "which", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "require rustup"):
                backend._configure_rust()
        self.run.assert_not_called()

    def test_invalid_tool_paths_fail(self) -> None:
        """rustup 返回空路径或不存在的工具时拒绝继续构建。"""
        self.run.side_effect = [
            self.installed_responses()[0],
            subprocess.CompletedProcess([], 0, ""),
            subprocess.CompletedProcess([], 0, str(self.rustc)),
        ]
        with self.assertRaisesRegex(RuntimeError, "invalid tool paths"):
            backend._configure_rust()
        self.assertNotIn("selected", self.logs.getvalue())

    def test_install_failure_keeps_original_error_and_stops_hook(self) -> None:
        """安装失败保留原异常及退出码，禁止调用 Maturin 或输出选择成功日志。"""
        error = subprocess.CalledProcessError(17, ["rustup", "toolchain", "install"])
        self.run.side_effect = [subprocess.CompletedProcess([], 0, ""), error]
        with patch.object(backend.maturin, "build_wheel") as hook:
            with self.assertRaises(subprocess.CalledProcessError) as context:
                backend.build_wheel("out")
        self.assertIs(context.exception, error)
        hook.assert_not_called()
        self.assertIn("failed", self.logs.getvalue())
        self.assertIn("17", self.logs.getvalue())
        self.assertNotIn("selected", self.logs.getvalue())

    def test_timeout_remains_timeout(self) -> None:
        """超时保留超时异常与调用阶段，不转换为工具链未安装等推断。"""
        error = subprocess.TimeoutExpired(["rustup", "toolchain", "list"], 30)
        self.run.side_effect = error
        with self.assertRaises(subprocess.TimeoutExpired) as context:
            backend._configure_rust()
        self.assertIs(context.exception, error)
        self.assertIn("toolchain list: failed", self.logs.getvalue())
        self.assertIn("TimeoutExpired", self.logs.getvalue())

    def test_build_and_metadata_hooks_delegate_after_setup(self) -> None:
        """wheel、editable、sdist 与元数据构建均先选择工具链，再原样委托。"""
        for name in (
            "build_wheel",
            "build_editable",
            "build_sdist",
            "prepare_metadata_for_build_wheel",
            "prepare_metadata_for_build_editable",
        ):
            with self.subTest(hook=name):
                self.run.side_effect = self.installed_responses()
                with patch.object(
                    backend.maturin, name, return_value="artifact"
                ) as hook:
                    self.assertEqual(getattr(backend, name)("out"), "artifact")
                hook.assert_called_once_with("out")
                self.assertEqual(os.environ["RUSTC"], str(self.rustc))

    def test_requirement_hooks_do_not_install_rust(self) -> None:
        """仅查询 Python 构建依赖时不触发编译器安装。"""
        self.assertEqual(backend.get_requires_for_build_wheel(), [])
        self.assertEqual(backend.get_requires_for_build_editable(), [])
        self.assertEqual(backend.get_requires_for_build_sdist(), [])
        self.run.assert_not_called()

    def test_maturin_error_is_not_converted_to_success(self) -> None:
        """原生编译失败时原样传递 Maturin 错误，不返回虚假的产物。"""
        self.run.side_effect = self.installed_responses()
        error = RuntimeError("controlled native build failure")
        with patch.object(backend.maturin, "build_wheel", side_effect=error):
            with self.assertRaises(RuntimeError) as context:
                backend.build_wheel("out")
        self.assertIs(context.exception, error)
