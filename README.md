# milestonetracker

MailestoneTracker  is a contract between a `donor` and a `recipient`. It tries
to waranty to the recipient that the work will be payed if the milestones are
acomplished. And also tries to waranty that the Ether will not be lost if the
milestones are not acomplished.

For each milestone, a reviewer is defined. This reviewer can approve or
disaprove the work done for a milestone. If the reviewer does not approve or
disapprove in during review time, the milestone will be approved automatically.

This contract also defines an `arbitrator` who can at any moment approve a
specific milestone or cancel the full campaign.

Any of the roles deifined in this contract: `donor`, `recipient`, `reviewer`
and `aritrator` can be a regular account or a contract like a miltisig or a DAI
(Decentralized Autonomus Identity).


## Constructor

    function MilestoneTracker (
            address _arbitrator,
            address _donor,
            address _recipient
        )

## Proposing new milestones

To create the milestoneList or to change any thing on this, the `recipient` will
propose a new list and the `donor` will have to accept it in order for this list
to take effect.

To propose a new list, the donor will call `proposeMilestones` method

    function proposeMilestones(bytes _newMilestones)

The _newMilestones parameter is the RLP encoded list of milestones. This list
will replace all the previows not completed and paid milestones.

In js/milestonetacker_helper.js there are the functions `milestones2bytes` and
`bytes2milestones` to encode a and decode a list of milestones.

To use you can do:

    npm install milestonestracker

And create a the bytes this way:


    milestonesTrackerHelper = require('milestonestracker');
    var now = Math.floor(new Date().getTime() / 1000);

    var reviewer = '0x12345678901234567890123456789012';
    var payDestination = '0xaabbccddeeff11223344556677889900'


    var milestonesBytes = milestonesTrackerHelper.milestones2bytes(
        {
            description: "Milestone 1: Do the web page of the campaig" ,
            url: "http://mycampaig.com/milestone1",
            minDoneDate: Math.floor(new Date('2017-01-01').getTime() /1000),
            maxDoneDate: Math.floor(new Date('2017-02-01').getTime() /1000),
            reviewer: reviewer,
            reviewTime: 86400*7,
            payDestination: vault.address,
            payData: vault.authorizePayment.getData(
                "Example Campaign - Proposal 1 ",
                recipient,
                ethConnector.web3.toWei(100),
                0)
        },
        {
            description: "Milestone 2: Promote SEO" ,
            url: "http://mycampaig.com/milestone2",
            minDoneDate: Math.floor(new Date('2017-01-15').getTime() /1000),
            maxDoneDate: Math.floor(new Date('2017-03-01').getTime() /1000),
            reviewer: reviewer,
            reviewTime: 86400*7,
            payDestination: recipient,
            payDestination: vault.address,
            payData: vault.authorizePayment.getData(
                "Example Campaign - Proposal 1 ",
                recipient,
                ethConnector.web3.toWei(80),
                0)
        },
    );

Once the milestone is proposed, the `donor` can accept the new list in
replacement of the old one by calling

    function acceptProposedMilestones(bytes32 hashProposals)

The recipient can also cancel this new proposal and continue with the old one
by calling

    function unproposeMilestones()

Diring the time a new milestone list proposal is pending to be approved, all
current milestones get frizzed and no mileston can set as done or be approved to
be paid.

## Setting the work DONE, review the job and get paid.

With the milestone List approved, the recipient can start work on the milestones.
When he finishes a mileston, he can mark it as DONE by calling:

    function milestoneCompleted(uint _idMilestone)

At this point, the reviewer o`f this milestone can approve or disapprove the
miles by calling:

    function approveMilestone(uint _idMilestone)

    function disapproveMilestone(uint _idMilestone)

If during the `reviewTime` of the milestone, the `reviewer` didn't say nothing,
the milestone will be considered approved and the recipent can call.

    function collectMilestone(uint _idMilestone)

In the `approveMilestone` call and in the `collectMilestone` A call is made
to the `payDestination` with value `amount` Ethers and data `payData`

## Canceling a milestone

The recipient can cancel a milestone at any time if he knows he's not going to
do the milestone.

## Arbitration

If there is a conflict betwen the reviewer and the recipient, the arbitrator (if
defined) has the power to force the payment of a miletson.

    function forceApproveMilestone(uint _idMilestone)

The arbitrator has also the power to cancel the full campaig by calling

    function cancelCampaign()

At this point, all the full campaig is canceled.


