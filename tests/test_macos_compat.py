"""使用隔离目录验证 macOS 原生依赖、Cemu 应用路径、归档工具和错误日志。"""

from contextlib import ExitStack
import importlib.metadata
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
from types import SimpleNamespace
from typing import Any
import unittest
from unittest.mock import Mock, patch


@unittest.skipUnless(sys.platform == "darwin", "macOS runtime integration")
class MacCompatibilityTests(unittest.TestCase):
    """在 macOS 上使用实际安装的扩展与归档工具，并隔离用户数据和 Cemu 进程。"""

    @classmethod
    def setUpClass(cls) -> None:
        """导入应用时将 Python 数据目录限制在临时便携目录中。"""
        cls.import_temp = tempfile.TemporaryDirectory(prefix="bcml-macos-tests-")
        cls.addClassCleanup(cls.import_temp.cleanup)
        with patch.object(sys, "argv", [sys.executable, "--portable"]), patch(
            "os.getcwd", return_value=cls.import_temp.name
        ):
            from bcml import _api, _oneclick, install, util

        cls.api_module = _api
        cls.oneclick = _oneclick
        cls.install = install
        cls.util = util
        cls.original_data_dir = staticmethod(util.get_data_dir)

    def setUp(self) -> None:
        """为每个用例提供应用包、主目录、设置和日志，禁止访问真实用户配置。"""
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        self.home = self.root / "home"
        self.home.mkdir()
        self.data = self.root / "bcml-data"
        self.data.mkdir()
        self.log = self.data / "bcml.log"
        self.settings = dict(self.util.DEFAULT_SETTINGS, store_dir=str(self.data))
        self.stack.enter_context(patch.object(Path, "home", return_value=self.home))
        self.stack.enter_context(
            patch.object(self.util, "system", return_value="Darwin")
        )
        self.stack.enter_context(
            patch.object(self.util, "get_data_dir", return_value=self.data)
        )
        self.stack.enter_context(
            patch.object(self.util, "get_settings", side_effect=self.setting)
        )
        self.stack.enter_context(patch.object(self.util, "LOG", self.log))
        self.stack.enter_context(patch.object(self.api_module, "LOG", self.log))
        self.stack.enter_context(patch.object(self.api_module, "SYSTEM", "Darwin"))
        self.api = self.api_module.Api("http://127.0.0.1")
        self.app = self.root / "Applications" / "Cemu.app"
        executable_dir = self.app / "Contents" / "MacOS"
        executable_dir.mkdir(parents=True)
        self.executable = executable_dir / "Cemu"
        self.executable.write_text("#!/bin/sh\nexit 0\n")
        self.executable.chmod(0o755)
        with (self.app / "Contents" / "Info.plist").open("wb") as stream:
            plistlib.dump({"CFBundleExecutable": "Cemu"}, stream)
        self.cemu_data = self.home / "Library" / "Application Support" / "Cemu"
        self.cemu_data.mkdir(parents=True)
        self.settings["cemu_dir"] = str(self.app)
        self.util.get_7z_path.cache_clear()
        self.addCleanup(self.util.get_7z_path.cache_clear)

    def setting(self, name: str = "") -> Any:
        """按现有设置接口返回隔离用例的数据。"""
        return self.settings.get(name, False) if name else self.settings

    def test_official_apple_silicon_dependency_is_installed(self) -> None:
        """确认运行环境实际安装的是锁定的官方 ARM 修复提交。"""
        import oead
        import webview.platforms.cocoa

        self.assertIn("g9dfb8c6", importlib.metadata.version("oead"))
        self.assertTrue(callable(oead.yaz0.compress))

    def test_standard_data_directory_matches_rust_convention(self) -> None:
        """非便携模式使用与 dirs2::config_dir 相同的 Application Support 目录。"""
        self.original_data_dir.cache_clear()
        self.addCleanup(self.original_data_dir.cache_clear)
        with patch.object(self.util, "get_is_portable_mode", return_value=False):
            self.assertEqual(
                self.original_data_dir(),
                self.home / "Library" / "Application Support" / "bcml",
            )

    def test_cemu_bundle_and_containing_folder(self) -> None:
        """应用包本身和文件选择器可选的外层目录均能定位原生 Cemu。"""
        self.assertEqual(self.util.get_cemu_executable(self.app), self.executable)
        self.assertEqual(
            self.util.get_cemu_executable(self.app.parent), self.executable
        )
        self.assertEqual(self.util.get_cemu_dir(), self.cemu_data)
        self.assertTrue(
            self.api.dir_exists({"folder": str(self.app.parent), "type": "cemu_dir"})
        )

    def test_portable_cemu_uses_sibling_data_directory(self) -> None:
        """Cemu.app 同级的 portable 目录优先于系统用户数据目录。"""
        portable = self.app.parent / "portable"
        portable.mkdir()
        self.assertEqual(self.util.get_cemu_data_dir(self.app), portable)
        self.assertEqual(self.util.get_cemu_dir(), portable)

    def test_missing_bundle_is_invalid_but_permission_error_is_not_hidden(self) -> None:
        """缺少应用返回无效目录，缺少执行权限保留为权限错误。"""
        self.assertFalse(
            self.api.dir_exists({"folder": str(self.root), "type": "cemu_dir"})
        )
        self.executable.chmod(0o644)
        with self.assertRaises(PermissionError):
            self.api.dir_exists({"folder": str(self.app), "type": "cemu_dir"})

    def test_invalid_bundle_metadata_is_not_an_empty_result(self) -> None:
        """无效应用清单显式报错，避免当成有效但没有内容的应用。"""
        with (self.app / "Contents" / "Info.plist").open("wb") as stream:
            plistlib.dump({"CFBundleExecutable": "../Cemu"}, stream)
        with self.assertRaises(ValueError):
            self.util.get_cemu_executable(self.app)

    def test_cancelled_folder_dialog_returns_none(self) -> None:
        """Cocoa 文件夹选择取消时返回空选择，不触发下标异常。"""
        self.api.window = SimpleNamespace(create_file_dialog=Mock(return_value=()))
        self.assertIsNone(self.api.get_folder())

    def test_cemu_settings_use_native_data_directory(self) -> None:
        """应用位置与 settings.xml 分离时仍从原生用户目录解析设置。"""
        (self.cemu_data / "settings.xml").write_text(
            "<content><mlc_path>mlc01</mlc_path></content>"
        )
        with patch.object(self.util, "guess_game_dir", return_value=None) as guess:
            self.assertEqual(
                self.api.parse_cemu_settings({"folder": str(self.app)}), {}
            )
        guess.assert_called_once_with(self.cemu_data / "mlc01")

    def test_invalid_cemu_settings_preserve_failure_and_log(self) -> None:
        """XML 读取失败保留原始异常和日志，与有效空结果分开。"""
        (self.cemu_data / "settings.xml").write_text("<invalid")
        with self.assertRaises(RuntimeError) as context:
            self.api.parse_cemu_settings({"folder": str(self.app)})
        self.assertIsNotNone(context.exception.__cause__)
        self.assertIn("ExpatError", self.log.read_text())

    def test_cemu_can_start_without_game_dump(self) -> None:
        """仅启动 Cemu 时不要求游戏文件，提交的是原生可执行文件及数据目录。"""
        with patch.object(
            self.api_module, "Popen", return_value=SimpleNamespace(pid=321)
        ) as spawn:
            result = self.api.launch_cemu({"run_game": False})
        self.assertEqual(result, {"success": True, "data": None})
        spawn.assert_called_once_with([str(self.executable)], cwd=str(self.cemu_data))
        self.assertIn("pid=321", self.log.read_text())

    def test_cemu_spawn_failure_preserves_original_reason(self) -> None:
        """进程提交失败返回错误状态，日志保留异常类型及平台原始错误。"""
        with patch.object(
            self.api_module, "Popen", side_effect=OSError(8, "Exec format error")
        ):
            result = self.api.launch_cemu({"run_game": False})
        self.assertNotIn("success", result)
        self.assertIn("Exec format error", result["error"]["short"])
        self.assertIn("OSError", self.log.read_text())
        self.assertIn("Cemu spawn:", self.log.read_text())
        self.assertNotIn("process started", self.log.read_text())

    def test_native_game_arguments_keep_spaces(self) -> None:
        """原生 Cemu 使用参数列表传递带空格的游戏路径，不经 Wine 转换。"""
        game = self.root / "Game With Spaces"
        (game / "code").mkdir(parents=True)
        rpx = game / "code" / "U-King.rpx"
        rpx.write_bytes(b"test fixture")
        with patch.object(
            self.util, "get_game_dir", return_value=game / "content"
        ), patch.object(
            self.api_module, "Popen", return_value=SimpleNamespace(pid=322)
        ) as spawn:
            result = self.api.launch_cemu({"run_game": True})
        self.assertIn("success", result)
        spawn.assert_called_once_with(
            [str(self.executable), "-g", str(rpx)], cwd=str(self.cemu_data)
        )

    def test_windows_and_linux_launch_paths(self) -> None:
        """对照 Windows 原生启动与 Linux Wine 启动的现有命令格式。"""
        windows = self.root / "cemu-windows"
        windows.mkdir()
        executable = windows / "Cemu.exe"
        executable.touch()
        self.settings["cemu_dir"] = str(windows)
        for platform, expected in (
            ("Windows", [str(executable)]),
            ("Linux", ["wine", str(executable)]),
        ):
            with self.subTest(platform=platform), patch.object(
                self.api_module, "SYSTEM", platform
            ), patch.object(self.util, "system", return_value=platform), patch.object(
                self.api_module, "Popen", return_value=SimpleNamespace(pid=323)
            ) as spawn:
                self.assertIn("success", self.api.launch_cemu({"run_game": False}))
                spawn.assert_called_once_with(expected, cwd=str(windows))

    def test_source_update_does_not_start_pypi_updater(self) -> None:
        """macOS 源码安装明确提示使用 uv 更新，不启动会替换锁定依赖的 pip 脚本。"""
        with patch.object(self.api_module, "Popen") as spawn:
            result = self.api.update_bcml()
        self.assertNotIn("success", result)
        self.assertIn("uv sync --locked", result["error"]["short"])
        spawn.assert_not_called()

    def test_native_export_and_portable_settings(self) -> None:
        """独立进程实测 Rust 读取便携配置、创建 macOS 链接、复制及原始错误传递。"""
        script = """
from pathlib import Path
import json
from bcml import bcml as native
root = Path.cwd()
data = root / "bcml-data"
data.mkdir()
store = root / "store"
mod = store / "mods" / "0001_test" / "content"
mod.mkdir(parents=True)
(mod / "fixture.txt").write_text("macOS export fixture")
output = root / "new-data" / "graphicPacks" / "BCML"
settings = {"store_dir": str(store), "export_dir": str(output), "wiiu": True, "no_cemu": False, "no_hardlinks": False}
(data / "settings.json").write_text(json.dumps(settings))
native.reload_settings()
from bcml import install
install.link_master_mod()
assert output.is_symlink(), "macOS must export through a native Unix symlink"
assert (output / "content" / "fixture.txt").read_text() == "macOS export fixture"
assert (output / "rules.txt").is_file()
settings["no_hardlinks"] = True
(data / "settings.json").write_text(json.dumps(settings))
native.reload_settings()
install.link_master_mod()
assert not output.is_symlink()
assert (output / "content" / "fixture.txt").read_text() == "macOS export fixture"
blocker = root / "blocked-output"
blocker.write_text("not a directory")
settings["no_hardlinks"] = False
(data / "settings.json").write_text(json.dumps(settings))
native.reload_settings()
try:
    install.link_master_mod(blocker)
except Exception as error:
    assert "Failed to clear output folder" in str(error), repr(error)
    assert "Not a directory" in str(error), repr(error)
else:
    raise AssertionError("invalid export target must fail")
"""
        working = self.root / "native-process"
        working.mkdir()
        result = subprocess.run(
            [sys.executable, "-c", script, "--portable"],
            cwd=working,
            text=True,
            capture_output=True,
            timeout=60,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_logging_failure_keeps_cemu_failure(self) -> None:
        """日志文件不可写时单独提示日志错误，并保留首次 Cemu 启动失败。"""
        import io

        unavailable = Mock()
        unavailable.open.side_effect = PermissionError("read-only log")
        with patch.object(self.util, "LOG", unavailable), patch.object(
            self.api_module, "Popen", side_effect=OSError(8, "Exec format error")
        ), patch("sys.stderr", new_callable=io.StringIO) as stderr:
            result = self.api.launch_cemu({"run_game": False})
        self.assertIn("Exec format error", result["error"]["short"])
        self.assertIn("BCML logging failed", stderr.getvalue())
        self.assertIn("read-only log", stderr.getvalue())

    def test_missing_game_does_not_spawn_cemu(self) -> None:
        """选择启动游戏但游戏缺失时明确失败，不提交残缺命令。"""
        with patch.object(
            self.util, "get_game_dir", return_value=self.root / "game" / "content"
        ), patch.object(self.api_module, "Popen") as spawn:
            result = self.api.launch_cemu({"run_game": True})
        self.assertIn("could not be found", result["error"]["short"])
        spawn.assert_not_called()

    def test_native_archive_round_trip_with_unicode_paths(self) -> None:
        """使用实际 7zz 创建和解包带中文及空格路径的归档，并通过现有模组入口读取。"""
        executable = self.util.get_7z_path()
        source = self.root / "测试 模组"
        source.mkdir()
        (source / "info.json").write_text(
            json.dumps({"name": "测试", "platform": "wiiu"})
        )
        archive = self.root / "测试 mod.bnp"
        subprocess.run(
            [executable, "a", "-tzip", str(archive), "info.json"],
            cwd=source,
            check=True,
            capture_output=True,
            timeout=30,
        )
        unpacked = self.install.open_mod(archive)
        self.addCleanup(self.install.shutil.rmtree, unpacked, True)
        self.assertEqual(
            json.loads((unpacked / "info.json").read_text())["name"], "测试"
        )
        self.assertEqual(self.install.extract_mod_meta(archive)["name"], "测试")

    def test_missing_archive_tool_has_actionable_error(self) -> None:
        """缺少归档工具时不执行 Linux ELF，明确提示安装系统工具。"""
        with patch.object(self.util.shutil, "which", return_value=None):
            with self.assertRaisesRegex(FileNotFoundError, "brew install sevenzip"):
                self.util.get_7z_path()

    def test_uri_registration_skips_linux_commands(self) -> None:
        """macOS 不生成 Linux desktop 文件，也不执行 xdg-mime，并记录跳过原因。"""
        with patch.object(self.oneclick, "system", return_value="Darwin"), patch.object(
            self.oneclick, "_linux_create_handler"
        ) as linux:
            self.oneclick.register_handlers()
        linux.assert_not_called()
        self.assertIn("registration skipped", self.log.read_text())
