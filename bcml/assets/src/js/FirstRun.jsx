import { t, setInterfaceLanguage } from "./i18n";
import {
    Alert,
    Button,
    Carousel,
    FormCheck,
    Modal,
    OverlayTrigger,
    Spinner,
    Tooltip
} from "react-bootstrap";

import DonateWidget from "./Donate.jsx";
import ErrorDialog from "./Error.jsx";
import React from "react";
import Settings from "./Settings.jsx";

class FirstRun extends React.Component {
    pageCount = 4;

    constructor() {
        super();
        this.state = {
            page: 0,
            oldSettings: false,
            converted: "",
            settingsLoaded: false,
            settingsValid: false,
            savingSettings: false,
            oldMods: 0,
            handlingMods: false,
            modsHandled: false,
            handledError: null,
            modProgress: "",
            error: null,
            showError: false,
            willRead: false
        };
        this.goBack = () => {
            const page = this.state.page - 1;
            this.setState({ page: page >= 0 ? page : 0 });
        };
        this.goForward = () => {
            if (!this.state.settingsLoaded) this.checkSettings();
            const page = this.state.page + 1;
            this.setState({
                page: page < this.pageCount ? page : this.pageCount - 1
            });
        };
        this.goHome = () => (window.location = "index.html");
        this.checkSettings = this.checkSettings.bind(this);
        this.saveSettings = this.saveSettings.bind(this);
        this.showError = this.showError.bind(this);
    }

    /** 首次设置首页读取保存的界面语言，并通过现有错误弹窗呈现读取失败。
     * @returns {Promise<void>} 语言初始化完成状态。
     */
    loadInterfaceLanguage = async () => {
        try {
            const settings = await pywebview.api.get_settings();
            setInterfaceLanguage(settings.ui_language);
        } catch (error) {
            this.showError(error);
        }
    };

    /** 在 WebView 桥接就绪时加载界面语言。
     * @returns {void}
     */
    componentDidMount() {
        window.addEventListener("pywebviewready", this.loadInterfaceLanguage);
    }

    /** 页面卸载时移除语言初始化监听。
     * @returns {void}
     */
    componentWillUnmount() {
        window.removeEventListener("pywebviewready", this.loadInterfaceLanguage);
    }

    showError(error) {
        try {
            console.error(JSON.stringify(error));
        } catch (error) {
            console.log(JSON.stringify(error));
        }
        this.setState({
            showError: true,
            error
        });
    }

    checkSettings() {
        pywebview.api.old_settings().then(res => {
            this.setState({
                oldSettings: res.exists,
                converted: res.message,
                settingsLoaded: true
            });
        });
    }

    saveSettings(settings) {
        this.setState({ settingsValid: true, savingSettings: false }, () =>
            pywebview.api
                .save_settings({ settings })
                .then(() =>
                    pywebview.api.get_old_mods().then(num => {
                        this.setState({ oldMods: num });
                        if (num > 0) {
                            this.pageCount = 5;
                        }
                    })
                )
                .catch(this.showError)
        );
    }

    handleMods(action) {
        window.onMsg = msg => this.setState({ modProgress: msg });
        this.setState({ handlingMods: true }, () => {
            if (action == "convert") {
                pywebview.api
                    .convert_old_mods()
                    .then(() => this.setState({ modsHandled: true }))
                    .catch(err =>
                        this.setState({
                            modsHandled: true,
                            showError: true,
                            error: err
                        })
                    );
            } else if (action == "delete") {
                pywebview.api
                    .delete_old_mods()
                    .then(() => this.setState({ modsHandled: true }))
                    .catch(err =>
                        this.setState({
                            modsHandled: true,
                            showError: true,
                            error: err
                        })
                    );
            }
        });
    }

