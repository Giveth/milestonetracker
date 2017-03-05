"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _async = require("async");

var _async2 = _interopRequireDefault(_async);

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

var _rlp = require("rlp");

var _rlp2 = _interopRequireDefault(_rlp);

var _bignumber = require("bignumber.js");

var _bignumber2 = _interopRequireDefault(_bignumber);

var _vaultcontract = require("vaultcontract");

var _vaultcontract2 = _interopRequireDefault(_vaultcontract);

var _multisigwallet = require("multisigwallet");

var _multisigwallet2 = _interopRequireDefault(_multisigwallet);

var _runethtx = require("runethtx");

var _MilestoneTrackerSol = require("../contracts/MilestoneTracker.sol.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MilestoneTracker = function () {
    function MilestoneTracker(web3, address) {
        _classCallCheck(this, MilestoneTracker);

        this.web3 = web3;
        this.contract = this.web3.eth.contract(_MilestoneTrackerSol.MilestoneTrackerAbi).at(address);
    }

    _createClass(MilestoneTracker, [{
        key: "getState",
        value: function getState(_cb) {
            var _this = this;

            return (0, _runethtx.asyncfunc)(function (cb) {
                var st = {};
                var nMilestones = void 0;
                _async2.default.series([function (cb1) {
                    _this.contract.recipient(function (err, _recipient) {
                        if (err) {
                            cb1(err);return;
                        }
                        st.recipient = _recipient;
                        cb1();
                    });
                }, function (cb1) {
                    _this.contract.donor(function (err, _donor) {
                        if (err) {
                            cb1(err);return;
                        }
                        st.donor = _donor;
                        cb1();
                    });
                }, function (cb1) {
                    _this.contract.arbitrator(function (err, _arbitrator) {
                        if (err) {
                            cb1(err);return;
                        }
                        st.arbitrator = _arbitrator;
                        cb1();
                    });
                }, function (cb1) {
                    _this.contract.campaignCanceled(function (err, res) {
                        if (err) {
                            cb1(err);return;
                        }
                        st.campaignCanceled = res;
                        cb1();
                    });
                }, function (cb1) {
                    _this.contract.numberOfMilestones(function (err, res) {
                        if (err) {
                            cb1(err);return;
                        }
                        nMilestones = res.toNumber();
                        st.milestones = [];
                        cb1();
                    });
                }, function (cb1) {
                    _async2.default.eachSeries(_lodash2.default.range(0, nMilestones), function (idMilestone, cb2) {
                        var milestone = void 0;
                        _async2.default.series([function (cb3) {
                            _this.contract.milestones(idMilestone, function (err, res) {
                                if (err) {
                                    cb3(err);return;
                                }
                                var milestoneStatus = ["AcceptedAndInProgress", "Completed", "AuthorizedForPayment", "Canceled"];
                                milestone = {
                                    description: res[0],
                                    url: res[1],
                                    minCompletionDate: res[2].toNumber(),
                                    maxCompletionDate: res[3].toNumber(),
                                    milestoneLeadLink: res[4],
                                    reviewer: res[5],
                                    reviewTime: res[6].toNumber(),
                                    paymentSource: res[7],
                                    payData: res[8],
                                    status: milestoneStatus[res[9].toNumber()],
                                    doneTime: res[10].toNumber()
                                };
                                Object.assign(milestone, decodePayData(milestone.payData));
                                st.milestones.push(milestone);
                                cb3();
                            });
                        }, function (cb3) {
                            if (milestone.status !== "AuthorizedForPayment" || !milestone.payRecipient) {
                                cb3();
                                return;
                            }
                            var vault = new _vaultcontract2.default(_this.web3, milestone.paymentSource);
                            vault.getState(function (err, vSt) {
                                if (err) {
                                    cb3(err);
                                    return;
                                }

                                milestone.paymentInfo = _lodash2.default.find(vSt.payments, function (_ref) {
                                    var description = _ref.description;
                                    return description === milestone.payDescription;
                                });

                                cb3();
                            });
                        }, function (cb3) {
                            milestone.actions = {};

                            var now = Math.floor(new Date().getTime() / 1000);
                            if (milestone.status !== "AcceptedAndInProgress" || now < milestone.minCompletionDate || now > milestone.maxCompletionDate) {
                                cb3();
                                return;
                            }

                            milestone.actions.markMilestoneComplete = [];
                            addActionOptions(_this.web3, milestone.actions.markMilestoneComplete, [milestone.milestoneLeadLink, st.recipient], _this.contract.address, 0, _this.contract.markMilestoneComplete.getData(idMilestone), cb3);
                        }, function (cb3) {
                            if (milestone.status !== "Completed") {
                                cb3();
                                return;
                            }

                            milestone.actions.approveCompletedMilestone = [];
                            addActionOptions(_this.web3, milestone.actions.approveCompletedMilestone, [milestone.reviewer], _this.contract.address, 0, _this.contract.approveCompletedMilestone.getData(idMilestone), cb3);
                        }, function (cb3) {
                            if (milestone.status !== "Completed") {
                                cb3();
                                return;
                            }

                            milestone.actions.rejectMilestone = [];
                            addActionOptions(_this.web3, milestone.actions.rejectMilestone, [milestone.reviewer], _this.contract.address, 0, _this.contract.rejectMilestone.getData(idMilestone), cb3);
                        }, function (cb3) {
                            var now = Math.floor(new Date().getTime() / 1000);
                            if (milestone.status !== "Completed" || now < milestone.doneTime + milestone.reviewTime) {
                                cb3();
                                return;
                            }

                            milestone.actions.requestMilestonePayment = [];
                            addActionOptions(_this.web3, milestone.actions.requestMilestonePayment, [milestone.milestoneLeadLink, st.recipient], _this.contract.address, 0, _this.contract.requestMilestonePayment.getData(idMilestone), cb3);
                        }, function (cb3) {
                            if (milestone.status !== "AcceptedAndInProgress" && milestone.status !== "Completed") {
                                cb3();
                                return;
                            }

                            milestone.actions.cancelMilestone = [];
                            addActionOptions(_this.web3, milestone.actions.cancelMilestone, [st.recipient], _this.contract.address, 0, _this.contract.cancelMilestone.getData(idMilestone), cb3);
                        }, function (cb3) {
                            if (milestone.status !== "AcceptedAndInProgress" && milestone.status !== "Completed") {
                                cb3();
                                return;
                            }

                            milestone.actions.arbitrateApproveMilestone = [];
                            addActionOptions(_this.web3, milestone.actions.arbitrateApproveMilestone, [st.arbitrator], _this.contract.address, 0, _this.contract.arbitrateApproveMilestone.getData(idMilestone), cb3);
                        }, function (cb3) {
                            var now = Math.floor(new Date().getTime() / 1000);
                            if (milestone.status !== "AuthorizedForPayment" || milestone.paymentInfo.paid || now < milestone.paymentInfo.earliestPayTime) {
                                cb3();
                                return;
                            }

                            var vault = new _vaultcontract2.default(_this.web3, milestone.paymentSource);

                            milestone.actions.collectMilestone = [];
                            addActionOptions(_this.web3, milestone.actions.collectMilestone, [milestone.payRecipient], milestone.paymentSource, 0, vault.contract.collectAuthorizedPayment.getData(milestone.paymentInfo.idPayment), cb3);
                        }], cb2);
                    }, cb1);
                }, function (cb1) {
                    _this.contract.changingMilestones(function (err, res) {
                        if (err) {
                            cb1(err);return;
                        }
                        st.changingMilestones = res;
                        cb1();
                    });
                }, function (cb1) {
                    if (!st.changingMilestones) {
                        cb1();
                        return;
                    }
                    _this.contract.proposedMilestones(function (err, res) {
                        if (err) {
                            cb1(err);return;
                        }
                        st.proposedMilestonesData = res;
                        st.proposedMilestonesHash = _this.web3.sha3(st.proposedMilestonesData, { encoding: "hex" });
                        if (st.proposedMilestonesHash.substr(0, 2) !== "0x") {
                            st.proposedMilestonesHash = "0x" + st.proposedMilestonesHash;
                        }
                        st.proposedMilestones = MilestoneTracker.bytes2milestones(res);
                        cb1();
                    });
                }, function (cb1) {
                    st.actions = {};
                    if (st.changingMilestones) {
                        cb1();
                        return;
                    }

                    st.actions.proposeMilestones = [];
                    addActionOptions(_this.web3, st.actions.proposeMilestones, [st.recipient], _this.contract.address, 0, _this.contract.proposeMilestones.getData("0x10"), cb1);
                }, function (cb1) {
                    if (!st.changingMilestones) {
                        cb1();
                        return;
                    }

                    st.actions.unproposeMilestones = [];
                    addActionOptions(_this.web3, st.actions.unproposeMilestones, [st.recipient], _this.contract.address, 0, _this.contract.unproposeMilestones.getData(), cb1);
                }, function (cb1) {
                    if (!st.changingMilestones) {
                        cb1();
                        return;
                    }

                    st.actions.acceptProposedMilestones = [];
                    addActionOptions(_this.web3, st.actions.acceptProposedMilestones, [st.donor], _this.contract.address, 0, _this.contract.acceptProposedMilestones.getData(st.proposedMilestonesHash), cb1);
                }, function (cb1) {
                    st.actions.arbitrateCancelCampaign = [];
                    addActionOptions(_this.web3, st.actions.arbitrateCancelCampaign, [st.arbitrator], _this.contract.address, 0, _this.contract.arbitrateCancelCampaign.getData(), cb1);
                }], function (err) {
                    if (err) {
                        cb(err);return;
                    }
                    cb(null, st);
                });
            }, _cb);
        }
    }, {
        key: "milestones2bytes",
        value: function milestones2bytes(milestones) {
            var self = this;
            function n2buff(a) {
                var S = new _bignumber2.default(a).toString(16);
                if (S.length % 2 === 1) S = "0" + S;
                return new Buffer(S, "hex");
            }
            var d = _lodash2.default.map(milestones, function (milestone) {
                var data = void 0;
                if (milestone.payData) {
                    data = milestone.payData;
                } else {
                    var vault = new _vaultcontract2.default(self.web3, milestone.paymentSource);
                    data = vault.contract.authorizePayment.getData(milestone.payDescription, milestone.payRecipient, milestone.payValue, milestone.payDelay || 0, { from: self.contract.address });
                }

                return [new Buffer(milestone.description), new Buffer(milestone.url), n2buff(milestone.minCompletionDate), n2buff(milestone.maxCompletionDate), milestone.milestoneLeadLink, milestone.reviewer, n2buff(milestone.reviewTime), milestone.paymentSource, data];
            });

            var b = _rlp2.default.encode(d);
            return "0x" + b.toString("hex");
        }
    }, {
        key: "proposeMilestones",
        value: function proposeMilestones(opts, cb) {
            var self = this;
            var newOpts = Object.assign({}, opts);
            if (_typeof(newOpts.newMilestones) === "object") {
                newOpts.newMilestones = self.milestones2bytes(newOpts.newMilestones);
            }
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "proposeMilestones", newOpts, cb);
        }
    }, {
        key: "unproposeMilestones",
        value: function unproposeMilestones(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "unproposeMilestones", Object.assign({}, opts, {
                extraGas: 500000
            }), cb);
        }
    }, {
        key: "acceptProposedMilestones",
        value: function acceptProposedMilestones(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "acceptProposedMilestones", Object.assign({}, opts, {
                gas: 4000000
            }), cb);
        }
    }, {
        key: "changeArbitrator",
        value: function changeArbitrator(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "changeArbitrator", opts, cb);
        }
    }, {
        key: "changeDonor",
        value: function changeDonor(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "changeDonor", opts, cb);
        }
    }, {
        key: "changeRecipient",
        value: function changeRecipient(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "changeRecipient", opts, cb);
        }
    }, {
        key: "markMilestoneComplete",
        value: function markMilestoneComplete(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "markMilestoneComplete", opts, cb);
        }
    }, {
        key: "approveCompletedMilestone",
        value: function approveCompletedMilestone(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "approveCompletedMilestone", Object.assign({}, opts, {
                extraGas: 100000
            }), cb);
        }
    }, {
        key: "rejectMilestone",
        value: function rejectMilestone(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "rejectMilestone", Object.assign({}, opts, {
                extraGas: 25000
            }), cb);
        }
    }, {
        key: "requestMilestonePayment",
        value: function requestMilestonePayment(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "requestMilestonePayment", Object.assign({}, opts, {
                extraGas: 25000
            }), cb);
        }
    }, {
        key: "cancelMilestone",
        value: function cancelMilestone(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "cancelMilestone", Object.assign({}, opts, {
                extraGas: 25000
            }), cb);
        }
    }, {
        key: "arbitrateApproveMilestone",
        value: function arbitrateApproveMilestone(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "arbitrateApproveMilestone", Object.assign({}, opts, {
                extraGas: 25000
            }), cb);
        }
    }, {
        key: "arbitrateCancelCampaign",
        value: function arbitrateCancelCampaign(opts, cb) {
            return (0, _runethtx.sendContractTx)(this.web3, this.contract, "arbitrateCancelCampaign", Object.assign({}, opts, {
                extraGas: 25000
            }), cb);
        }
    }, {
        key: "collectMilestone",
        value: function collectMilestone(opts, _cb) {
            var _this2 = this;

            return (0, _runethtx.asyncfunc)(function (cb) {
                _this2.getState(function (err, st) {
                    if (err) {
                        cb(err);
                    }
                    var milestone = st.milestones[opts.idMilestone];
                    if (!milestone || !milestone.payRecipient) {
                        cb(new Error("milestone not payable"));
                    }

                    var vault = new _vaultcontract2.default(_this2.web3, milestone.paymentSource);

                    vault.getState(function (err2, vSt) {
                        if (err2) {
                            cb(err2);
                            return;
                        }

                        var idPayment = _lodash2.default.findIndex(vSt.payments, function (_ref2) {
                            var description = _ref2.description;
                            return description === milestone.payDescription;
                        });

                        if (typeof idPayment !== "number") {
                            cb(new Error("Payment not found"));
                        }

                        vault.collectAuthorizedPayment({
                            idPayment: idPayment,
                            from: vSt.payments[idPayment].recipient
                        }, function (err3, txHash) {
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
    }], [{
        key: "deploy",
        value: function deploy(web3, opts, _cb) {
            return (0, _runethtx.asyncfunc)(function (cb) {
                var params = Object.assign({}, opts);
                params.abi = _MilestoneTrackerSol.MilestoneTrackerAbi;
                params.byteCode = _MilestoneTrackerSol.MilestoneTrackerByteCode;
                return (0, _runethtx.deploy)(web3, params, function (err, _milestoneTracker) {
                    if (err) {
                        cb(err);
                        return;
                    }
                    var milestoneTracker = new MilestoneTracker(web3, _milestoneTracker.address);
                    cb(null, milestoneTracker);
                });
            }, _cb);
        }
    }, {
        key: "bytes2milestones",
        value: function bytes2milestones(b) {
            var d = _rlp2.default.decode(b);
            var milestones = _lodash2.default.map(d, function (milestone) {
                var m = {
                    description: milestone[0].toString("utf8"),
                    url: milestone[1].toString("utf8"),
                    minCompletionDate: new _bignumber2.default("0x" + milestone[2].toString("hex")).toNumber(),
                    maxCompletionDate: new _bignumber2.default("0x" + milestone[3].toString("hex")).toNumber(),
                    milestoneLeadLink: "0x" + milestone[4].toString("hex"),
                    reviewer: "0x" + milestone[5].toString("hex"),
                    reviewTime: new _bignumber2.default("0x" + milestone[6].toString("hex")).toNumber(),
                    paymentSource: "0x" + milestone[7].toString("hex"),
                    payData: "0x" + milestone[8].toString("hex")
                };
                Object.assign(m, decodePayData(m.payData));
                return m;
            });
            return milestones;
        }
    }]);

    return MilestoneTracker;
}();

exports.default = MilestoneTracker;


function decodePayData(payData) {
    var res = {};
    var func = payData.substr(2, 8).toLowerCase();
    // Authorize Payment
    if (func === "8e637a33") {
        res.payDescription = extractString(payData, 0);
        res.payRecipient = extractAddress(payData, 1);
        res.payValue = new _bignumber2.default(extractUInt(payData, 2));
        res.payDelay = extractUInt(payData, 3).toNumber();
    }
    return res;
}

function extractString(data, param) {
    var offset = new _bignumber2.default(data.substr(10 + param * 64, 64), 16).toNumber();
    var length = new _bignumber2.default(data.substr(10 + offset * 2, 64), 16).toNumber();
    var strHex = data.substr(10 + offset * 2 + 64, length * 2);
    var str = new Buffer(strHex, "hex").toString();
    return str;
}

function extractUInt(data, param) {
    var numHex = data.substr(10 + param * 64, 64);
    return new _bignumber2.default(numHex, 16);
}

function extractAddress(data, param) {
    var num = extractUInt(data, param);
    var numHex = num.toString(16);
    numHex = pad(numHex, 40, "0");
    return "0x" + numHex;
}

function pad(_n, width, _z) {
    var z = _z || "0";
    var n = _n.toString();
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

var multisigCodeHash = "0x11111";

function addActionOptions(web3, actionOptions, _authorizedUsers, dest, value, data, cb) {
    var accounts = void 0;
    var authorizedUsers = normalizeAccountList(web3, _authorizedUsers);
    _async2.default.series([function (cb1) {
        web3.eth.getAccounts(function (err, _accounts) {
            if (err) {
                cb1(err);
                return;
            }
            accounts = _accounts;
            cb1();
        });
    }, function (cb1) {
        var possibleAccounts = _lodash2.default.intersection(accounts, authorizedUsers);
        _lodash2.default.each(possibleAccounts, function (account) {
            actionOptions.push({
                account: account,
                type: "ACCOUNT"
            });
        });
        _async2.default.each(authorizedUsers, function (account, cb2) {
            web3.eth.getCode(account, function (err, res) {
                if (err) {
                    cb2(err);
                    return;
                }
                var hash = web3.sha3(res, { encoding: "hex" });
                if (res.length > 3) {
                    var multiSigWallet = new _multisigwallet2.default(web3, account);
                    multiSigWallet.addActionOptions(actionOptions, dest, value, data, cb2);
                } else {
                    cb2();
                }
            });
        }, cb1);
    }], cb);
}

function normalizeAccountList(web3, accounts) {
    var validAccounts = {};
    _lodash2.default.each(accounts, function (account) {
        if (web3.isAddress(account)) {
            validAccounts[account] = true;
        }
    });
    return _lodash2.default.keys(validAccounts);
}
module.exports = exports["default"];
