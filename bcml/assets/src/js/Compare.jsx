import { t } from "./i18n";
import React from "react";
import { Button, Modal, Row, Col, Form, Accordion, Card } from "react-bootstrap";

class CompareView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            mod1: null,
            mod2: null,
            diff1: null,
            diff2: null,
            mods: []
        };
        this.setMod = this.setMod.bind(this);
        this.loadMods = this.loadMods.bind(this);
    }

    async loadMods() {
        const res = await pywebview.api.get_mods({ disabled: true });
        this.setState({
            mods: res.data
        });
    }

    componentDidUpdate(prevProps) {
        if (this.props.show != prevProps.show) {
            this.loadMods();
        }
    }

    async setMod(number, mod) {
        let diff = await pywebview.api.get_mod_edits({ mod: JSON.parse(mod) });
        this.setState(
            {
                [`mod${number}`]: mod,
                [`diff${number}`]: diff
            },
            () => console.log(this.state)
        );
    }

    render() {
        return (
            <Modal
                show={this.props.show}
                scrollable={true}
                dialogClassName="modal-wide"
                onHide={this.props.onHide}>
                <Modal.Header closeButton closeLabel={t("Close")}>
                    <Modal.Title>{t("Compare Mods")}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col xs={6}>
                            <Form.Group controlId="mod1">
                                <Form.Label>{t("Select Mod")}</Form.Label>
                                <Form.Control
                                    as="select"
                                    onChange={e =>
                                        this.setMod(1, e.currentTarget.value)
                                    }>
                                    <option value={null}></option>
                                    {this.state.mods.length > 0 &&
                                        this.state.mods.map(mod => (
                                            <option
                                                key={mod.name}
                                                value={JSON.stringify(mod)}>
                                                {mod.name}
                                            </option>
                                        ))}
                                </Form.Control>
                            </Form.Group>
                            {this.state.mod1 && (
                                <>
                                    <h5>{t("Mod Edits")}</h5>
                                    <DiffView diff={this.state.diff1} />
                                </>
                            )}
                        </Col>
                        <Col xs={6}>
                            <Form.Group controlId="mod2">
                                <Form.Label>{t("Select Mod")}</Form.Label>
                                <Form.Control
                                    as="select"
                                    onChange={e =>
                                        this.setMod(2, e.currentTarget.value)
                                    }>
                                    <option value={null}></option>
                                    {this.state.mods.length > 0 &&
                                        this.state.mods.map(mod => (
                                            <option
                                                key={mod.name}
                                                value={JSON.stringify(mod)}>
                                                {mod.name}
                                            </option>
                                        ))}
                                </Form.Control>
                            </Form.Group>
                            {this.state.mod2 && (
                                <>
                                    <h5>{t("Mod Edits")}</h5>
                                    <DiffView diff={this.state.diff2} />
                                </>
                            )}
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={this.props.onHide}>
                        {t("Close")}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

class DiffView extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <>
                {Object.keys(this.props.diff).map((merger, i) => (
                    <Accordion key={t(merger)}>
                        <Card>
                            <Accordion.Toggle
                                as={Card.Header}
                                eventKey={i}
                                className={
                                    this.props.diff[merger].length == 0 &&
                                    "text-secondary"
                                }>
                                {t(merger)}
                            </Accordion.Toggle>
                            <Accordion.Collapse eventKey={i}>
                                <Card.Body>
                                    {this.props.diff[merger].length > 0 ? (
                                        this.props.diff[merger].map(item => (
                                            <div key={item}>{item}</div>
                                        ))
                                    ) : (
                                        <div className="text-secondary">
                                            {t("No edits")}
                                        </div>
                                    )}
                                </Card.Body>
                            </Accordion.Collapse>
                        </Card>
                    </Accordion>
                ))}
            </>
        );
    }
}

export default CompareView;
