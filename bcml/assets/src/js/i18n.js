// 提供独立于游戏文本语言的界面翻译、系统语言识别和即时切换。
import translations from "./locales/zh-CN.json";

/** 根据保存的选择或系统首选语言，返回受支持的界面语言。
 * @param {string} preference 界面语言选择。
 * @param {string[]} languages 系统首选语言列表。
 * @returns {string} 实际使用的界面语言。
 */
export function resolveLanguage(
    preference,
    languages = navigator.languages || [navigator.language]
) {
    if (["zh-CN", "en"].includes(preference)) return preference;
    return /^zh(?:-|$)/i.test(languages[0] || "") ? "zh-CN" : "en";
}

let language = resolveLanguage("auto");

/** 获取当前实际使用的界面语言。
 * @returns {string} 界面语言代码。
 */
export function getInterfaceLanguage() {
    return language;
}

/** 切换界面语言并通知 React 更新，保存动作仍由现有设置流程负责。
 * @param {string} preference 界面语言选择。
 * @returns {void}
 */
export function setInterfaceLanguage(preference) {
    const next = resolveLanguage(preference);
    document.documentElement.lang = next;
    if (next === language) return;
    language = next;
    window.dispatchEvent(new Event("bcml-language-change"));
}

/** 翻译界面文案并替换占位符；缺少翻译时保留原文和原有空白。
 * @param {string} message 英文原文或消息模板。
 * @param {Object.<string, string|number>} values 占位符内容。
 * @returns {string} 可显示的文案。
 */
export function t(message, values = {}) {
    const key = message.trim();
    const translated =
        language === "zh-CN" && Object.prototype.hasOwnProperty.call(translations, key)
            ? message.replace(key, () => translations[key])
            : message;
    return translated.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(values, name)
            ? String(values[name])
            : match
    );
}
