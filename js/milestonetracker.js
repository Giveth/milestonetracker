import async from "async";
import _ from "lodash";
import rlp from "rlp";
import BigNumber from "bignumber.js";
import Vault from "vaultcontract";
import MultiSigWallet from "multisigwallet";
import { deploy, sendContractTx, asyncfunc } from "runethtx";
import { MilestoneTrackerAbi, MilestoneTrackerByteCode } from "../contracts/MilestoneTracker.sol.js";

export default class MilestoneTracker {

    constructor(web3, address) {
        this.web3 = web3;
        this.contract = this.web3.eth.contract(MilestoneTrackerAbi).at(address);
    }

    getState(_cb) {
        return asyncfunc((cb) => {
            const st = {};
            let nMilestones;
            async.series([
                (cb1) => {
                    this.contract.recipient((err, _recipient) => {
                        if (err) { cb1(err); return; }
                        st.recipient = _recipient;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.donor((err, _donor) => {
                        if (err) { cb1(err); return; }
                        st.donor = _donor;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.arbitrator((err, _arbitrator) => {
                        if (err) { cb1(err); return; }
                        st.arbitrator = _arbitrator;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.campaignCanceled((err, res) => {
                        if (err) { cb1(err); return; }
                        st.campaignCanceled = res;
                        cb1();
                    });
                },
                (cb1) => {
                    this.contract.numberOfMilestones((err, res) => {
                        if (err) { cb1(err); return; }
                        nMilestones = res.toNumber();
                        st.milestones = [];
                        cb1();
                    });
                },
                (cb1) => {
                    async.eachSeries(_.range(0, nMilestones), (idMilestone, cb2) => {
                        let milestone;
                        async.series([
                            (cb3) => {
                                this.contract.milestones(idMilestone, (err, res) => {
                                    if (err) { cb3(err); return; }
                                    const milestoneStatus = [
                                        "AcceptedAndInProgress",
                                        "Completed",
                                        "AuthorizedForPayment",
                                        "Canceled",
                                    ];
                                    milestone = {
                                        description: res[ 0 ],
                                        url: res[ 1 ],
                                        minCompletionDate: res[ 2 ].toNumber(),
                                        maxCompletionDate: res[ 3 ].toNumber(),
                                        milestoneLeadLink: res[ 4 ],
                                        reviewer: res[ 5 ],
                                        reviewTime: res[ 6 ].toNumber(),
                                        paymentSource: res[ 7 ],
                                        payData: res[ 8 ],
                                        status: milestoneStatus[ res[ 9 ].toNumber() ],
                                        doneTime: res[ 10 ].toNumber(),
                                    };
                                    Object.assign(milestone, decodePayData(milestone.payData));
                                    st.milestones.push(milestone);
                                    cb3();
                                });
                            },
                            (cb3) => {
                                if ((milestone.status !== "AuthorizedForPayment") ||
                                    (!milestone.payRecipient)) {
                                    cb3();
                                    return;
                                }
                                const vault = new Vault(this.web3, milestone.paymentSource);
                                vault.getState((err, vSt) => {
                                    if (err) {
                                        cb3(err);
                                        return;
                                    }

                                    milestone.paymentInfo = _.find(vSt.payments,
                                        ({ description }) =>
                                            (description === milestone.payDescription));

                                    cb3();
                                });
                            },
                            (cb3) => {
                                milestone.actions = {};

                                const now = Math.floor(new Date().getTime() / 1000);
                                if ((milestone.status !== "AcceptedAndInProgress") ||
                                    (now < milestone.minCompletionDate) ||
                                    (now > milestone.maxCompletionDate)) {
                                    cb3();
                                    return;
                                }

                                milestone.actions.markMilestoneComplete = [];
                                addActionOptions(
                                    this.web3,
                                    milestone.actions.markMilestoneComplete,
                                    [
                                        milestone.milestoneLeadLink,
                                        st.recipient,
                                    ],
                                    this.contract.address,
                                    0,
                                    this.contract.markMilestoneComplete.getData(idMilestone),
                                    cb3);
                            },
                            (cb3) => {
                                if (milestone.status !== "Completed") {
                                    cb3();
                                    return;
                                }

                                milestone.actions.approveCompletedMilestone = [];
                                addActionOptions(
                                    this.web3,
                                    milestone.actions.approveCompletedMilestone,
                                    [
                                        milestone.reviewer,
                                    ],
                                    this.contract.address,
                                    0,
                                    this.contract.approveCompletedMilestone.getData(idMilestone),
                                    cb3);
                            },
                            (cb3) => {
                                if (milestone.status !== "Completed") {
                                    cb3();
                                    return;
                                }

                                milestone.actions.rejectMilestone = [];
                                addActionOptions(
                                    this.web3,
                                    milestone.actions.rejectMilestone,
                                    [
                                        milestone.reviewer,
                                    ],
                                    this.contract.address,
                                    0,
                                    this.contract.rejectMilestone.getData(idMilestone),
                                    cb3);
                            },
                            (cb3) => {
                                const now = Math.floor(new Date().getTime() / 1000);
                                if ((milestone.status !== "Completed") ||
                                    (now < milestone.doneTime + milestone.reviewTime)) {
                                    cb3();
                                    return;
                                }

                                milestone.actions.requestMilestonePayment = [];
                                addActionOptions(
                                    this.web3,
                                    milestone.actions.requestMilestonePayment,
                                    [
                                        milestone.milestoneLeadLink,
                                        st.recipient,
                                    ],
                                    this.contract.address,
                                    0,
                                    this.contract.requestMilestonePayment.getData(idMilestone),
                                    cb3);
                            },
                            (cb3) => {
                                if ((milestone.status !== "AcceptedAndInProgress") &&
                                    (milestone.status !== "Completed")) {
                                    cb3();
                                    return;
                                }

                                milestone.actions.cancelMilestone = [];
                                addActionOptions(
                                    this.web3,
                                    milestone.actions.cancelMilestone,
                                    [
                                        st.recipient,
                                    ],
                                    this.contract.address,
                                    0,
                                    this.contract.cancelMilestone.getData(idMilestone),
                                    cb3);
                            },
                            (cb3) => {
                                if ((milestone.status !== "AcceptedAndInProgress") &&
                                    (milestone.status !== "Completed")) {
                                    cb3();
                                    return;
                                }

                                milestone.actions.arbitrateApproveMilestone = [];
                                addActionOptions(
                                    this.web3,
                                    milestone.actions.arbitrateApproveMilestone,
                                    [
                                        st.arbitrator,
                                    ],
                                    this.contract.address,
                                    0,
                                    this.contract.arbitrateApproveMilestone.getData(idMilestone),
                                    cb3);
                            },
                            (cb3) => {
                                const now = Math.floor(new Date().getTime() / 1000);
                                if ((milestone.status !== "AuthorizedForPayment") ||
                                    (milestone.paymentInfo.paid) ||
                                    (now < milestone.paymentInfo.earliestPayTime)) {
                                    cb3();
                                    return;
                                }

                                const vault = new Vault(this.web3, milestone.paymentSource);

                                milestone.actions.collectMilestone = [];
                                addActionOptions(
                                    this.web3,
                                    milestone.actions.collectMilestone,
                                    [
                                        milestone.payRecipient,
                                    ],
                                    milestone.paymentSource,
                                    0,
                                    vault.contract.collectAuthorizedPayment.getData(
                                        milestone.paymentInfo.idPayment),
                                    cb3);
                            },
                        ], cb2);
                    }, cb1);
                },
                (cb1) => {
                    this.contract.changingMilestones((err, res) => {
                        if (err) { cb1(err); return; }
                        st.changingMilestones = res;
                        cb1();
                    });
                },
                (cb1) => {
                    if (!st.changingMilestones) {
                        cb1();
                        return;
                    }
                    this.contract.proposedMilestones((err, res) => {
                        if (err) { cb1(err); return; }
                        st.proposedMilestonesData = res;
                        st.proposedMilestonesHash = this.web3.sha3(st.proposedMilestonesData, { encoding: "hex" });
                        if (st.proposedMilestonesHash.substr(0, 2) !== "0x") {
                            st.proposedMilestonesHash = "0x" + st.proposedMilestonesHash;
                        }
                        st.proposedMilestones = MilestoneTracker.bytes2milestones(res);
                        cb1();
                    });
                },
                (cb1) => {
                    st.actions = {};
                    if (st.changingMilestones) {
                        cb1();
                        return;
                    }

                    st.actions.proposeMilestones = [];
                    addActionOptions(
                        this.web3,
                        st.actions.proposeMilestones,
                        [
                            st.recipient,
                        ],
                        this.contract.address,
                        0,
                        this.contract.proposeMilestones.getData("0x10"),
                        cb1);
                },
                (cb1) => {
                    if (!st.changingMilestones) {
                        cb1();
                        return;
                    }

                    st.actions.unproposeMilestones = [];
                    addActionOptions(
                        this.web3,
                        st.actions.unproposeMilestones,
                        [
                            st.recipient,
                        ],
                        this.contract.address,
                        0,
                        this.contract.unproposeMilestones.getData(),
                        cb1);
                },
                (cb1) => {
                    if (!st.changingMilestones) {
                        cb1();
                        return;
                    }

                    st.actions.acceptProposedMilestones = [];
                    addActionOptions(
                        this.web3,
                        st.actions.acceptProposedMilestones,
                        [
                            st.donor,
                        ],
                        this.contract.address,
                        0,
                        this.contract.acceptProposedMilestones.getData(st.proposedMilestonesHash),
                        cb1);
                },
                (cb1) => {
                    st.actions.arbitrateCancelCampaign = [];
                    addActionOptions(
                        this.web3,
                        st.actions.arbitrateCancelCampaign,
                        [
                            st.arbitrator,
                        ],
                        this.contract.address,
                        0,
                        this.contract.arbitrateCancelCampaign.getData(),
                        cb1);
                },
            ], (err) => {
                if (err) { cb(err); return; }
                cb(null, st);
            });
        }, _cb);
    }

    static deploy(web3, opts, _cb) {
        return asyncfunc((cb) => {
            const params = Object.assign({}, opts);
            params.abi = MilestoneTrackerAbi;
            params.byteCode = MilestoneTrackerByteCode;
            return deploy(web3, params, (err, _milestoneTracker) => {
                if (err) {
                    cb(err);
                    return;
                }
                const milestoneTracker = new MilestoneTracker(web3, _milestoneTracker.address);
                cb(null, milestoneTracker);
            });
        }, _cb);
    }

    static bytes2milestones(b) {
        const d = rlp.decode(b);
        const milestones = _.map(d, (milestone) => {
            const m = {
                description: milestone[ 0 ].toString("utf8"),
                url: milestone[ 1 ].toString("utf8"),
                minCompletionDate: new BigNumber("0x" + milestone[ 2 ].toString("hex")).toNumber(),
                maxCompletionDate: new BigNumber("0x" + milestone[ 3 ].toString("hex")).toNumber(),
                milestoneLeadLink: "0x" + milestone[ 4 ].toString("hex"),
                reviewer: "0x" + milestone[ 5 ].toString("hex"),
                reviewTime: new BigNumber("0x" + milestone[ 6 ].toString("hex")).toNumber(),
                paymentSource: "0x" + milestone[ 7 ].toString("hex"),
                payData: "0x" + milestone[ 8 ].toString("hex"),
            };
            Object.assign(m, decodePayData(m.payData));
            return m;
        });
        return milestones;
    }

    milestones2bytes(milestones) {
        const self = this;
        function n2buff(a) {
            let S = new BigNumber(a).toString(16);
            if (S.length % 2 === 1) S = "0" + S;
            return new Buffer(S, "hex");
        }
        const d = _.map(milestones, (milestone) => {
            let data;
            if (milestone.payData) {
                data = milestone.payData;
            } else {
                const vault = new Vault(self.web3, milestone.paymentSource);
                data = vault.contract.authorizePayment.getData(
                            milestone.payDescription,
                            milestone.payRecipient,
                            milestone.payValue,
                            milestone.payDelay || 0,
                            { from: self.contract.address });
            }

            return [
                new Buffer(milestone.description),
                new Buffer(milestone.url),
                n2buff(milestone.minCompletionDate),
                n2buff(milestone.maxCompletionDate),
                milestone.milestoneLeadLink,
                milestone.reviewer,
                n2buff(milestone.reviewTime),
                milestone.paymentSource,
                data,
            ];
        });

        const b = rlp.encode(d);
        return "0x" + b.toString("hex");
    }

    proposeMilestones(opts, cb) {
        const self = this;
        const newOpts = Object.assign({}, opts);
        if (typeof newOpts.newMilestones === "object") {
            newOpts.newMilestones = self.milestones2bytes(newOpts.newMilestones);
        }
        return sendContractTx(
            this.web3,
            this.contract,
            "proposeMilestones",
            newOpts,
            cb);
    }

    unproposeMilestones(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "unproposeMilestones",
            Object.assign({}, opts, {
                extraGas: 500000,
            }),
            cb);
    }

    acceptProposedMilestones(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "acceptProposedMilestones",
            Object.assign({}, opts, {
                gas: 4000000,
            }),
            cb);
    }

    changeArbitrator(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "changeArbitrator",
            opts,
            cb);
    }

    changeDonor(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "changeDonor",
            opts,
            cb);
    }

    changeRecipient(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "changeRecipient",
            opts,
            cb);
    }

    markMilestoneComplete(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "markMilestoneComplete",
            opts,
            cb);
    }

