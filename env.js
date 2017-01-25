"use strict";

var Web3 = require('web3');
// create an instance of web3 using the HTTP provider.
// NOTE in mist web3 is already available, so check first if its available before instantiating
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var BigNumber = require('bignumber.js');

var eth = web3.eth;
var async = require('async');

var liquiumRT = require('./js/liquium_rt.js');


var organization;
var singleChoice;
var idCategory;
var idDelegate;
var idPoll;

function deployOrganization(cb) {
    cb = cb || function() {};
    liquiumRT.deployOrganization(web3, eth.accounts[0], {}, function(err, _organization) {
        if (err) {
            console.log(err);
            return cb(err);
        }
        organization = _organization;
        console.log("Organization deployed at: "+organization.address);
        cb();
    });
}
