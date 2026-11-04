import "./scss/App.scss";
import App from "./js/App.jsx";
import FirstRun from "./js/FirstRun.jsx";
import React from "react";
import { getInterfaceLanguage, setInterfaceLanguage } from "./js/i18n";
import ReactDOM from "react-dom";

/** 订阅界面语言变化，在保留表单和模组选择状态的同时重新渲染当前页面。
 * @returns {React.ReactElement} 当前应用或首次设置向导。
 */
function LocalizedApp() {
    const [language, setLanguage] = React.useState(getInterfaceLanguage);
    React.useEffect(() => {
        const updateLanguage = () => setLanguage(getInterfaceLanguage());
        window.addEventListener("bcml-language-change", updateLanguage);
        return () => window.removeEventListener("bcml-language-change", updateLanguage);
    }, []);
    return window.location.toString().includes("firstrun") ? (
        <FirstRun interfaceLanguage={language} />
    ) : (
        <App interfaceLanguage={language} />
    );
}

document.addEventListener("DOMContentLoaded", () => {
    setInterfaceLanguage("auto");
    ReactDOM.render(<LocalizedApp />, document.getElementById("root"));
});