    approveCompletedMilestone(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "approveCompletedMilestone",
            Object.assign({}, opts, {
                extraGas: 100000,
            }),
            cb);
    }

    rejectMilestone(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "rejectMilestone",
            Object.assign({}, opts, {
                extraGas: 25000,
            }),
            cb);
    }

    requestMilestonePayment(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "requestMilestonePayment",
            Object.assign({}, opts, {
                extraGas: 25000,
            }),
            cb);
    }

    cancelMilestone(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "cancelMilestone",
            Object.assign({}, opts, {
                extraGas: 25000,
            }),
            cb);
    }

    arbitrateApproveMilestone(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "arbitrateApproveMilestone",
            Object.assign({}, opts, {
                extraGas: 25000,
            }),
            cb);
    }

    arbitrateCancelCampaign(opts, cb) {
        return sendContractTx(
            this.web3,
            this.contract,
            "arbitrateCancelCampaign",
            Object.assign({}, opts, {
                extraGas: 25000,
            }),
            cb);
    }

    collectMilestone(opts, _cb) {
        return asyncfunc((cb) => {
            this.getState((err, st) => {
                if (err) {
                    cb(err);
                }
                const milestone = st.milestones[ opts.idMilestone ];
                if ((!milestone) || (!milestone.payRecipient)) {
                    cb(new Error("milestone not payable"));
                }

                const vault = new Vault(this.web3, milestone.paymentSource);

                vault.getState((err2, vSt) => {
                    if (err2) {
                        cb(err2);
                        return;
                    }

                    const idPayment = _.findIndex(vSt.payments,
                        ({ description }) => (description === milestone.payDescription));

                    if (typeof idPayment !== "number") {
                        cb(new Error("Payment not found"));
                    }

                    vault.collectAuthorizedPayment({
                        idPayment,
                        from: vSt.payments[ idPayment ].recipient,
                    }, (err3, txHash) => {
                        if (err3) {
                            cb(err3);
                        } else {
                            cb(null, txHash);
                        }
                    });
                });
            });
        }, _cb);
    }
}