    render() {
        return (
            <div className="d-flex flex-column" style={{ height: "100vh" }}>
                <Modal.Header>
                    <Modal.Title>{t("Welcome to BCML")}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-flex flex-column flex-grow-1 overflow-y">
                    <Carousel
                        id="pages"
                        controls={false}
                        indicators={false}
                        activeIndex={this.state.page}
                        onSelect={() => {}}
                        className="position-relative flex-grow-1"
                        wrap={false}>
                        <Carousel.Item>
                            <img
                                src="logo-smaller.png"
                                style={{
                                    width: "calc(100% + 2rem)",
                                    margin: "-1rem"
                                }}
                            />
                            <p className="mt-4 mb-1">
                                {t(
                                    "Thank you for installing BCML. It appears that this is your first time running it, or you have upgraded from an old version. We'll need to do a few things to get you set up."
                                )}
                            </p>
                        </Carousel.Item>
                        <Carousel.Item>
                            <h2>
                                <i className="material-icons">settings</i>
                                {t(" Import Settings")}
                            </h2>
                            {this.state.oldSettings ? (
                                <div>
                                    <p>
                                        {t(
                                            "It looks like you are upgrading from a previous version of BCML. BCML has attempted to import your old settings. Result:"
                                        )}
                                    </p>
                                    <p>{t(this.state.converted)}</p>
                                </div>
                            ) : (
                                <div>
                                    {t(
                                        "Let's see, it doesn't look like you are upgrading from a previous version of BCML. Alright then, we'll set you up from scratch on the next page."
                                    )}
                                </div>
                            )}
                        </Carousel.Item>
                        <Carousel.Item>
                            {this.state.settingsLoaded && (
                                <>
                                    {this.state.oldSettings ? (
                                        <p>
                                            {t(
                                                "Take a look at your imported settings and check that everything seems right."
                                            )}
                                        </p>
                                    ) : (
                                        <div className="d-flex">
                                            <p className="flex-grow-1">
                                                {t(
                                                    "Take a moment to configure your basic settings. Folders will turn green when valid. If you need help with this, click the buttons to the right for the in-app Help or the YouTube tutorial."
                                                )}
                                            </p>
                                            <div>
                                                <Button
                                                    size="sm"
                                                    variant="warning"
                                                    onClick={() =>
                                                        pywebview.api.open_help()
                                                    }>
                                                    <i className="material-icons">
                                                        help_outline
                                                    </i>{" "}
                                                    {t("Help")}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    href="https://www.youtube.com/embed/8gKRifYyA68"
                                                    target="_blank">
                                                    <i className="material-icons">
                                                        play_circle_outline
                                                    </i>{" "}
                                                    {t("Tutorial")}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    <Settings
                                        saving={this.state.savingSettings}
                                        onError={this.showError}
                                        onFail={() =>
                                            this.setState({
                                                savingSettings: false,
                                                showError: true,
                                                error: {
                                                    short: t(
                                                        "Your settings are not valid and cannot be saved. Check that all required fields are completed and green before submitting. If you have trouble, consult the in-app help."
                                                    ),
                                                    error_text: t(
                                                        "Your settings are not valid and cannot be saved. Check that all required fields are completed and green before submitting. If you have trouble, consult the in-app help."
                                                    )
                                                }
                                            })
                                        }
                                        onSubmit={this.saveSettings}
                                    />
                                </>
                            )}
                        </Carousel.Item>
                        {this.state.oldMods > 0 && (
                            <Carousel.Item>
                                <h2>
                                    <i className="material-icons">double_arrow</i>{" "}
                                    {t("Import Mods")}
                                </h2>
                                <p>
                                    {t("It looks like you have ")}
                                    {this.state.oldMods}
                                    {t(
                                        " mods from a previous version of BCML. If you like, you can import them into your new BCML version, or you can just delete or ignore them. (Note that ignoring them is not recommended.)"
                                    )}
                                </p>
                                <div className="d-flex mb-2">
                                    <Button
                                        variant="success"
                                        size="sm"
                                        onClick={() => this.handleMods("convert")}>
                                        <i className="material-icons">double_arrow</i>{" "}
                                        <span>{t("Import")}</span>
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => this.handleMods("delete")}>
                                        <i className="material-icons">delete</i>{" "}
                                        <span>{t("Delete")}</span>
                                    </Button>
                                    <Button
                                        variant="warning"
                                        size="sm"
                                        onClick={() =>
                                            this.setState({
                                                modsHandled: true,
                                                handlingMods: true
                                            })
                                        }>
                                        <i className="material-icons">warning</i>{" "}
                                        <span>{t("Ignore")}</span>
                                    </Button>
                                </div>
                                <div className="d-flex align-items-start mt-2">
                                    {this.state.handlingMods &&
                                        (!this.state.modsHandled ? (
                                            <>
                                                <Spinner animation="border" />
                                                <div className="p-2">
                                                    {this.state.modProgress}
                                                </div>
                                            </>
                                        ) : this.state.handledError ? (
                                            <>
                                                <h3>
                                                    <i className="material-icons">
                                                        danger
                                                    </i>
                                                </h3>
                                                <p className="p-1">
                                                    <strong>
                                                        {t("Uh-oh! ")}
                                                        {this.state.handledError}
                                                    </strong>
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <h3>
                                                    <i className="material-icons">
                                                        check_circle
                                                    </i>
                                                </h3>
                                                <p className="p-1">
                                                    {t("Alright, done!")}
                                                </p>
                                            </>
                                        ))}
                                </div>
                            </Carousel.Item>
                        )}
                        <Carousel.Item>
                            <h2>
                                <i className="material-icons">check</i>
                                {t(" Setup Complete")}
                            </h2>
                            <p>
                                {t(
                                    "Alright, it looks like everything is set up. Time to start installing mods!"
                                )}
                            </p>
                            <Alert variant="info">
                                <p>
                                    {t(
                                        "If you're a first time BCML user or upgrading from 2.8, it's probably worth taking a look at"
                                    )}{" "}
                                    <strong>{t("the in-app help")}</strong>
                                    {t(
                                        ", located in the overflow menu. If you run into any problems, first try "
                                    )}
                                    <strong>{t("the in-app help")}</strong>
                                    {t(" and consider")}{" "}
                                    <strong>{t("clicking the Remerge button")}</strong>.
                                </p>
                                <FormCheck
                                    label={t(
                                        "I will read the help or I already know what I am doing. I will not ask questions if I haven't checked the help first."
                                    )}
                                    checked={this.state.willRead}
                                    onChange={e =>
                                        this.setState({
                                            willRead: e.currentTarget.checked
                                        })
                                    }
                                    style={{ fontWeight: "bold" }}
                                />
                            </Alert>
                            <h3>{t("Donate")}</h3>
                            <p>
                                {t("Support BCML's development:")}
                                <br />
                                <DonateWidget />
                            </p>
                        </Carousel.Item>
                    </Carousel>
                </Modal.Body>
                <Modal.Footer
                    style={{
                        position: "fixed",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderTop: 0
                    }}>
                    {this.state.page > 0 && (
                        <Button className="btn-nav btn-left" onClick={this.goBack}>
                            <i className="material-icons">arrow_back</i>
                        </Button>
                    )}
                    <div className="flex-grow-1"></div>
                    {this.state.page < this.pageCount - 1 ? (
                        (this.state.page == 2 && this.state.settingsValid) ||
                        this.state.page != 2 ? (
                            <Button
                                className="btn-nav btn-right"
                                onClick={this.goForward}>
                                <i className="material-icons">arrow_forward</i>
                            </Button>
                        ) : (
                            <Button
                                className="btn-nav"
                                onClick={() => this.setState({ savingSettings: true })}>
                                <i className="material-icons">save</i>
                            </Button>
                        )
                    ) : (
                        <Button
                            className="btn-nav"
                            onClick={this.goHome}
                            disabled={!this.state.willRead}
                            title={
                                !this.state.willRead &&
                                t("You must check the consent box first.")
                            }>
                            <i className="material-icons">check</i>
                        </Button>
                    )}
                </Modal.Footer>
                <ErrorDialog
                    show={this.state.showError}
                    error={this.state.error}
                    onClose={() => this.setState({ showError: false })}
                />
            </div>
        );
    }

    componentDidMount() {}
}

export default FirstRun;
