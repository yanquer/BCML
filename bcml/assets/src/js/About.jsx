import { t } from "./i18n";
import { Badge, Button, Modal } from "react-bootstrap";

import DonateWidget from "./Donate.jsx";
import React from "react";

const AboutDialog = props => {
    return (
        <Modal show={props.show} onHide={props.onClose}>
            <Modal.Header>
                <Modal.Title className="d-flex w-100">
                    <div>{t("About BCML")}</div>
                    <div className="flex-grow-1"></div>
                    <div>
                        <small>
                            <Badge variant="secondary">{props.version}</Badge>
                        </small>
                    </div>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    {t(
                        "BCML (Breath of the Wild Cross-platform Mod Loader) is a tool for merging and loading mods for"
                    )}{" "}
                    <em>{t("The Legend of Zelda: Breath of the Wild")}</em>
                    {t(". It is written in Python and ReactJS.")}
                </p>
                <p>
                    {t(
                        "This software is licensed under the terms of the GNU General Public License, version 3 or later. The source code is available for free at"
                    )}{" "}
                    <a href="https://github.com/NiceneNerd/BCML/">
                        https://github.com/NiceneNerd/BCML/
                    </a>
                    .
                </p>
                <p>
                    {t(
                        "This software includes the 7-Zip console application 7z.exe and the library 7z.dll, which are licensed under the GNU Lesser General Public License. The source code for this application is available for free at"
                    )}{" "}
                    <a target="_blank" href="https://www.7-zip.org/download.html">
                        https://www.7-zip.org/download.html
                    </a>
                    .
                </p>
                <p>
                    {t(
                        "Special thanks to contributors Ginger Avanlanche, CEObrainz, & Kreny."
                    )}
                </p>
                <h4>{t("Donate")}</h4>
                <DonateWidget />
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={props.onClose} variant="secondary">
                    {t("Close")}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default AboutDialog;
