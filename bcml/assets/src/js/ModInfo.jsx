import { t } from "./i18n";
import { Badge, Button, Spinner } from "react-bootstrap";

import ModContext from "./Context.jsx";
import React from "react";
import ReactMarkdown from "react-markdown";

class ModInfo extends React.Component {
    static contextType = ModContext;
    constructor(props) {
        super(props);
        this.state = {
            image: "",
            desc: "",
            processed: false,
            url: "",
            changes: [],
            loading: false
        };
        this.modInfos = {};
    }

    componentDidMount() {
        this.updateInfo();
    }

    componentDidUpdate(prevProps) {
        if (prevProps != this.props) {
            this.setState({ loading: true }, () => {
                this.updateInfo();
            });
        } else if (!this.props.mod && this.state.loading) {
            this.setState({ loading: false });
        }
    }

    updateInfo() {
        if (!this.props.mod) {
            this.setState({
                image: "",
                description: "",
                changes: [],
                url: "",
                processed: false
            });
        } else {
            const mod = JSON.stringify(this.props.mod);
            if (!(mod in this.modInfos)) {
                pywebview.api.get_mod_info({ mod: this.props.mod }).then(info => {
                    this.modInfos[mod] = info;
                    this.setState({ ...info, loading: false });
                });
            } else {
                this.setState({ ...this.modInfos[mod], loading: false });
            }
        }
    }

    render() {
        return (
            <>
                <div className="mod-content">
                    <div className="mod-header">
                        <img
                            src={
                                (this.props.mod &&
                                    (this.props.mod.name.includes("NSFW") ||
                                    this.props.mod.name.includes("THICC")
                                        ? "https://i.imgur.com/AfedhPe.png"
                                        : this.state.image
                                        ? "data:image/*;charset=utf-8;base64," +
                                          this.state.image
                                        : null)) ||
                                "logo-smaller.png"
                            }
                            className="mod-preview"
                        />
                        <div className="mod-preview-shadow"></div>
                        <div className="mod-title">
                            <h1>
                                {this.props.mod ? (
                                    this.state.url ? (
                                        <a href={this.state.url} target="_blank">
                                            {this.props.mod.name}
                                        </a>
                                    ) : (
                                        this.props.mod.name
                                    )
                                ) : (
                                    t("Welcome to BCML")
                                )}
                            </h1>
                            {this.props.mod && this.props.mod.disabled && (
                                <Badge variant="danger">{t("DISABLED")}</Badge>
                            )}
                        </div>
                    </div>
                    <ReactMarkdown className="mod-descrip">
                        {this.props.mod
                            ? this.state.desc || t("No description")
                            : t("No mod selected")}
                    </ReactMarkdown>
                    <div className="mod-actions">
                        <Button
                            variant="primary"
                            size="sm"
                            title={t("Explore (Ctrl+X)")}
                            disabled={!this.props.mod || this.props.multi}
                            onClick={() => this.props.onAction("explore")}>
                            <i className="material-icons">folder_open</i>{" "}
                            <span>{t("Explore")}</span>
                        </Button>
                        {this.props.mod &&
                            (this.props.mod.disabled ? (
                                <Button
                                    variant="success"
                                    size="sm"
                                    title={t("Enable (Ctrl+E)")}
                                    disabled={!this.props.mod}
                                    onClick={() => this.props.onAction("enable")}>
                                    <i className="material-icons">check_box</i>{" "}
                                    <span>{t("Enable")}</span>
                                </Button>
                            ) : (
                                <Button
                                    variant="warning"
                                    size="sm"
                                    title={t("Disable (Ctrl+D)")}
                                    disabled={!this.props.mod}
                                    onClick={() => this.props.onAction("disable")}>
                                    <i className="material-icons">block</i>{" "}
                                    <span>{t("Disable")}</span>
                                </Button>
                            ))}
                        <Button
                            variant="info"
                            size="sm"
                            title={t("Update")}
                            disabled={!this.props.mod || this.props.multi}
                            onClick={() => this.props.onAction("update")}>
                            <i className="material-icons">update</i>{" "}
                            <span>{t("Update")}</span>
                        </Button>
                        {this.state.processed && !this.context.settings?.strip_gfx && (
                            <Button
                                variant="secondary"
                                size="sm"
                                title={t("Reprocess (Ctrl+P)")}
                                disabled={!this.props.mod || this.props.multi}
                                onClick={() => this.props.onAction("reprocess")}>
                                <i className="material-icons">refresh</i>{" "}
                                <span>{t("Reprocess")}</span>
                            </Button>
                        )}
                        <Button
                            variant="danger"
                            size="sm"
                            title={t("Uninstall (Ctrl+U)")}
                            disabled={!this.props.mod}
                            onClick={() => this.props.onAction("uninstall")}>
                            <i className="material-icons">delete</i>{" "}
                            <span>{t("Uninstall")}</span>
                        </Button>
                    </div>
                    <div className="mod-details">
                        {this.props.mod ? (
                            <>
                                <span>
                                    <strong>{t("Priority:")}</strong>{" "}
                                    {this.props.mod.priority}
                                </span>
                                <span>
                                    <strong>{t("Changes:")}</strong>{" "}
                                    {this.state.changes
                                        .map(change => t(change))
                                        .join(", ")}
                                </span>
                                <span
                                    style={{
                                        whiteSpace: "nowrap",
                                        maxWidth: "100%",
                                        overflow: "hidden"
                                    }}>
                                    <strong>{t("Path:")}</strong> {this.props.mod.path}
                                </span>
                                {this.state.url && (
                                    <span>
                                        <strong>{t("URL:")}</strong>{" "}
                                        <a href={this.state.url} target="_blank">
                                            {this.state.url}
                                        </a>
                                    </span>
                                )}
                                <span>
                                    <strong>{t("Date:")}</strong> {this.props.mod.date}
                                </span>
                            </>
                        ) : (
                            t("No mod selected")
                        )}
                    </div>
                </div>
                {this.state.loading && (
                    <div className="load-backdrop">
                        <div className="loading">
                            <Spinner animation="border" variant="primary" />
                        </div>
                    </div>
                )}
            </>
        );
    }
}

export default ModInfo;
