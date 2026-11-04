"""在独立便携目录验证界面语言的默认值、API 保存和旧设置兼容性。"""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class InterfaceLanguageTests(unittest.TestCase):
    """通过实际设置 API 验证持久化，不访问用户现有配置。"""

    def test_language_settings_round_trip_and_legacy_defaults(self) -> None:
        """保存中文界面时保留游戏语言，旧配置缺少界面语言时使用系统默认。"""
        script = """
import json
from bcml import util
from bcml._api import Api
api = Api("http://127.0.0.1")
settings = api.get_settings()
assert settings["ui_language"] == "auto"
settings.update(ui_language="zh-CN", lang="USen", no_cemu=True)
api.save_settings({"settings": settings})
settings_path = util.get_data_dir() / "settings.json"
saved = json.loads(settings_path.read_text(encoding="utf-8"))
assert saved["ui_language"] == "zh-CN"
assert saved["lang"] == "USen"
del util.get_settings.settings
assert api.get_settings()["ui_language"] == "zh-CN"
settings = api.get_settings().copy()
settings["ui_language"] = "en"
api.save_settings({"settings": settings})
assert json.loads(settings_path.read_text(encoding="utf-8"))["ui_language"] == "en"
saved.pop("ui_language")
settings_path.write_text(json.dumps(saved), encoding="utf-8")
del util.get_settings.settings
legacy = api.get_settings()
assert legacy["ui_language"] == "auto"
assert legacy["lang"] == "USen"
"""
        with tempfile.TemporaryDirectory(prefix="bcml-language-") as directory:
            result = subprocess.run(
                [sys.executable, "-c", script, "--portable"],
                cwd=Path(directory),
                capture_output=True,
                text=True,
                timeout=30,
            )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
