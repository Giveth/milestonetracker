/*jslint node: true */
/*global describe, it, before, beforeEach, after, afterEach */
"use strict";

var ethConnector = require('ethconnector');
var milestoneTrackerHelper = require('../js/milestonetracker_helper.js');
var vaultHelper = require('vaultcontract');
var BigNumber = require('bignumber.js');


var assert = require("assert"); // node.js core module
var async = require('async');
var _ = require('lodash');

var verbose = false;

/* SCHEMA OF THE TEST
        Prop: 0     Prop: 1     Prop: 2     Prop: 3
Stp 1:  Propose     Propose     Propose     Propose
Stp 2:  Accept      Accept      Accept      Accept
--delay--
Stp 3:  Done        Done        Done
Stp 4:  Approve     Disapprove  Disapprove
Stp 5:              Done        ForceApprove
--delay--
Stp 6:              Collect
--delay--
Stp 7:
*/

var proposals = [
    [ // Proposal 0
        {   // Proposal 0, Step 0
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        },
        {   // Proposal 0, Step 1 after propose
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        },
        {   // Proposal 0, Step 2
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true
        },
        {   // Proposal 0, Step 3
            action: "milestoneCompleted",
            milestoneCompleted:false,
            approveMilestone: true,
            disapproveMilestone: true,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true
        },
        {   // Proposal 0, Step 4
            action: "approveMilestone",
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false,
            testPayment: true
        },
        {   // Proposal 0, Step 5
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        },
        {   // Proposal 0, Step 6
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        },
        {   // Proposal 0, Step 7
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        }
    ],

    [ // Proposal 1
        {   // Proposal 1, Step 0
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        },
        {   // Proposal 1, Step 1 after propose
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        },
        {   // Proposal 1, Step 2
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true
        },
        {   // Proposal 1, Step 3
            action: "milestoneCompleted",
            milestoneCompleted:false,
            approveMilestone: true,
            disapproveMilestone: true,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true
        },
        {   // Proposal 1, Step 4
            action: "disapproveMilestone",
            milestoneCompleted:true,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true,
        },
        {   // Proposal 1, Step 5
            action: "milestoneCompleted",
            milestoneCompleted:false,
            approveMilestone: true,
            disapproveMilestone: true,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true
        },
        {   // Proposal 1, Step 6
            action: "collectMilestone",
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false,
            testPayment: true
        },
        {   // Proposal 1, Step 7
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        }
    ],


    [ // Proposal 2
        {   // Proposal 2, Step 0
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        },
        {   // Proposal 2, Step 1 after propose
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        },
        {   // Proposal 2, Step 2
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true
        },
        {   // Proposal 2, Step 3
            action: "milestoneCompleted",
            milestoneCompleted:false,
            approveMilestone: true,
            disapproveMilestone: true,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true
        },
        {   // Proposal 2, Step 4
            action: "disapproveMilestone",
            milestoneCompleted:true,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true,
        },
        {   // Proposal 2, Step 5
            action: "forceApproveMilestone",
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false,
            testPayment: true
        },
        {   // Proposal 2, Step 6
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false,
        },
        {   // Proposal 2, Step 7
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        }
    ],
    [ // Proposal 3
        {   // Proposal 3, Step 0
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        },
        {   // Proposal 3, Step 1 after propose
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMilestone: false
        },
        {   // Proposal 3, Step 2
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true
        },
        {   // Proposal 3, Step 3
            milestoneCompleted:true,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true
        },
        {   // Proposal 3, Step 4
            milestoneCompleted:true,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true,
        },
        {   // Proposal 3, Step 5
            milestoneCompleted:true,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true,
        },
        {   // Proposal 3, Step 6
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true,
        },
        {   // Proposal 3, Step 7
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMilestone: true
        }
    ]
];

var caller;

