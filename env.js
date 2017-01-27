"use strict";

var Web3 = require('web3');
// create an instance of web3 using the HTTP provider.
// NOTE in mist web3 is already available, so check first if its available before instantiating
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var BigNumber = require('bignumber.js');

var eth = web3.eth;
var async = require('async');

var MilestoneTracker = require('./dist/milestoneTracker.js');


var milestoneTracker = new MilestoneTracker(web3, '0x0F593DCCe096c5C39Bd509123150707644Ad48DE');
