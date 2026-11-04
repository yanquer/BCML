import { t, setInterfaceLanguage } from "./i18n";
import { Button, Col, Form, OverlayTrigger, Row, Tooltip } from "react-bootstrap";

import FolderInput from "./Folder.jsx";
import React from "react";

class Settings extends React.Component {
    constructor() {
        super();
        this.state = {
            cemu_dir: "",
            game_dir: "",
            game_dir_nx: "",
            update_dir: "",
            dlc_dir: "",
            dlc_dir_nx: "",
            store_dir: "",
            export_dir: "",
            export_dir_nx: "",
            load_reverse: false,
            site_meta: "",
            no_guess: false,
            lang: "",
            ui_language: "auto",
            no_cemu: false,
            wiiu: true,
            no_hardlinks: false,
            force_7z: false,
            suppress_update: false,
            valid: false,
            loaded: false,
            nsfw: false,
            changelog: true,
            strip_gfx: false,
            auto_gb: true,
            show_gb: true,
            languages: [...Array.from(Object.keys(LANGUAGE_MAP))]
        };
        this.formRef = React.createRef();
    }

    checkValid = async () => {
        const gameValid =
            !this.state.wiiu ||
            (await pywebview.api.dir_exists({
                folder: this.state.game_dir,
                type: "game_dir"
            }));
        const gameNxValid =
            this.state.wiiu ||
            (await pywebview.api.dir_exists({
                folder: this.state.game_dir_nx,
                type: "game_dir"
            }));
        const updateValid =
            !this.state.wiiu ||
            (await pywebview.api.dir_exists({
                folder: this.state.update_dir,
                type: "update_dir"
            }));
        const cemuValid =
            this.state.no_cemu ||
            (await pywebview.api.dir_exists({
                folder: this.state.cemu_dir,
                type: "cemu_dir"
            }));
        const dlcValid =
            !this.state.wiiu ||
            this.state.dlc_dir == "" ||
            (await pywebview.api.dir_exists({
                folder: this.state.dlc_dir,
                type: "dlc_dir"
            }));
        const dlcNxValid =
            this.state.wiiu ||
            this.state.dlc_dir_nx == "" ||
            (await pywebview.api.dir_exists({
                folder: this.state.dlc_dir_nx,
                type: "dlc_dir"
            }));
        return (
            gameValid &&
            gameNxValid &&
            updateValid &&
            dlcValid &&
            dlcNxValid &&
            cemuValid &&
            this.state.lang != "" &&
            this.state.store_dir != "" &&
            this.formRef.current.checkValidity()
        );
    };

    componentDidMount = async () => {
        const settings = await pywebview.api.get_settings();
        const languages = await pywebview.api.get_user_langs({
            dir: settings.wiiu ? settings.game_dir : settings.game_dir_nx
        });
        this.setState({ ...settings, languages }, () =>
            this.setState({ loaded: true })
        );
    };

    async componentDidUpdate(prevProps, prevState) {
        if (!prevState.loaded) return;
        if (!prevProps.saving && this.props.saving) {
            if (!(await this.checkValid())) {
                this.setState({ valid: false }, () => this.props.onFail());
            } else {
                this.setState({ valid: true }, () => {
                    let { valid, languages, ...settings } = this.state;
                    this.props.onSubmit(settings);
                });
            }
        } else {
            if (prevState.cemu_dir != this.state.cemu_dir) {
                if (
                    await pywebview.api.dir_exists({
                        folder: this.state.cemu_dir,
                        type: "cemu_dir"
                    })
                ) {
                    try {
                        this.setState({
                            ...(await pywebview.api.parse_cemu_settings({
                                folder: this.state.cemu_dir
                            }))
                        });
                    } catch (error) {
                        this.props.onError(error);
                    }
                }
            }
            if (
                prevState.game_dir != this.state.game_dir ||
                prevState.game_dir_nx != this.state.game_dir_nx
            ) {
                const languages = await pywebview.api.get_user_langs({
                    dir: this.state.wiiu ? this.state.game_dir : this.state.game_dir_nx
                });
                this.setState({
                    languages
                });
            }
            for (const key of Object.keys(this.state).filter(
                k =>
                    k.includes("dir") &&
                    !["cemu_dir", "store_dir", "export_dir"].includes(k) &&
                    prevState[k] != this.state[k] &&
                    !prevState[k]
            )) {
                this.props.onProgress(t("Checking Folder, One Sec..."));
                let dir = await pywebview.api.drill_dir({
                    type: key,
                    folder: this.state[key]
                });
                this.props.onDone();
                this.setState({
                    [key]: dir
                });
            }
        }
    }