describe('Normal Scenario Milestone test', function(){
    var vault;
    var milestoneTracker;
    var owner;
    var hatchCaller;
    var hatchReceiver;
    var guardian;
    var spender;
    var recipient;
    var guest;
    var arbitrator;
    var donor;
    var reviewer;

    var milestonesBytes;
    var milestones;

    before(function(done) {
//        ethConnector.init('rpc', function(err) {
        ethConnector.init('testrpc' ,{gasLimit: 4000000}, function(err) {
            if (err) return done(err);
            owner = ethConnector.accounts[0];
            hatchCaller = ethConnector.accounts[1];
            hatchReceiver = ethConnector.accounts[2];
            guardian = ethConnector.accounts[3];
            spender = ethConnector.accounts[4];
            recipient = ethConnector.accounts[5];
            guest = ethConnector.accounts[6];
            arbitrator = owner;
            donor =ethConnector.accounts[7];
            reviewer = ethConnector.accounts[8];

            caller = {
                milestoneCompleted: recipient,
                approveMilestone: reviewer,
                disapproveMilestone: reviewer,
                collectMilestone: recipient,
                cancelMilestone: recipient,
                forceApproveMilestone: arbitrator
            };
            done();
        });
    });
    it('should deploy vault contracts ', function(done){
        this.timeout(20000);
        var now = Math.floor(new Date().getTime() /1000);

        vaultHelper.deploy({
            escapeCaller: hatchCaller,
            escapeDestination: hatchReceiver,
            absoluteMinTimeLock: 86400,
            timeLock: 86400*2,
            guardian: guardian,
            maxGuardianDelay: 86400*21
        }, function(err, _vault) {
            assert.ifError(err);
            assert.ok(_vault.address);
            vault = _vault;
            done();
        });
    });
    it('should deploy milestoneTracker contracts ', function(done){
        this.timeout(20000);
        var now = Math.floor(new Date().getTime() /1000);
        milestoneTrackerHelper.deploy({
            arbitrator: arbitrator,
            donor: donor,
            recipient: recipient,
            vault: vault.address
        }, function(err, _milestoneTracker) {
            assert.ifError(err);
            assert.ok(_milestoneTracker.address);
            milestoneTracker = _milestoneTracker;
            done();
        });
    });
    it('Shoult check that vault is valid', function(done) {
        milestoneTracker.vault(function(err, res) {
            assert.ifError(err);
            assert.equal(vault.address.res);
            done();
        });
    });
    it('Should authorize milestoneTracker as spender', function(done) {
        this.timeout(20000);
        vault.authorizeSpender(milestoneTracker.address, true, {
            from: owner,
            gas: 200000
        }, function(err) {
            assert.ifError(err);
            vault.allowedSpenders(milestoneTracker.address, function(err, res) {
                assert.ifError(err);
                assert.equal(res, true);
                done();
            });
        });
    });
    it("Stp0: Should not allow any action before creating the proposals", function(done) {
        this.timeout(20000);
        checkStep(0,done);
    });
    it('Stp1: Should propose the proposals', function(done) {
        this.timeout(20000000);
        var now = Math.floor(new Date().getTime() / 1000);

        milestones = [];
        for (var i=0; i<4; i++) {
            milestones.push({
                description: "Proposal " + i,
                url: "http://url_" + i,
                amount: ethConnector.web3.toWei(i),
                minDoneDate: now+86400,
                maxDoneDate: now+86400*3,
                reviewer: reviewer,
                reviewTime: 86400*2,
                payDestination: recipient,
                payData: "0x"
            });
        }

        milestonesBytes = milestoneTrackerHelper.milestones2bytes(milestones);
        var calcMilestones = milestoneTrackerHelper.bytes2milestones(milestonesBytes);
        assert.deepEqual(normalizeMilestones(milestones), normalizeMilestones(calcMilestones));

        milestoneTracker.proposeMilestones(milestonesBytes, {
            from: recipient,
            gas: 1000000
        },function(err, res) {
            assert.ifError(err);
            milestoneTracker.proposedMilestones(function(err, res) {
                assert.ifError(err);
                assert.equal(res,milestonesBytes);
                var calcMilestones = milestoneTrackerHelper.bytes2milestones(res);
                assert.deepEqual(normalizeMilestones(milestones), normalizeMilestones(calcMilestones));
                checkStep(1,done);
            });
        });
    });
    it('Stp2: Should approve the proposals', function(done) {
        this.timeout(20000000);
        milestoneTracker.acceptProposedMilestones(ethConnector.web3.sha3( milestonesBytes, {encoding: 'hex'}), {from: donor, gas: 2000000}, function(err) {
            assert.ifError(err);
            async.series([
                function(cb) {
                         milestoneTracker.numberOfMilestones(function(err, res) {
                            assert.ifError(err);
                            assert.equal(res,4);
                            cb();
                        });
                },
                function(cb) {
                    var i =0;
                    async.whilst(
                    function() { return i<4; },
                    function(cb) {
                        milestoneTracker.milestones(i, function(err, res) {
                            assert.ifError(err);
                            assert.equal(res[0], milestones[i].description);
                            assert.equal(res[1], milestones[i].url);
                            assert.equal(res[2], milestones[i].amount);
                            assert.equal(res[3], milestones[i].minDoneDate);
                            assert.equal(res[4], milestones[i].maxDoneDate);
                            assert.equal(res[5], milestones[i].reviewer);
                            assert.equal(res[6], milestones[i].reviewTime);
                            assert.equal(res[7], milestones[i].payDestination);
                            assert.equal(res[8], milestones[i].payData);
                            i++;
                            cb();
                        });
                    },
                    cb);
                },
                function(cb) {
                    checkStep(2,done);
                }
            ], done);
        });
    });
    it('Should delay until proposals are doable', function(done) {
        bcDelay(86400 +1, done);
    });
    it('Stp3: Mark proposals as done', function(done) {
        this.timeout(20000);
        checkStep(3,done);
    });
    it('Step4: Approve or disapprove', function(done) {
        this.timeout(20000);
        checkStep(4,done);
    });
    it('Step5: Done and force aprove', function(done) {
        this.timeout(20000);
        checkStep(5,done);
    });
    it('Should delay until proposal aproves automatically', function(done) {
        bcDelay(86400*2 +1, done);
    });
    it('Step6: Collect', function(done) {
        this.timeout(20000);
        checkStep(6,done);
    });
    it('Should delay until proposals expires', function(done) {
        bcDelay(86400 +1, done);
    });
    it('Step7: Expiration', function(done) {
        this.timeout(20000);
        checkStep(7,done);
    });

    function checkStep(step, cb) {
        async.eachSeries(_.range(proposals.length), function(proposal, cb) {
            log("Start check step: " + step + " Proposal: "+proposal);
            async.series([
                function(cb) {
                    doAction(proposal, proposals[proposal][step].action, cb);
                },
                function(cb) {
                    checkStepProposal(step, proposal, cb);
                },
                function(cb) {
                    if (proposals[proposal][step].testPayment) {
                        checkPayment(proposal, cb);
                    } else {
                        cb();
                    }
                }
            ], cb);
        }, cb);
    }

    function doAction(proposal, action, cb) {
        if (!action) return cb();
        log("Proposa: "+ proposal + " Action: " + action + " Sender: " + caller[action]);
        milestoneTracker[action](proposal,
            {
                from: caller[action],
                gas: 2000000
            },function(err, res) {
                assert.ifError(err);
                milestoneTracker.milestones(proposal, function(err, res) {
                    assert.ifError(err);
                    log("Proposal: " + JSON.stringify(res));
                    cb();
                });
            }
        );
    }

    function checkPayment(proposal,cb) {
        var numberOfPayments;
        var payment;
        var i=0;
        async.series([
            function(cb) {
                vault.numberOfPayments(function(err, res) {
                    assert.ifError(err);
                    numberOfPayments = res;
                    cb();
                });
            },
            function(cb) {

                async.whilst(
                    function() { return (i< numberOfPayments)&&(!payment); },
                    function(cb) {
                        vault.payments(i, function(err, res) {
                            assert.ifError(err);
                            if (res[0] === "Proposal "+i) {
                                payment = res;
                            } else {
                                i++;
                            }
                            cb();
                        });
                    },
                    cb
                );
            },
            function(cb) {
                var now = Math.floor(new Date().getTime() / 1000);
                assert.equal(payment[1], milestoneTracker.address);
                assert(payment[2].toNumber()>=now+86400*3 - 15);
                assert(payment[2].toNumber()-now<86400*3 + 15);
                assert.equal(payment[3], false);  // cancelled
                assert.equal(payment[4], false);  // payed
                assert.equal(payment[5], recipient);
                assert.equal(payment[6], ethConnector.web3.toWei(i));
                cb();
            }
        ], cb);
    }

    function checkStepProposal(step, proposal, cb) {

        async.eachSeries(
            [
                'milestoneCompleted',
                'approveMilestone',
                'disapproveMilestone',
                'collectMilestone',
                'cancelMilestone',
                'forceApproveMilestone'
            ],
            function(method,cb) {
                log("Check Step: " + step + " Proposal: "+proposal+ " Method: " + method);
                milestoneTracker[method].estimateGas(proposal, {
                    from: caller[method],
                    gas: 4000000
                }, function(err, res) {
                    if (proposals[proposal][step][method]) {
                        assert.ifError(err);
                    } else {
                        assert(err);
                    }
                    cb();
                });
            },
            cb
        );
    }

    function bcDelay(secs, cb) {
        send("evm_increaseTime", [secs], function(err, result) {
            if (err) return cb(err);

      // Mine a block so new time is recorded.
            send("evm_mine", function(err, result) {
                if (err) return cb(err);
                cb();
            });
        });
    }

    function log(S) {
        if (verbose) {
            console.log(S);
        }
    }

        // CALL a low level rpc
    function send(method, params, callback) {
        if (typeof params == "function") {
          callback = params;
          params = [];
        }

        ethConnector.web3.currentProvider.sendAsync({
          jsonrpc: "2.0",
          method: method,
          params: params || [],
          id: new Date().getTime()
        }, callback);
    }

    function normalizeMilestones(milestones) {
        _.map(milestones, function(milestone) {
            return {
                description: milestone.description,
                url: milestone.url,
                amount: new BigNumber(milestone.amount).toString(),
                minDoneDate: new BigNumber(milestone.minDoneDate).toString(),
                maxDoneDate: new BigNumber(milestone.maxDoneDate).toString(),
                reviewer: milestone.reviewer,
                reviewTime: new BigNumber(milestone.reviewTime).toString(),
                payDestination: milestone.payDestination,
                payData: milestone.payData
            };
        });
    }
});
