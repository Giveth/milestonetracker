/*jslint node: true */
"use strict";

var async = require('async');
var ethConnector = require('ethconnector');
var path = require('path');
var _ = require('lodash');

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
                opts.vault,
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