    handleChange = e => {
        try {
            e.persist();
        } catch (error) {}
        if (e.target.id === "ui_language") setInterfaceLanguage(e.target.value);
        this.setState({
            [e.target.id]:
                e.target.type != "checkbox" ? e.target.value : e.target.checked
        });
    };

    makeShortcut = async desktop => {
        try {
            this.props.onProgress(t("Creating shortcut..."));
            await pywebview.api.make_shortcut({ desktop });
            this.props.onDone();
        } catch (error) {
            this.props.onError(error);
        }
    };

    render() {
        return (
            <Form
                noValidate
                validated={this.state.valid}
                onSubmit={this.handleSubmit}
                ref={this.formRef}
                className="settings">
                <Form.Group controlId="ui_language">
                    <Form.Label>{t("Interface Language")}</Form.Label>
                    <Form.Control
                        as="select"
                        value={this.state.ui_language}
                        onChange={this.handleChange}>
                        <option value="auto">{t("Follow system")}</option>
                        <option value="zh-CN">简体中文</option>
                        <option value="en">English</option>
                    </Form.Control>
                    <Form.Text>
                        {t(
                            "Changes apply immediately. Save settings to keep this choice. Game text language is configured separately."
                        )}
                    </Form.Text>
                </Form.Group>
                <h5>{t("Game Folders")}</h5>
                <Row>
                    <Col>
                        <Form.Group controlId="cemu_dir">
                            <Form.Label>{t("Cemu Directory")}</Form.Label>
                            <FolderInput
                                value={this.state.cemu_dir}
                                disabled={!this.state.wiiu || this.state.no_cemu}
                                onChange={this.handleChange}
                                placeholder={t(
                                    "Folder containing Cemu.exe or Cemu.app"
                                )}
                                isValid={
                                    this.state.cemu_dir != "" || this.state.no_cemu
                                }
                                overlay={
                                    <Tooltip>
                                        {this.state.wiiu ? (
                                            <>
                                                {t(
                                                    "(Optional) The directory where Cemu is installed. Note that this "
                                                )}
                                                <em>{t("must")}</em>{" "}
                                                {t(
                                                    "be the folder containing Cemu.exe on Windows or Cemu.app on macOS. Start Cemu once before selecting it."
                                                )}
                                            </>
                                        ) : (
                                            t("Not applicable for Switch mode")
                                        )}
                                    </Tooltip>
                                }
                            />
                            <Form.Control.Feedback type="invalid">
                                {t(
                                    "A Cemu folder is required unless you check the no Cemu option"
                                )}
                            </Form.Control.Feedback>
                        </Form.Group>
                    </Col>
                    <Col>
                        <Form.Group
                            controlId="game_dir"
                            className={!this.state.wiiu && "d-none"}>
                            <Form.Label>{t("Base Game Directory")}</Form.Label>
                            <FolderInput
                                value={this.state.game_dir}
                                onChange={this.handleChange}
                                placeholder={t('Tip: should end in "content"')}
                                isValid={this.state.game_dir != "" || !this.state.wiiu}
                                overlay={
                                    <Tooltip>
                                        {t(
                                            'The folder containing the base game files for BOTW, without the update or DLC files. The last folder should be "content", e.g.'
                                        )}
                                        <br />
                                        <code>
                                            C:\Games\The Legend of Zelda Breath of the
                                            Wild [AZE01]\content
                                        </code>
                                    </Tooltip>
                                }
                                placement={"left"}
                            />
                        </Form.Group>
                        <Form.Control.Feedback type="invalid">
                            {t("The BOTW dump folder is required")}
                        </Form.Control.Feedback>
                        <Form.Group
                            controlId="game_dir_nx"
                            className={this.state.wiiu && "d-none"}>
                            <Form.Label>{t("Base+Update Directory")}</Form.Label>
                            <FolderInput
                                value={this.state.game_dir_nx}
                                onChange={this.handleChange}
                                isValid={
                                    this.state.game_dir_nx != "" || this.state.wiiu
                                }
                                overlay={
                                    <Tooltip>
                                        {t(
                                            'The folder containing the 1.6.0 game files for BOTW. The base game and update should be merged. The last folder should be "romfs", e.g.'
                                        )}
                                        <br />
                                        <code>
                                            C:\Games\BOTW\01007EF00011E800\romfs
                                        </code>
                                    </Tooltip>
                                }
                                placement={"left"}
                            />
                        </Form.Group>
                        <Form.Control.Feedback type="invalid">
                            {t("The BOTW dump folder is required")}
                        </Form.Control.Feedback>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <Form.Group controlId="update_dir">
                            <Form.Label>{t("Update Directory")}</Form.Label>
                            <FolderInput
                                value={this.state.update_dir}
                                onChange={this.handleChange}
                                placeholder={
                                    this.state.wiiu
                                        ? t(
                                              'Tip: should end in "content", usually in Cemu\'s MLC folder'
                                          )
                                        : t("N/A for Switch mode")
                                }
                                isValid={
                                    this.state.update_dir != "" || !this.state.wiiu
                                }
                                disabled={!this.state.wiiu}
                                overlay={
                                    <Tooltip>
                                        {this.state.wiiu ? (
                                            <>
                                                {t(
                                                    'The folder containing the update files for BOTW, version 1.5.0. The last folder should be "content", and if you use Cemu, it should be in your "mlc01" folder, e.g.'
                                                )}
                                                <br />
                                                <code>
                                                    C:\Cemu\mlc01\usr\title\0005000E\101C9400\content
                                                </code>
                                            </>
                                        ) : (
                                            t("Not applicable for Switch mode")
                                        )}
                                    </Tooltip>
                                }
                            />
                        </Form.Group>
                        <Form.Control.Feedback type="invalid">
                            {t("The BOTW update folder is required")}
                        </Form.Control.Feedback>
                    </Col>
                    <Col>
                        <Form.Group
                            controlId="dlc_dir"
                            className={!this.state.wiiu && "d-none"}>
                            <Form.Label>{t("DLC Directory")}</Form.Label>
                            <FolderInput
                                value={this.state.dlc_dir}
                                onChange={this.handleChange}
                                placeholder={t(
                                    'Tip: should end in "0010", usually in Cemu\'s MLC folder'
                                )}
                                isValid={true}
                                overlay={
                                    <Tooltip>
                                        {t(
                                            '(Optional) The folder containing the DLC files for BOTW, version 3.0. The last folder should usually be "0010", and if you use Cemu, it should be in your "mlc01" folder, e.g.'
                                        )}
                                        <br />
                                        <code>
                                            C:\Cemu\mlc01\usr\title\0005000C\101C9400\content\0010
                                        </code>
                                    </Tooltip>
                                }
                                placement={"left"}
                            />
                        </Form.Group>

                        <Form.Group
                            controlId="dlc_dir_nx"
                            className={this.state.wiiu && "d-none"}>
                            <Form.Label>{t("DLC Directory")}</Form.Label>
                            <FolderInput
                                value={this.state.dlc_dir_nx}
                                onChange={this.handleChange}
                                isValid={true}
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "(Optional) The folder containing the DLC files for BOTW, version 3.0."
                                        )}
                                        <br />
                                        <code>
                                            C:\Games\BOTW\01007EF00011F001\romfs
                                        </code>
                                    </Tooltip>
                                }
                                placement={"left"}
                            />
                        </Form.Group>
                    </Col>
                </Row>
                <h5>{t("Options")}</h5>
                <Row>
                    <Col>
                        <Form.Group controlId="lang">
                            <Form.Label>{t("Game Language")}</Form.Label>
                            <OverlayTrigger
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "The game language you play with. This will be prioritized when attempting to merge text mods. You must correctly fill out the base game and update path settings, above, before this dropdown populates."
                                        )}
                                    </Tooltip>
                                }>
                                <Form.Control
                                    as="select"
                                    value={this.state.lang}
                                    isValid={this.state.lang != ""}
                                    onChange={this.handleChange}>
                                    <option value={""}>{t("Select a language")}</option>
                                    {this.state.languages.map(lang => (
                                        <option value={lang} key={lang}>
                                            {t(LANGUAGE_MAP[lang] || lang)}
                                        </option>
                                    ))}
                                </Form.Control>
                            </OverlayTrigger>
                            <Form.Control.Feedback type="invalid">
                                {t("You must select a game language")}
                            </Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group controlId="store_dir">
                            <Form.Label>{t("BCML Data Directory")}</Form.Label>
                            <FolderInput
                                value={this.state.store_dir}
                                onChange={this.handleChange}
                                isValid={this.state.store_dir != ""}
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "The folder where BCML will store internal files like installed mods, merged data, and backups."
                                        )}
                                    </Tooltip>
                                }
                            />
                            <Form.Control.Feedback type="invalid">
                                {t("The BCML data folder is required")}
                            </Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group
                            controlId="export_dir"
                            className={
                                (!this.state.wiiu || !this.state.no_cemu) && "d-none"
                            }>
                            <Form.Label>{t("Merged Export Directory")}</Form.Label>
                            <FolderInput
                                value={this.state.export_dir}
                                onChange={this.handleChange}
                                isValid={true}
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "(Optional) Where to automatically export the final merged mod pack."
                                        )}
                                        <br />
                                        <br />
                                        {t(
                                            "WARNING: The contents of this folder will be deleted. Do not set this to a folder whose contents you wish to retain."
                                        )}
                                    </Tooltip>
                                }
                                placeholder={t("Optional")}
                            />
                        </Form.Group>
                        <Form.Group
                            controlId="export_dir_nx"
                            className={this.state.wiiu && "d-none"}>
                            <Form.Label>{t("Merged Export Directory")}</Form.Label>
                            <FolderInput
                                value={this.state.export_dir_nx}
                                onChange={this.handleChange}
                                isValid={true}
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "(Optional) Where to automatically export the final merged mod pack."
                                        )}
                                    </Tooltip>
                                }
                                placeholder={t("Optional")}
                            />
                        </Form.Group>
                        {window.navigator.userAgent.includes("Windows") && (
                            <>
                                <h5>{t("Create BCML Shortcuts")}</h5>
                                <Button
                                    variant="success"
                                    onClick={() => this.makeShortcut(true)}>
                                    {t("Desktop")}
                                </Button>{" "}
                                <Button
                                    variant="success"
                                    onClick={() => this.makeShortcut(false)}>
                                    {t("Start Menu")}
                                </Button>
                            </>
                        )}
                    </Col>
                    <Col>
                        <br />
                        <Form.Group controlId="wiiu">
                            <OverlayTrigger
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "Turn on Switch mode instead of Wii U/Cemu mode"
                                        )}
                                    </Tooltip>
                                }
                                placement={"left"}>
                                <Form.Check
                                    type="checkbox"
                                    label={t("Use Switch mode")}
                                    checked={!this.state.wiiu}
                                    onChange={e =>
                                        this.setState({
                                            wiiu: !e.target.checked,
                                            no_cemu: true
                                        })
                                    }
                                />
                            </OverlayTrigger>
                        </Form.Group>
                        <Form.Group controlId="no_cemu">
                            <OverlayTrigger
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "Allows you to use BCML without Cemu on your PC. If you do this, you will need to be careful about getting the right directories for update and DLC files. You will be able to merge installed mods with Export."
                                        )}
                                    </Tooltip>
                                }
                                placement={"left"}>
                                <Form.Check
                                    type="checkbox"
                                    disabled={!this.state.wiiu}
                                    label={t("Use BCML without a Cemu installation")}
                                    checked={this.state.no_cemu}
                                    onChange={this.handleChange}
                                />
                            </OverlayTrigger>
                        </Form.Group>
                        <Form.Group controlId="strip_gfx">
                            <OverlayTrigger
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "To save disk space, BCML can optionally remove unmodified files contained in the SARC files in graphic pack mods. This disables the Reprocess button, so it may not be desirable for mod developers."
                                        )}
                                    </Tooltip>
                                }
                                placement={"left"}>
                                <Form.Check
                                    type="checkbox"
                                    label={t(
                                        "Clean SARCs in graphic packs to save space"
                                    )}
                                    checked={this.state.strip_gfx}
                                    onChange={this.handleChange}
                                />
                            </OverlayTrigger>
                        </Form.Group>
                        <Form.Group controlId="no_guess">
                            <OverlayTrigger
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "Don't estimate proper RSTB values for merged files. Deletes entries which cannot be calculated instead."
                                        )}
                                    </Tooltip>
                                }
                                placement={"left"}>
                                <Form.Check
                                    type="checkbox"
                                    label={t("Disable RSTB estimation on merged files")}
                                    checked={this.state.no_guess}
                                    onChange={this.handleChange}
                                />
                            </OverlayTrigger>
                        </Form.Group>
                        <Form.Group controlId="no_hardlinks">
                            <OverlayTrigger
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "By default, BCML uses directory junctions or symlinks to connect installed mods to their merged destination. Use this option to disable this if it doesn't work and just copy the files instead."
                                        )}
                                    </Tooltip>
                                }
                                placement={"left"}>
                                <Form.Check
                                    type="checkbox"
                                    label={t("Disable links for master mod")}
                                    checked={this.state.no_hardlinks}
                                    onChange={this.handleChange}
                                />
                            </OverlayTrigger>
                        </Form.Group>
                        <Form.Group controlId="suppress_update">
                            <OverlayTrigger
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "By default, BCML will notify you when it detects an updated version is available. Check this to turn that off."
                                        )}
                                    </Tooltip>
                                }
                                placement={"left"}>
                                <Form.Check
                                    type="checkbox"
                                    label={t("Disable BCML update notification")}
                                    checked={this.state.suppress_update}
                                    onChange={this.handleChange}
                                />
                            </OverlayTrigger>
                        </Form.Group>
                        <Form.Group controlId="changelog">
                            <OverlayTrigger
                                overlay={
                                    <Tooltip>
                                        {t(
                                            "If checked, BCML will show a changelog popup after updating to a new version."
                                        )}
                                    </Tooltip>
                                }
                                placement={"left"}>
                                <Form.Check
                                    type="checkbox"
                                    label={t("Show changelog after update")}
                                    checked={this.state.changelog}
                                    onChange={this.handleChange}
                                />
                            </OverlayTrigger>
                        </Form.Group>
                        {window.navigator.platform.includes("inux") && (
                            <Form.Group controlId="force_7z">
                                <OverlayTrigger
                                    overlay={
                                        <Tooltip>
                                            {t(
                                                "By default, BCML will attempt to use the system installation of 7z. If this is a problem, you can force BCML to use the bundled copy."
                                            )}
                                        </Tooltip>
                                    }
                                    placement={"left"}>
                                    <Form.Check
                                        type="checkbox"
                                        label={t("Force use bundled 7z")}
                                        checked={this.state.force_7z}
                                        onChange={this.handleChange}
                                    />
                                </OverlayTrigger>
                            </Form.Group>
                        )}
                    </Col>
                </Row>
            </Form>
        );
    }
}

const LANGUAGE_MAP = {
    USen: "US English",
    EUen: "EU English",
    USfr: "US French (Français)",
    USes: "US Spanish (Español)",
    EUde: "EU German (Deutsch)",
    EUes: "EU Spanish (Español)",
    EUfr: "EU French (Français)",
    EUit: "EU Italian (Italiano)",
    EUnl: "EU Dutch (Nederlands)",
    EUru: "EU Russian (Русский)",
    CNzh: "Chinese (中文)",
    JPja: "Japanese (日本語)",
    KRko: "Korean (한국어)",
    TWzh: "Traditional Chinese (‪中文(台灣)‬)",
    "": "Please select a language"
};

export default Settings;
