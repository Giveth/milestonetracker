# MilestoneTracker

The MilestoneTracker is a smart contract between a `donor` and a `recipient`. It ensures that a `recipient` will get paid when they complete the approved Milestones and that the `donor` will receive the money back if a milestones is not completed. However this contract never holds funds and only signals to the Vault to send ether upon the completion of a Milestone.

After the `recipient` proposes their Milestones and the `donor` accepts them and sends the ether the recipient expects to receive to the vault, the `recipient` can work towards the Milestones with confidence that once they accomplish it, they will receive the expected amount of ether. 

For each Milestone, a `reviewer` is defined. After the `recipient` signals that they have completed the Milestone, this `reviewer` can approve or reject the Milestone’s completion. If the `reviewer` takes no action during the defined review time, the Milestone will be approved automatically.

This contract also defines an `arbitrator` who can, at any time, approve a specific milestone or cancel the full campaign. The `arbitrator` should only take action in the case that there is a dispute between the `reviewer` and the `recipient`.

All of the roles defined in this contract: `donor`, `recipient`, `reviewer` and `arbitrator` can be a regular Ethereum account, a contract like a multisig or a DAI (Decentralized Autonomous Identity).


## Constructor

The Constructor creates the MilestoneTracker contract on the blockchain with the following roles defined:

    function MilestoneTracker (
            address _arbitrator,
            address _donor,
            address _recipient
        )


_arbitrator: Address assigned to arbitrate in case of a dispute.
_donor: Address that acts in the name of the donors that are funding the completion of the Milestones, usually this will be a governance smart contract.
_recipient Address that acts in the name the recipients of the ether upon completion of each Milestone, usually this will be a simple multisig. 

## Proposing New Milestones

To add/remove/edit the `milestoneList`, the `recipient` needs to propose an entirely new list of Milestones and the `donor` will have to accept it in order for this new list to take effect.

While a new `milestoneList` is pending to be approved, the current Milestones are frozen and can not be approved to be paid.

To propose a new list, the `recipient` will call `proposeMilestones()` 

    function proposeMilestones(bytes _newMilestones)

The _newMilestones parameter is the RLP encoded list of milestones. This list will replace all the previous uncompleted and unpaid milestones.

Soon a UI will allow new milestones to be proposed easily, but for now it must be done manually.

Before actually encoding the list of Milestones, it is important to have specific details defined, as they will be needed for each Milestone:

1. description: A detailed description of the Milestone, ideally all important information is laid our transparently in this description, including the Payment Amount, the person/group receiving the payment and the requirements.

2. url: A website that has more information about this Milestone, potentially a Swarm gateway.

3. minCompletionDate: The earliest UNIX time the Milestone can be authorized for payment.

4. maxCompletionDate: The latest UNIX time the Milestone can be authorized for payment.

5. milestoneLeadLink: An address that can mark the Milestone complete along with the `recipient`. Normally this will be the address that receives payment in `payData` and the address in charge of actually completing the Milestone.  

6. reviewer: The address is in charge of rejecting or approving that the Milestone has actually been completed after the `recipient` or the `milestoneLeadLink` have marked it complete.

7. reviewTime : The number of seconds that the `reviewer` has to reject or approve the Milestone after it has been marked `Complete`. If the `reviewTime` has passed, and the `reviewer`has not done anything, the `recipient` or the `milestoneLeadLink` can call `collectMilestonePayment()` and authorize the payment.

8. paymentSource: The actual address preforming the Milestone payment. This is normally a Vault contract.

9. payData: The data actually authorizing the payment. When using the Vault contract, the expected format is:
    a. string _description: A brief description of the payment
    b. address _recipient: The address receiving the payment (usu milestoneLeadLink)
    c. uint _amount: The amount to be paid in wei
    d. uint _paymentDelay: The number of seconds the payment is to be delayed

Once those details have been decided upon, you can go the js subfolder in this repository and use milestonetacker_helper.js to encode the Milestones. 

In milestonetacker_helper.js there are the functions `milestones2bytes` and `bytes2milestones` which will enable the `recipient` to encode and decode a list of milestones.

To use you can run:

    npm install milestonestracker

And create the bytes for `_newMilestones` by filling in the appropriate variables using this template:


    milestonesTrackerHelper = require('milestonestracker');
    var now = Math.floor(new Date().getTime() / 1000);

    var reviewer = '0x12345678901234567890123456789012';
    var recipient = '0xa0123456789012345678901234567890';
    var milestoneLeadLink = '0xb1234567890123456789012345678901';
    var vault.address = '0xaabbccddeeff11223344556677889900';



    var milestonesBytes = milestonesTrackerHelper.milestones2bytes(
        {
            description: "Milestone 1: Build the web page for the campaign: 100 ETH" ,
            url: "http://mycampaign.com/milestone1",
            minCompletionDate: Math.floor(new Date('2017-01-01').getTime() /1000),
            maxCompletionDate: Math.floor(new Date('2017-02-01').getTime() /1000),
            milestoneLeadLink: milestoneLeadLink,
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
            description: "Milestone 2: SEO work: 80 ETH" ,
            url: "http://mycampaign.com/milestone2",
            minCompletionDate: Math.floor(new Date('2017-01-15').getTime() /1000),
            maxCompletionDate: Math.floor(new Date('2017-03-01').getTime() /1000),
            milestoneLeadLink: milestoneLeadLink,
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




Once the milestone is proposed by the `recipient`, the `donor` can accept the new list and replace the old list by calling:

    function acceptProposedMilestones(bytes32 hashProposals)

The `recipient` can also cancel their newly proposed milestoneList and continue with the old milestoneList by calling:

    function unproposeMilestones()


## Completing the Milestones

After the milestoneList is approved, the `recipient` can mark a Milestone as `Completed` by calling:

    function markMilestoneComplete(uint _idMilestone)

At this point, the `reviewer` assigned to this Milestone can approve or reject the Milestone by calling:

    function approveCompletedMilestone(uint _idMilestone)

    function rejectMilestone(uint _idMilestone)

If during the `reviewTime` of the Milestone, the `reviewer` didn’t call either function the Milestone will be considered approved and the `recipient` can call:

    function requestMilestonePayment(uint _idMilestone)

When the `approveCompletedMilestone()` or `requestMilestonePayment()` functions are called the `paymentSource` (usually a Vault contract) is authorized to send the payment as described by `payData` in the submitted Milestone.

## Canceling a Milestone

The `recipient` can cancel a Milestone at any time if they know they will not complete the Milestone by calling: 

    function cancelMilestone(uint _idMilestone)

## Arbitration

If there is a dispute between the `reviewer` and the `recipient`, the `arbitrator` (if defined) has the power to authorize of payment a Milestone by calling:

    function arbitrateApproveMilestone(uint _idMilestone)

The `arbitrator` also has the power to cancel the campaign in its entirety by calling:

    function arbitrateCancelCampaign()


