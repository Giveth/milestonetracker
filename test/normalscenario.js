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

var verbose = true;

/* SCHEMA OF THE TEST
        Prop: 0     Prop: 1     Prop: 2     Prop: 3     Prop: 4     Prop: 5
Stp 1:  Propose     Propose     Propose     Propose     Propose     Propose
Stp 2:  Accept      Accept      Accept      Accept      Accept      Cancel
--delay--
Stp 3:  Done        Done        Done        Done
Stp 4:  Approve     Disapprove  Disapprove
Stp 5:              Done        ForceApprove
--delay--
Stp 6:                                      Collect
--delay--
Stp 7:
*/

var proposals = [
    [ // Proposal 0
        {   // Proposal 0, Step 0
            acceptNewMilestoneProposal:false,
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMileston: false
        },
        {   // Proposal 0, Step 1 after propose
            acceptNewMilestoneProposal:true,
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMileston: false
        },
        {   // Proposal 0, Step 2
            action: "acceptNewMilestoneProposal",
            acceptNewMilestoneProposal:false,
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMileston: true
        },
        {   // Proposal 0, Step 3
            action: "milestoneCompleted",
            acceptNewMilestoneProposal:false,
            milestoneCompleted:false,
            approveMilestone: true,
            disapproveMilestone: true,
            collectMilestone: false,
            cancelMilestone: true,
            forceApproveMileston: true
        },
        {   // Proposal 0, Step 4
            action: "approveMilestone",
            acceptNewMilestoneProposal:false,
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMileston: false,
            testPayment: true
        },
        {   // Proposal 0, Step 5
            acceptNewMilestoneProposal:false,
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMileston: false
        },
        {   // Proposal 0, Step 6
            acceptNewMilestoneProposal:false,
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMileston: false
        },
        {   // Proposal 0, Step 7
            acceptNewMilestoneProposal:false,
            milestoneCompleted:false,
            approveMilestone: false,
            disapproveMilestone: false,
            collectMilestone: false,
            cancelMilestone: false,
            forceApproveMileston: false
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
    var verifier;

    before(function(done) {
//        ethConnector.init('rpc', function(err) {
        ethConnector.init('testrpc' ,function(err) {
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
            verifier = ethConnector.accounts[8];

            caller = {
                acceptNewMilestoneProposal: donor,
                milestoneCompleted: recipient,
                approveMilestone: verifier,
                disapproveMilestone: verifier,
                collectMilestone: recipient,
                cancelMilestone: recipient,
                forceApproveMileston: arbitrator
            };
            done();
        });
    });
    it('should deploy vault contracts ', function(done){
        this.timeout(20000000);
        var now = Math.floor(new Date().getTime() /1000);

        vaultHelper.deploy({
            escapeCaller: hatchCaller,
            escapeDestination: hatchReceiver,
            guardian: guardian,
            absoluteMinTimeLock: 86400,
            timeLock: 86400*2
        }, function(err, _vault) {
            assert.ifError(err);
            assert.ok(_vault.address);
            vault = _vault;
            done();
        });
    });
    it('should deploy milestoneTracker contracts ', function(done){
        this.timeout(20000000);
        var now = Math.floor(new Date().getTime() /1000);

        console.log("VA: " +vault.address);
        milestoneTrackerHelper.deploy({
            arbitrator: arbitrator,
            donor: donor,
            verifier: verifier,
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
            console.log(res);
            assert.equal(vault.address.res);
            done();
        });
    });
    it('Should authorize milestoneTracker as spender', function(done) {
        this.timeout(20000000);
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
        this.timeout(20000000);
        checkStep(0,done);
    });
    it('Stp1: Should generate 6 proposals', function(done) {
        this.timeout(20000000);
        var now = new Date().getTime() / 1000;
        async.eachSeries(_.range(6), function(i, cb) {
            milestoneTracker.proposeNewMilestone(
                "Proposal " + i,
                "",
                ethConnector.web3.toWei(i),
                recipient,
                "",
                now+86400,
                now+86400*3,
                86400*2,
                {
                    from: recipient,
                    gas: 500000
                },
                cb
                );
        }, function(err) {
            assert.ifError(err);
            milestoneTracker.numberOfMilestones(function(err, res) {
                assert.ifError(err);
                assert.equal(res,6);
                checkStep(1,done);
            });
        });
    });
    it('Stp2: Should approve first five and cancel the other', function(done) {
        this.timeout(20000000);
        checkStep(2,done);
    });
    it('Should delay until proposals are doable', function(done) {
        bcDelay(86400 +1, done);
    });
    it('Stp3: Mark proposals as done', function(done) {
        this.timeout(20000000);
        checkStep(3,done);
    });
    it('Step4: Approve or disapprove', function(done) {
        this.timeout(20000000);
        checkStep(4,done);
    });
    it('Step5: Done and force aprove', function(done) {
        this.timeout(20000000);
        checkStep(5,done);
    });
    it('Should delay until proposal aproves automatically', function(done) {
        bcDelay(86400 +1, done);
    });
    it('Step6: Collect', function(done) {
        this.timeout(20000000);
        checkStep(6,done);
    });
    it('Should delay until proposals expires', function(done) {
        bcDelay(86400 +1, done);
    });
    it('Step7: Expiration', function(done) {
        this.timeout(20000000);
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
                    if (proposals[proposal][step].checkPayment) {
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
                    console.log("Proposal: " + JSON.stringify(res));
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

                async.whilest(
                    function() { return (i< numberOfPayments)&&(!payment); },
                    function(cb) {
                        vault.payment(i, function(err, res) {
                            assert.ifError(err);
                            if (res[0] === "Payment "+i) {
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
                var now = new Date().getTime() / 1000;
                assert.equal(payment[1], milestoneTracker.address);
                assert(payment[2]>=now+86400);
                assert(payment[2]-now<86430);
                assert.equal(payment[3], false);  // cancelled
                assert.equal(payment[4], false);  // payed
                assert.equal(payment[5], recipient);
                assert.vault(payment[6], ethConnector.web3.toWei(i));
                cb();
            }
        ], cb);
    }

    function checkStepProposal(step, proposal, cb) {

        async.eachSeries(
            [
                'acceptNewMilestoneProposal',
                'milestoneCompleted',
                'approveMilestone',
                'disapproveMilestone',
                'collectMilestone',
                'cancelMilestone',
                'forceApproveMileston'
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
});
