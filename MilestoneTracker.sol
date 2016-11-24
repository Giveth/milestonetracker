pragma solidity ^0.4.4;

import "RLP.sol";

contract MilestoneTracker {
    using RLP for RLP.RLPItem;
    using RLP for RLP.Iterator;
    using RLP for bytes;

    modifier onlyRecipient { if (msg.sender !=  recipient) throw; _; }
    modifier onlyArbitrator { if (msg.sender != arbitrator) throw; _; }
    modifier onlyDonor { if (msg.sender != donor) throw; _; }

    modifier campaignNotCancelled {
        if (campaignCancelled) throw;
        _;
    }

    modifier notChanging {
        if (changingMilestones) throw;
        _;
    }

    address public recipient;
    address public donor;
    address public arbitrator;

    enum MilestoneStatus { NotDone, Done, Paid, Cancelled }

    struct Milestone {
        string description;
        string url;
        uint amount;
        uint minDoneDate;
        uint maxDoneDate;
        address reviewer;
        uint reviewTime;
        address payDestination;
        bytes payData;

        MilestoneStatus status;
        uint doneTime;
    }

    Milestone[] public milestones;

    bool public campaignCancelled;

    bytes public proposedMilestones;

    bool public changingMilestones;



///////////
// Constuctor
///////////


    function MilestoneTracker (
        address _arbitrator,
        address _donor,
        address _recipient
    ) {
        arbitrator = _arbitrator;
        donor = _donor;
        recipient = _recipient;
    }


/////////
// Helper functions
/////////

    function numberOfMilestones() constant returns (uint) {
        return milestones.length;
    }



////////
// Change players
////////

    function changeArbitrator(address _newArbitrator) onlyArbitrator {
        arbitrator = _newArbitrator;
    }

    function changeDonor(address _newDonor) onlyDonor {
        donor = _newDonor;
    }

    function changeRecipient(address _newRecipient) onlyRecipient {
        recipient = _newRecipient;
    }


////////////
// Creation and modification of Milestones
////////////


    // @param _newMilestones RLP list encoded milestones. Each mileston has
    //   this fields:
    //       string _description,
    //       string _url,
    //       uint _amount,
    //       address _payDestination,
    //       bytes _payData,
    //       uint _minDoneDate,
    //       uint _maxDoneDate,
    //       address _reviewer,
    //       uint _reviewTime

    function proposeMilestones(bytes _newilestones) onlyRecipient campaignNotCancelled {
        proposedMilestones = _newilestones;
        changingMilestones = true;
    }

    function unproposeMilestones() onlyRecipient campaignNotCancelled {
        delete proposedMilestones;
        changingMilestones = false;
    }

    function acceptProposedMilestones(bytes32 hashProposals) onlyDonor campaignNotCancelled {

        uint i;
        if (!changingMilestones) throw;
        if (sha3(proposedMilestones) != hashProposals) throw;

        // Cancel all not finished milestones until now
        for (i=0; i<milestones.length; i++) {
            if (milestones[i].status != MilestoneStatus.Paid) {
                milestones[i].status = MilestoneStatus.Cancelled;
            }
        }

        bytes memory mProposedMilestones = proposedMilestones;

        var itmProposals = mProposedMilestones.toRLPItem(true);

        if (!itmProposals.isList()) throw;

        var itrProposals = itmProposals.iterator();

        while(itrProposals.hasNext()) {


            var itmProposal = itrProposals.next();

            Milestone milestone = milestones[milestones.length ++];

            if (!itmProposal.isList()) throw;

            var itrProposal = itmProposal.iterator();

            milestone.description = itrProposal.next().toAscii();
            milestone.url = itrProposal.next().toAscii();
            milestone.amount = itrProposal.next().toUint();
            milestone.minDoneDate = itrProposal.next().toUint();
            milestone.maxDoneDate = itrProposal.next().toUint();
            milestone.reviewer = itrProposal.next().toAddress();
            milestone.reviewTime = itrProposal.next().toUint();
            milestone.payDestination = itrProposal.next().toAddress();
            milestone.payData = itrProposal.next().toData();

            milestone.status = MilestoneStatus.NotDone;

        }

        delete proposedMilestones;
        changingMilestones = false;
        NewProposals();
    }

    function milestoneCompleted(uint _idMilestone) onlyRecipient campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if (milestone.status != MilestoneStatus.NotDone) throw;
        if (now < milestone.minDoneDate) throw;
        if (now > milestone.maxDoneDate) throw;
        milestone.status = MilestoneStatus.Done;
        milestone.doneTime = now;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }


    function approveMilestone(uint _idMilestone) campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if ((msg.sender != milestone.reviewer) ||
            (milestone.status != MilestoneStatus.Done)) throw;

        doPayment(_idMilestone);
    }

    function disapproveMilestone(uint _idMilestone) campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if ((msg.sender != milestone.reviewer) ||
            (milestone.status != MilestoneStatus.Done)) throw;

        milestone.status = MilestoneStatus.NotDone;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }

    function collectMilestone(uint _idMilestone) onlyRecipient campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if  ((milestone.status != MilestoneStatus.Done) ||
             (now < milestone.doneTime + milestone.reviewTime))
            throw;

        doPayment(_idMilestone);
    }

    function cancelMilestone(uint _idMilestone) onlyRecipient campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if  ((milestone.status != MilestoneStatus.NotDone) &&
             (milestone.status != MilestoneStatus.Done))
            throw;

        milestone.status = MilestoneStatus.Cancelled;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }

    function forceApproveMilestone(uint _idMilestone) onlyArbitrator campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if  ((milestone.status != MilestoneStatus.NotDone) &&
             (milestone.status != MilestoneStatus.Done))
           throw;
        doPayment(_idMilestone);
    }

    function doPayment(uint _idMilestone) internal {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        // Recheck again to not pay 2 times
        if (milestone.status == MilestoneStatus.Paid) throw;
        milestone.status = MilestoneStatus.Paid;
        milestone.payDestination.call.value(milestone.amount)(milestone.payData);
        ProposalStatusChanged(_idMilestone, milestone.status);
    }

    function cancelCampaign() onlyArbitrator campaignNotCancelled {
        campaignCancelled = true;
        CampaignCalncelled();
    }

    event NewProposals();
    event ProposalStatusChanged(uint idProposal, MilestoneStatus newProposal);
    event CampaignCalncelled();
}
