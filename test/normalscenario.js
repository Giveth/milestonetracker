import ethConnector from "ethconnector";
import Vault from "vaultcontract";
import BigNumber from "bignumber.js";
import assert from "assert"; // node.js core module
import async from "async";
import _ from "lodash";

import MilestoneTracker from "../js/milestonetracker";

const verbose = false;

/* SCHEMA OF THE TEST
        Prop: 0     Prop: 1     Prop: 2     Prop: 3
Stp 1:  Propose     Propose     Propose     Propose
Stp 2:  Accept      Accept      Accept      Accept
--delay--
Stp 3:  Complete    Complete    Complete
Stp 4:  Approve     Disapprove  Disapprove
Stp 5:              Complete    ForceApprove
--delay--
Stp 6:              Collect
--delay--
Stp 7:
*/

const proposals = [
    [ // Proposal 0
        {   // Proposal 0, Step 0
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 0, Step 1 after propose
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 0, Step 2
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 0, Step 3
            action: "markMilestoneComplete",
            markMilestoneComplete: false,
            approveCompletedMilestone: true,
            rejectMilestone: true,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 0, Step 4
            action: "approveCompletedMilestone",
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
            testPayment: true,
        },
        {   // Proposal 0, Step 5
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 0, Step 6
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 0, Step 7
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
    ],

    [ // Proposal 1
        {   // Proposal 1, Step 0
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 1, Step 1 after propose
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 1, Step 2
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 1, Step 3
            action: "markMilestoneComplete",
            markMilestoneComplete: false,
            approveCompletedMilestone: true,
            rejectMilestone: true,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 1, Step 4
            action: "rejectMilestone",
            markMilestoneComplete: true,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 1, Step 5
            action: "markMilestoneComplete",
            markMilestoneComplete: false,
            approveCompletedMilestone: true,
            rejectMilestone: true,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 1, Step 6
            action: "requestMilestonePayment",
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
            testPayment: true,
        },
        {   // Proposal 1, Step 7
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
    ],
    [ // Proposal 2
        {   // Proposal 2, Step 0
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 2, Step 1 after propose
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 2, Step 2
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 2, Step 3
            action: "markMilestoneComplete",
            markMilestoneComplete: false,
            approveCompletedMilestone: true,
            rejectMilestone: true,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 2, Step 4
            action: "rejectMilestone",
            markMilestoneComplete: true,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 2, Step 5
            action: "arbitrateApproveMilestone",
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
            testPayment: true,
        },
        {   // Proposal 2, Step 6
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 2, Step 7
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
    ],
    [ // Proposal 3
        {   // Proposal 3, Step 0
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 3, Step 1 after propose
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: false,
            arbitrateApproveMilestone: false,
        },
        {   // Proposal 3, Step 2
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 3, Step 3
            markMilestoneComplete: true,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 3, Step 4
            markMilestoneComplete: true,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 3, Step 5
            markMilestoneComplete: true,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 3, Step 6
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
        {   // Proposal 3, Step 7
            markMilestoneComplete: false,
            approveCompletedMilestone: false,
            rejectMilestone: false,
            requestMilestonePayment: false,
            cancelMilestone: true,
            arbitrateApproveMilestone: true,
        },
    ],
];

let caller;

describe("Normal Scenario Milestone test", () => {
    let vault;
    let milestoneTracker;
    let owner;
    let escapeCaller;
    let escapeDestination;
    let guardian;
    let recipient;
    let arbitrator;
    let donor;
    let reviewer;
    let milestoneLeadLink;

    let milestonesBytes;
    let milestones;

    before((done) => {
//        ethConnector.init('rpc', function(err) {
        ethConnector.init("testrpc", { gasLimit: 4000000 }, (err) => {
            if (err) {
                done(err);
                return;
            }
            owner = ethConnector.accounts[ 0 ];
            escapeCaller = ethConnector.accounts[ 1 ];
            escapeDestination = ethConnector.accounts[ 2 ];
            guardian = ethConnector.accounts[ 3 ];
            recipient = ethConnector.accounts[ 5 ];
            arbitrator = owner;
            donor = ethConnector.accounts[ 7 ];
            reviewer = ethConnector.accounts[ 8 ];
            milestoneLeadLink = ethConnector.accounts[ 9 ];

            caller = {
                markMilestoneComplete: milestoneLeadLink,
                approveCompletedMilestone: reviewer,
                rejectMilestone: reviewer,
                requestMilestonePayment: milestoneLeadLink,
                cancelMilestone: recipient,
                arbitrateApproveMilestone: arbitrator,
            };
            done();
        });
    });
    it("should deploy vault contracts ", function(done) {
        this.timeout(20000);

        Vault.deploy(ethConnector.web3, {
            escapeCaller,
            escapeDestination,
            absoluteMinTimeLock: 86400,
            timeLock: 86400 * 2,
            guardian,
            maxGuardianDelay: 86400 * 21,
        }, (err, _vault) => {
            assert.ifError(err);
            assert.ok(_vault.contract.address);
            vault = _vault;
            done();
        });
    });
    it("should deploy milestoneTracker contracts ", function(done) {
        this.timeout(20000);
        MilestoneTracker.deploy(ethConnector.web3, {
            arbitrator,
            donor,
            recipient,
        }, (err, _milestoneTracker) => {
            assert.ifError(err);
            assert.ok(_milestoneTracker.contract.address);
            milestoneTracker = _milestoneTracker;
            done();
        });
    });
    it("Should authorize milestoneTracker as spender", (done) => {
        vault.contract.authorizeSpender(milestoneTracker.contract.address, true, {
            from: owner,
            gas: 200000,
        }, (err) => {
            assert.ifError(err);
            vault.contract.allowedSpenders(milestoneTracker.contract.address, (err2, res) => {
                assert.ifError(err2);
                assert.equal(res, true);
                done();
            });
        });
    });
    it("Stp0: Should not allow any action before creating the proposals", (done) => {
        checkStep(0, done);
    });
    it("Stp1: Should propose the proposal", (done) => {
        const now = Math.floor(new Date().getTime() / 1000);

        milestones = [];
        for (let i = 0; i < 4; i += 1) {
            milestones.push({
                description: "Proposal " + i,
                url: "http://url_" + i,
                minCompletionDate: now + 86400,
                maxCompletionDate: now + (86400 * 3),
                reviewer,
                milestoneLeadLink,
                reviewTime: 86400 * 2,
                paymentSource: vault.contract.address,
                payData: vault.contract.authorizePayment.getData("Proposal " + i, recipient, ethConnector.web3.toWei(i), 0),
                status: "AcceptedAndInProgress",
                payDescription: "Proposal " + i,
                payRecipient: recipient,
                payValue: i,
                payDelay: 0,
                doneTime: 0,
            });
        }

        milestonesBytes = MilestoneTracker.milestones2bytes(milestones);
        const calcMilestones1 = MilestoneTracker.bytes2milestones(milestonesBytes);
        assert.deepEqual(normalizeMilestones(milestones), normalizeMilestones(calcMilestones1));

        milestoneTracker.contract.proposeMilestones(milestonesBytes, {
            from: recipient,
            gas: 1000000,
        }, (err) => {
            assert.ifError(err);
            milestoneTracker.contract.proposedMilestones((err2, res) => {
                assert.ifError(err2);
                assert.equal(res, milestonesBytes);
                const calcMilestones = MilestoneTracker.bytes2milestones(res);
                assert.deepEqual(normalizeMilestones(milestones),
                    normalizeMilestones(calcMilestones));
                checkStep(1, done);
            });
        });
    });
    it("Stp2: Should approve the proposals", function (done) {
        this.timeout(20000);
        milestoneTracker.contract.acceptProposedMilestones(
            ethConnector.web3.sha3(milestonesBytes, { encoding: "hex" }),
            { from: donor, gas: 2000000 },
            (err) => {
                assert.ifError(err);

                milestoneTracker.getState((err2, st) => {
                    assert.ifError(err2);
                    assert.equal(st.milestones.length, 4);
                    assert.deepEqual(st.milestones, milestones);
                    checkStep(2, done);
                });
            });
    });
    it("Should delay until proposals are doable", (done) => {
        bcDelay(86400 + 1, done);
    });
    it("Stp3: Mark proposals as done", function (done) {
        this.timeout(20000);
        checkStep(3, done);
    });
    it("Step4: Approve or disapprove", (done) => {
        checkStep(4, done);
    });
    it("Step5: Complete and force aprove", (done) => {
        checkStep(5, done);
    });
    it("Should delay until proposal aproves automatically", (done) => {
        bcDelay((86400 * 2) + 1, done);
    });
    it("Step6: Collect", (done) => {
        checkStep(6, done);
    });
    it("Should delay until proposals expires", (done) => {
        bcDelay(86400 + 1, done);
    });
    it("Step7: Expiration", (done) => {
        checkStep(7, done);
    });

    function checkStep(step, cb) {
        async.eachSeries(_.range(proposals.length), (proposal, cb1) => {
            log("Start check step: " + step + " Proposal: " + proposal);
            async.series([
                (cb2) => {
                    doAction(proposal, proposals[ proposal ][ step ].action, cb2);
                },
                (cb2) => {
                    checkStepProposal(step, proposal, cb2);
                },
                (cb2) => {
                    if (proposals[ proposal ][ step ].testPayment) {
                        checkPayment(proposal, cb2);
                    } else {
                        cb2();
                    }
                },
            ], cb1);
        }, (err) => {
            log("End step: " + step);
            cb(err);
        });
    }

    function doAction(proposal, action, cb) {
        if (!action) {
            cb();
            return;
        }
        log("Proposa: " + proposal + " Action: " + action + " Sender: " + caller[ action ]);
        milestoneTracker.contract[ action ](proposal,
            {
                from: caller[ action ],
                gas: 2000000,
            }, (err) => {
                assert.ifError(err);
                milestoneTracker.contract.milestones(proposal, (err2, res) => {
                    assert.ifError(err2);
                    log("Proposal: " + JSON.stringify(res));
                    cb();
                });
            });
    }

    function checkPayment(proposal, cb) {
        let numberOfAuthorizedPayments;
        let payment;
        let i = 0;
        async.series([
            (cb1) => {
                vault.contract.numberOfAuthorizedPayments((err, res) => {
                    assert.ifError(err);
                    numberOfAuthorizedPayments = res;
                    cb1();
                });
            },
            (cb1) => {
                async.whilst(
                    () => ((i < numberOfAuthorizedPayments) && (!payment)),
                    (cb2) => {
                        vault.contract.authorizedPayments(i, (err, res) => {
                            assert.ifError(err);
                            if (res[ 0 ] === "Proposal " + i) {
                                payment = res;
                            } else {
                                i += 1;
                            }
                            cb2();
                        });
                    },
                    cb1);
            },
            (cb1) => {
                const now = Math.floor(new Date().getTime() / 1000);
                assert.equal(payment[ 1 ], milestoneTracker.contract.address);
                assert(payment[ 2 ].toNumber() >= (now + (86400 * 3)) - 15);
                assert(payment[ 2 ].toNumber() <= (now + (86400 * 3)) + 15);
                assert.equal(payment[ 3 ], false);  // canceled
                assert.equal(payment[ 4 ], false);  // payed
                assert.equal(payment[ 5 ], recipient);
                assert.equal(payment[ 6 ], ethConnector.web3.toWei(i));
                cb1();
            },
        ], cb);
    }

    function checkStepProposal(step, proposal, cb) {
        async.eachSeries(
            [
                "markMilestoneComplete",
                "approveCompletedMilestone",
                "rejectMilestone",
                "requestMilestonePayment",
                "cancelMilestone",
                "arbitrateApproveMilestone",
            ],
            (method, cb1) => {
                log("Check Step: " + step + " Proposal: " + proposal + " Method: " + method);
                milestoneTracker.contract[ method ].estimateGas(proposal, {
                    from: caller[ method ],
                    gas: 4000000,
                }, (err) => {
                    if (proposals[ proposal ][ step ][ method ]) {
                        assert.ifError(err);
                    } else {
                        assert(err);
                    }
                    cb1();
                });
            },
            cb);
    }

    function bcDelay(secs, cb) {
        send("evm_increaseTime", [ secs ], (err) => {
            if (err) { cb(err); return; }

      // Mine a block so new time is recorded.
            send("evm_mine", (err1) => {
                if (err1) { cb(err); return; }
                cb();
            });
        });
    }

        // CALL a low level rpc
    function send(method, _params, _callback) {
        let params;
        let callback;
        if (typeof _params === "function") {
            callback = _params;
            params = [];
        } else {
            params = _params;
            callback = _callback;
        }

        ethConnector.web3.currentProvider.sendAsync({
            jsonrpc: "2.0",
            method,
            params: params || [],
            id: new Date().getTime(),
        }, callback);
    }

    function log(S) {
        if (verbose) {
            console.log(S);
        }
    }

    function normalizeMilestones(mls) {
        _.map(mls, (milestone) => {
            const r = {
                description: milestone.description,
                url: milestone.url,
                minCompletionDate: new BigNumber(milestone.minCompletionDate).toString(),
                maxCompletionDate: new BigNumber(milestone.maxCompletionDate).toString(),
                milestoneLeadLink: milestone.milestoneLeadLink,
                reviewer: milestone.reviewer,
                reviewTime: new BigNumber(milestone.reviewTime).toString(),
                paymentSource: milestone.paymentSource,
                payData: milestone.payData,
            };
            return r;
        });
    }
});
