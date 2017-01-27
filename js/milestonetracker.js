import async from "async";
import _ from "lodash";
import rlp from "rlp";
import BigNumber from "bignumber.js";
import Vault from "vaultcontract";
import { MilestoneTrackerAbi, MilestoneTrackerByteCode } from "../contracts/MilestoneTracker.sol.js";

export default class MilestoneTracker {

    constructor(web3, address) {
        this.web3 = web3;
        this.contract = this.web3.eth.contract(MilestoneTrackerAbi).at(address);
    }

    getState(cb) {
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
                    this.contract.milestones(idMilestone, (err, res) => {
                        if (err) { cb2(err); return; }
                        const milestoneStatus = [
                            "AcceptedAndInProgress",
                            "Completed",
                            "AuthorizedForPayment",
                            "Canceled",
                        ];
                        const m = {
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
                        Object.assign(m, decodePayData(m.payData));
                        st.milestones.push(m);
                        cb2();
                    });
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
                    st.proposedMilestones = MilestoneTracker.bytes2milestones(res);
                    cb1();
                });
            },
        ], (err) => {
            if (err) { cb(err); return; }
            cb(null, st);
        });
    }

    static deploy(web3, opts, cb) {
        let account;
        let milestoneTracker;
        const contract = web3.eth.contract(MilestoneTrackerAbi);
        async.series([
            (cb1) => {
                if (opts.from) {
                    account = opts.from;
                    cb1();
                } else {
                    web3.eth.getAccounts((err, _accounts) => {
                        if (err) { cb1(err); return; }
                        if (_accounts.length === 0) {
                            cb1(new Error("No account to deploy a contract"));
                            return;
                        }
                        account = _accounts[ 0 ];
                        cb1();
                    });
                }
            },
            (cb1) => {
                contract.new(
                    opts.arbitrator,
                    opts.donor,
                    opts.recipient,
                    {
                        from: account,
                        data: MilestoneTrackerByteCode,
                        gas: 3000000,
                        value: opts.value || 0,
                    },
                    (err, _contract) => {
                        if (err) { cb1(err); return; }
                        if (typeof _contract.address !== "undefined") {
                            milestoneTracker = new MilestoneTracker(web3, _contract.address);
                            cb1();
                        }
                    });
            },
        ], (err) => {
            if (err) {
                cb(err);
                return;
            }
            cb(null, milestoneTracker);
        });
    }

    static bytes2milestones(b) {
        const d = rlp.decode(b);
        const milestones = _.map(d, (milestone) => {
            const m = {
                description: milestone[ 0 ].toString("utf8"),
                url: milestone[ 1 ].toString("utf8"),
                minCompletionDate: new BigNumber("0x" + milestone[ 2 ].toString("hex")),
                maxCompletionDate: new BigNumber("0x" + milestone[ 3 ].toString("hex")),
                milestoneLeadLink: "0x" + milestone[ 4 ].toString("hex"),
                reviewer: "0x" + milestone[ 5 ].toString("hex"),
                reviewTime: new BigNumber("0x" + milestone[ 6 ].toString("hex")),
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
                data = vault.contract.authorizedPayments.getData(
                            milestone.payRecipient,
                            milestone.payDescription,
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

        newOpts.contract = this.contract;
        newOpts.method = "proposeMilestones";

        if (typeof newOpts.newMilestones === "object") {
            newOpts.newMilestones = self.milestones2bytes(newOpts.newMilestones);
        }
        return runEthTx(newOpts, cb);
    }

    acceptMilestones(opts, cb) {
        return runEthTx(
            Object.assign({}, opts, {
                contract: this.contract,
                method: "acceptMilestones",
            }),
            cb);
    }
}

function decodePayData(payData) {
    const res = {};
    const func = payData.substr(2, 8).toLowerCase();
    // Authorize Payment
    if (func === "8e637a33") {
        res.payDescription = extractString(payData, 0);
        res.payRecipient = extractAddress(payData, 1);
        res.payValue = extractUInt(payData, 2).div(1e18).toNumber();
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

function runEthTx({ contract, method, ...opts }, cb) {
    const promise = new Promise((resolve, reject) => {
        if (!contract) {
            reject(new Error("Contract not defined"));
            return;
        }

        if (!method) {
            // TODO send raw transaction to the contract.
            reject(new Error("Method not defined"));
            return;
        }

        const methodAbi = contract.abi.find(({ name }) => name === method);

        if (!methodAbi) {
            reject(new Error("Invalid method"));
            return;
        }

        const paramNames = methodAbi.inputs.map(({ name }) => {
            if (name[ 0 ] === "_") {
                return name.substring(1);
            }
            return name;
        });

        let fromAccount;
        let gas;
        let txHash;

        async.series([
            (cb1) => {
                if (opts.from) {
                    fromAccount = opts.from;
                    setImmediate(cb1);
                } else {
                    // eslint-disable-next-line no-underscore-dangle
                    contract._eth.getAccounts((err, _accounts) => {
                        if (err) { cb1(err); return; }
                        if (_accounts.length === 0) {
                            cb1(new Error("No account to deploy a contract"));
                            return;
                        }
                        fromAccount = _accounts[ 0 ];
                        cb1();
                    });
                }
            },
            (cb1) => {
                const params = paramNames.map(name => opts[ name ]);
                params.push({
                    from: fromAccount,
                    gas: 4000000,
                });
                params.push((err, _gas) => {
                    if (err) {
                        cb1(err);
                    } else if (_gas >= 4000000) {
                        cb1(new Error("throw"));
                    } else {
                        gas = _gas;
                        gas += opts.extraGas ? opts.extraGas : 10000;
                        cb1();
                    }
                });

                contract[ method ].estimateGas.apply(null, params);
            },
            (cb1) => {
                const params = paramNames.map(name => opts[ name ]);
                params.push({
                    from: fromAccount,
                    gas,
                });
                params.push((err, _txHash) => {
                    if (err) {
                        cb1(err);
                    } else {
                        txHash = _txHash;
                        cb1();
                    }
                });

                contract[ method ].apply(null, params);
            },
        ], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(txHash);
            }
        });
    });

    if (cb) {
        promise.then(
            (value) => {
                cb(null, value);
            },
            (reason) => {
                cb(null, reason);
            });
    } else {
        return promise;
    }
}