function decodePayData(payData) {
    const res = {};
    const func = payData.substr(2, 8).toLowerCase();
    // Authorize Payment
    if (func === "8e637a33") {
        res.payDescription = extractString(payData, 0);
        res.payRecipient = extractAddress(payData, 1);
        res.payValue = new BigNumber(extractUInt(payData, 2));
        res.payDelay = extractUInt(payData, 3).toNumber();
    }
    return res;
}

function extractString(data, param) {
    const offset = new BigNumber(data.substr(10 + (param * 64), 64), 16).toNumber();
    const length = new BigNumber(data.substr(10 + (offset * 2), 64), 16).toNumber();
    const strHex = data.substr(10 + (offset * 2) + 64, length * 2);
    const str = new Buffer(strHex, "hex").toString();
    return str;
}

function extractUInt(data, param) {
    const numHex = data.substr(10 + (param * 64), 64);
    return new BigNumber(numHex, 16);
}

function extractAddress(data, param) {
    const num = extractUInt(data, param);
    let numHex = num.toString(16);
    numHex = pad(numHex, 40, "0");
    return "0x" + numHex;
}

function pad(_n, width, _z) {
    const z = _z || "0";
    const n = _n.toString();
    return n.length >= width ? n : new Array((width - n.length) + 1).join(z) + n;
}

