/*jslint node: true */
"use strict";

var async = require('async');
var ethConnector = require('ethconnector');
var path = require('path');
var _ = require('lodash');
var rlp = require('rlp');
var BigNumber = require('bignumber.js');

var milestoneTracketAbi;
var milestoneTracket;

var src;

exports.deploy = function(opts, cb) {
    var compilationResult = {};
    return async.series([
        function(cb) {
            ethConnector.loadSol(path.join(__dirname, "../MilestoneTracker.sol"), function(err, _src) {
                if (err) return cb(err);
                src = _src;
                cb();
            });
        },
        function(cb) {
            ethConnector.applyConstants(src, opts, function(err, _src) {
                if (err) return cb(err);
                src = _src;
                cb();
            });
        },
        function(cb) {
            compilationResult.srcVault = src;
            ethConnector.compile(src, function(err, result) {
                if (err) return cb(err);
                compilationResult = _.extend(result, compilationResult);
                cb();
            });
        },
        function(cb) {
            milestoneTracketAbi = JSON.parse(compilationResult.MilestoneTracker.interface);
            ethConnector.deploy(compilationResult.MilestoneTracker.interface,
                compilationResult.MilestoneTracker.bytecode,
                0,
                0,
                opts.arbitrator,
                opts.donor,
                opts.recipient,
                function(err, _milestoneTracket) {
                    if (err) return cb(err);
                    milestoneTracket = _milestoneTracket;
                    cb();
                });
        },
    ], function(err) {
        if (err) return cb(err);
        cb(null,milestoneTracket, compilationResult);
    });
};

exports.milestones2bytes = function(milestones) {
    function n2buff(a) {
        var S= new BigNumber(a).toString(16);
        if (S.length % 2 === 1) S='0' +S;
        return new Buffer(S,'hex');
    }

    var d = _.map(milestones, function(milestone) {
        return [
            new Buffer(milestone.description),
            new Buffer(milestone.url),
            n2buff(milestone.minCompletionDate),
            n2buff(milestone.maxCompletionDate),
            milestone.reviewer,
            n2buff(milestone.reviewTime),
            milestone.paymentSource,
            milestone.payData
        ];
    });

    var b= rlp.encode(d);
    return '0x' + b.toString('hex');
};

exports.bytes2milestones = function(b) {

    var d = rlp.decode(b);
    var milestones = _.map(d, function(milestone) {
        return {
            description: milestone[0].toString('utf8'),
            url: milestone[1].toString('utf8'),
            minCompletionDate: new BigNumber("0x" + milestone[2].toString('hex')),
            maxCompletionDate: new BigNumber("0x" + milestone[3].toString('hex')),
            reviewer: '0x' + milestone[4].toString('hex'),
            reviewTime: new BigNumber("0x" + milestone[5].toString('hex')),
            paymentSource: '0x' + milestone[6].toString('hex'),
            payData: '0x' + milestone[7].toString('hex')
        };
    });
    return milestones;

};
