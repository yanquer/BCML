// 验证界面语言识别、切换通知、英文回退和动态文案，避免依赖真实用户配置。
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const babel = require("@babel/core");
const translations = require("../src/js/locales/zh-CN.json");

const events = [];
const context = {
    exports: {},
    require: () => translations,
    navigator: { languages: ["zh-CN", "en-US"] },
    document: { documentElement: {} },
    window: { dispatchEvent: event => events.push(event.type) },
    Event: class {
        /** 记录待分发的事件名称。
         * @param {string} type 事件名称。
         */
        constructor(type) {
            this.type = type;
        }
    }
};
const sourcePath = path.resolve(__dirname, "../src/js/i18n.js");
const source = fs.readFileSync(sourcePath, "utf8");
vm.runInNewContext(
    babel.transformSync(source, {
        presets: [["@babel/preset-env", { targets: { node: "14" } }]]
    }).code,
    context
);
const { resolveLanguage, getInterfaceLanguage, setInterfaceLanguage, t } =
    context.exports;

assert.strictEqual(getInterfaceLanguage(), "zh-CN");
assert.strictEqual(resolveLanguage("en", ["zh-CN"]), "en");
assert.strictEqual(resolveLanguage("zh-CN", ["en-US"]), "zh-CN");
assert.strictEqual(resolveLanguage("auto", ["zh-TW"]), "zh-CN");
assert.strictEqual(resolveLanguage(undefined, ["en-US", "zh-CN"]), "en");
assert.strictEqual(resolveLanguage("unsupported", ["zh-Hans-CN"]), "zh-CN");
assert.strictEqual(resolveLanguage("auto", []), "en");
assert.strictEqual(t("Settings"), "设置");
assert.strictEqual(t("Installing Mods"), "正在安装多个模组");
assert.strictEqual(t(" Current Profile: "), " 当前配置方案： ");
assert.strictEqual(t("{count} mods", { count: 0 }), "0 个模组");
assert.strictEqual(
    t("Are you sure you want to {action} {names}?", {
        action: t("Uninstall"),
        names: "中文模组, English mod"
    }),
    "确定卸载以下模组吗：中文模组, English mod？"
);
assert.strictEqual(
    t("Restoring {name}", { name: "中文 $& {count}" }),
    "正在恢复 中文 $& {count}"
);
assert.strictEqual(
    t("Original Error: PermissionError /中文目录"),
    "Original Error: PermissionError /中文目录"
);
assert.strictEqual(t("toString"), "toString");
assert.strictEqual(t("Restoring {name}"), "正在恢复 {name}");
assert.strictEqual(t(""), "");
assert.strictEqual(t(" \n"), " \n");
setInterfaceLanguage("en");
assert.strictEqual(context.document.documentElement.lang, "en");
assert.strictEqual(t("Settings"), "Settings");
assert.strictEqual(t("{count} mods", { count: 2 }), "2 mods");
setInterfaceLanguage("en");
assert.deepStrictEqual(events, ["bcml-language-change"]);
setInterfaceLanguage("auto");
assert.strictEqual(context.document.documentElement.lang, "zh-CN");
assert.strictEqual(t("Settings"), "设置");
assert.deepStrictEqual(events, ["bcml-language-change", "bcml-language-change"]);

// 翻译不能丢失、增加或拼错占位符，否则会出现不完整的操作对象和数量。
for (const [message, translated] of Object.entries(translations)) {
    assert.strictEqual(typeof translated, "string", message);
    assert.ok(translated.trim(), message);
    assert.deepStrictEqual(
        (message.match(/\{\w+\}/g) || []).sort(),
        (translated.match(/\{\w+\}/g) || []).sort(),
        message
    );
}
console.log("界面语言测试通过（语言选择、即时切换、英文回退、插值与词条占位符）");