const multisigCodeHash = "0x11111";

function addActionOptions(web3, actionOptions, _authorizedUsers, dest, value, data, cb) {
    let accounts;
    const authorizedUsers = normalizeAccountList(web3, _authorizedUsers);
    async.series([
        (cb1) => {
            web3.eth.getAccounts((err, _accounts) => {
                if (err) {
                    cb1(err);
                    return;
                }
                accounts = _accounts;
                cb1();
            });
        },
        (cb1) => {
            const possibleAccounts = _.intersection(accounts, authorizedUsers);
            _.each(possibleAccounts, (account) => {
                actionOptions.push({
                    account,
                    type: "ACCOUNT",
                });
            });
            async.each(authorizedUsers, (account, cb2) => {
                web3.eth.getCode(account, (err, res) => {
                    if (err) {
                        cb2(err);
                        return;
                    }
                    const hash = web3.sha3(res, { encoding: "hex" });
                    if (res.length > 3) {
                        const multiSigWallet = new MultiSigWallet(web3, account);
                        multiSigWallet.addActionOptions(actionOptions, dest, value, data, cb2);
                    } else {
                        cb2();
                    }
                });
            }, cb1);
        },
    ], cb);
}

function normalizeAccountList(web3, accounts) {
    const validAccounts = {};
    _.each(accounts, (account) => {
        if (web3.isAddress(account)) {
            validAccounts[ account ] = true;
        }
    });
    return _.keys(validAccounts);
}
