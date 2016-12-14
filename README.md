# MilestoneTracker

MailestoneTracker is a smart contract between a `donor` and a `recipient`. It ensures that a `recipient` will get paid when they complete the milestones and that the `donor` will receive the money back if the milestones are not completed. However this contract never holds funds and only signals to the vault on when to send ether.

For each milestone, a `reviewer` is defined. After the `recipient` signals that they have completed the milestone, this `reviewer` can approve or reject the milestone’s completion. If the `reviewer` takes no action during the defined review time, the milestone will be approved automatically.

This contract also defines an `arbitrator` who can, at any time, approve a specific milestone or cancel the full campaign.

All of the roles defined in this contract: `donor`, `recipient`, `reviewer`and `arbitrator` can be a regular account or a contract like a multisig or a DAI (Decentralized Autonomous Identity).


## Constructor

    function MilestoneTracker (
            address _arbitrator,
            address _donor,
            address _recipient
        )

## Proposing New Milestones

To add/remove/edit the milestoneList, the `recipient` needs to propose an entirely new list and the `donor` will have to accept it in order for this list to take effect.

To propose a new list, the `recipient` will call the `proposeMilestones` method

    function proposeMilestones(bytes _newMilestones)

The _newMilestones parameter is the RLP encoded list of milestones. This list will replace all the previous uncompleted and unpaid milestones.

In js/milestonetacker_helper.js there are the functions `milestones2bytes` and `bytes2milestones` which will enable the `recipient` to encode and decode a list of milestones.

To use you can run:

    npm install milestonestracker

And create the Milestone bytes by filling in the appropriate variables:


    milestonesTrackerHelper = require('milestonestracker');
    var now = Math.floor(new Date().getTime() / 1000);

    var reviewer = '0x12345678901234567890123456789012';
    var paymentSource = '0xaabbccddeeff11223344556677889900'


    var milestonesBytes = milestonesTrackerHelper.milestones2bytes(
        {
            description: "Milestone 1: Build the web page for the campaign" ,
            url: "http://mycampaig.com/milestone1",
            minCompletionDate: Math.floor(new Date('2017-01-01').getTime() /1000),
            maxCompletionDate: Math.floor(new Date('2017-02-01').getTime() /1000),
            reviewer: reviewer,
            reviewTime: 86400*7,
            paymentSource: vault.address,
            payData: vault.authorizePayment.getData(
                "Example Campaign - Proposal 1 ",
                recipient,
                ethConnector.web3.toWei(100),
                0)
        },
        {
            description: "Milestone 2: Promote SEO" ,
            url: "http://mycampaig.com/milestone2",
            minCompletionDate: Math.floor(new Date('2017-01-15').getTime() /1000),
            maxCompletionDate: Math.floor(new Date('2017-03-01').getTime() /1000),
            reviewer: reviewer,
            reviewTime: 86400*7,
            paymentSource: vault.address,
            payData: vault.authorizePayment.getData(
                "Example Campaign - Proposal 1 ",
                recipient,
                ethConnector.web3.toWei(80),
                0)
        },
    );

Once the milestone is proposed by the `recipient`, the `donor` can accept the new list and replace the old list by calling

    function acceptProposedMilestones(bytes32 hashProposals)

The `recipient` can also cancel their newly proposed milestoneList and continue with the old milestoneList by calling

    function unproposeMilestones()

While a new milestoneList proposal is pending to be approved, the current milestones are frozen and can not be approved to be paid.

## Completing the Milestones

After the milestoneList is approved, the `recipient` can mark a milestone as `done` by calling:

    function milestoneCompleted(uint _idMilestone)

At this point, the `reviewer` assigned to this milestone can approve or reject the milestone by calling:

    function approveCompletedMilestone(uint _idMilestone)

    function rejectMilestone(uint _idMilestone)

If during the `reviewTime` of the milestone, the `reviewer` didn’t call either function the milestone will be considered approved and the `recipient` can call:

    function collectMilestonePayment(uint _idMilestone)

When the `approveCompletedMilestone` or `collectMilestonePayment` functions are called the `paymentSource` is sent the `amount` of wei and the data `payData` is executed.

## Canceling a Milestone

The `recipient` can cancel a milestone at any time if they know they will not complete the milestone.

## Arbitration

If there is a dispute between the `reviewer` and the `recipient`, the `arbitrator` (if
defined) has the power to force the payment of a milestone.

    function arbitrateApproveMilestone(uint _idMilestone)

The `arbitrator` has also the power to cancel the campaign in its entirety by calling

    function arbitrateCancelCampaign()



