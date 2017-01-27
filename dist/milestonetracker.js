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

var _MilestoneTrackerSol = require("../contracts/MilestoneTracker.sol.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MilestoneTracker = function () {
    function MilestoneTracker(web3, address) {
        _classCallCheck(this, MilestoneTracker);

        this.web3 = web3;
        this.contract = this.web3.eth.contract(_MilestoneTrackerSol.MilestoneTrackerAbi).at(address);
    }

    _createClass(MilestoneTracker, [{
        key: "getState",
        value: function getState(cb) {
            var _this = this;

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
                    _this.contract.milestones(idMilestone, function (err, res) {
                        if (err) {
                            cb2(err);return;
                        }
                        var milestoneStatus = ["AcceptedAndInProgress", "Completed", "AuthorizedForPayment", "Canceled"];
                        var m = {
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
                        Object.assign(m, decodePayData(m.payData));
                        st.milestones.push(m);
                        cb2();
                    });
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
                    st.proposedMilestones = MilestoneTracker.bytes2milestones(res);
                    cb1();
                });
            }], function (err) {
                if (err) {
                    cb(err);return;
                }
                cb(null, st);
            });
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
                    data = vault.contract.authorizedPayments.getData(milestone.payRecipient, milestone.payDescription, milestone.payValue, milestone.payDelay || 0, { from: self.contract.address });
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

            newOpts.contract = this.contract;
            newOpts.method = "proposeMilestones";

            if (_typeof(newOpts.newMilestones) === "object") {
                newOpts.newMilestones = self.milestones2bytes(newOpts.newMilestones);
            }
            return runEthTx(newOpts, cb);
        }
    }, {
        key: "unproposeMilestones",
        value: function unproposeMilestones(opts, cb) {
            return runEthTx(Object.assign({}, opts, {
                contract: this.contract,
                method: "unproposeMilestones"
            }), cb);
        }
    }, {
        key: "acceptMilestones",
        value: function acceptMilestones(opts, cb) {
            return runEthTx(Object.assign({}, opts, {
                contract: this.contract,
                method: "acceptMilestones"
            }), cb);
        }
    }], [{
        key: "deploy",
        value: function deploy(web3, opts, cb) {
            var account = void 0;
            var milestoneTracker = void 0;
            var contract = web3.eth.contract(_MilestoneTrackerSol.MilestoneTrackerAbi);
            _async2.default.series([function (cb1) {
                if (opts.from) {
                    account = opts.from;
                    cb1();
                } else {
                    web3.eth.getAccounts(function (err, _accounts) {
                        if (err) {
                            cb1(err);return;
                        }
                        if (_accounts.length === 0) {
                            cb1(new Error("No account to deploy a contract"));
                            return;
                        }
                        account = _accounts[0];
                        cb1();
                    });
                }
            }, function (cb1) {
                contract.new(opts.arbitrator, opts.donor, opts.recipient, {
                    from: account,
                    data: _MilestoneTrackerSol.MilestoneTrackerByteCode,
                    gas: 3000000,
                    value: opts.value || 0
                }, function (err, _contract) {
                    if (err) {
                        cb1(err);return;
                    }
                    if (typeof _contract.address !== "undefined") {
                        milestoneTracker = new MilestoneTracker(web3, _contract.address);
                        cb1();
                    }
                });
            }], function (err) {
                if (err) {
                    cb(err);
                    return;
                }
                cb(null, milestoneTracker);
            });
        }
    }, {
        key: "bytes2milestones",
        value: function bytes2milestones(b) {
            var d = _rlp2.default.decode(b);
            var milestones = _lodash2.default.map(d, function (milestone) {
                var m = {
                    description: milestone[0].toString("utf8"),
                    url: milestone[1].toString("utf8"),
                    minCompletionDate: new _bignumber2.default("0x" + milestone[2].toString("hex")),
                    maxCompletionDate: new _bignumber2.default("0x" + milestone[3].toString("hex")),
                    milestoneLeadLink: "0x" + milestone[4].toString("hex"),
                    reviewer: "0x" + milestone[5].toString("hex"),
                    reviewTime: new _bignumber2.default("0x" + milestone[6].toString("hex")),
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
        res.payValue = extractUInt(payData, 2).div(1e18).toNumber();
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

function runEthTx(_ref, cb) {
    var contract = _ref.contract,
        method = _ref.method,
        opts = _objectWithoutProperties(_ref, ["contract", "method"]);

    var promise = new Promise(function (resolve, reject) {
        if (!contract) {
            reject(new Error("Contract not defined"));
            return;
        }

        if (!method) {
            // TODO send raw transaction to the contract.
            reject(new Error("Method not defined"));
            return;
        }

        var methodAbi = contract.abi.find(function (_ref2) {
            var name = _ref2.name;
            return name === method;
        });

        if (!methodAbi) {
            reject(new Error("Invalid method"));
            return;
        }

        var paramNames = methodAbi.inputs.map(function (_ref3) {
            var name = _ref3.name;

            if (name[0] === "_") {
                return name.substring(1);
            }
            return name;
        });

        var fromAccount = void 0;
        var gas = void 0;
        var txHash = void 0;

        _async2.default.series([function (cb1) {
            if (opts.from) {
                fromAccount = opts.from;
                setImmediate(cb1);
            } else {
                // eslint-disable-next-line no-underscore-dangle
                contract._eth.getAccounts(function (err, _accounts) {
                    if (err) {
                        cb1(err);return;
                    }
                    if (_accounts.length === 0) {
                        cb1(new Error("No account to deploy a contract"));
                        return;
                    }
                    fromAccount = _accounts[0];
                    cb1();
                });
            }
        }, function (cb1) {
            var params = paramNames.map(function (name) {
                return opts[name];
            });
            params.push({
                from: fromAccount,
                gas: 4000000
            });
            params.push(function (err, _gas) {
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

            contract[method].estimateGas.apply(null, params);
        }, function (cb1) {
            var params = paramNames.map(function (name) {
                return opts[name];
            });
            params.push({
                from: fromAccount,
                gas: gas
            });
            params.push(function (err, _txHash) {
                if (err) {
                    cb1(err);
                } else {
                    txHash = _txHash;
                    cb1();
                }
            });

            contract[method].apply(null, params);
        }], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(txHash);
            }
        });
    });

    if (cb) {
        promise.then(function (value) {
            cb(null, value);
        }, function (reason) {
            cb(null, reason);
        });
    } else {
        return promise;
    }
}
module.exports = exports["default"];
