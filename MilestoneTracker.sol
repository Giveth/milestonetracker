pragma solidity ^0.4.4;

import "RLP.sol";

contract Vault {
    function authorizePayment(string description, address _recipient, uint _value, bytes _data, uint _minPayTime) returns(uint) {}
}

contract MilestoneTracker {
    using RLP for RLP.RLPItem;
    using RLP for RLP.Iterator;
    using RLP for bytes;


    modifier onlyRecipient { if (msg.sender !=  recipient) throw; _; }
    modifier onlyArbitrator { if (msg.sender != arbitrator) throw; _; }
    modifier onlyDonor { if (msg.sender != donor) throw; _; }

    modifier onlyDonorOrRecipient {
        if ((msg.sender != recipient) &&
            (msg.sender != donor))
            throw;
        _;
    }

    modifier campaigNotCancelled {
        if (campaignCancelled) throw;
        _;
    }

    modifier notChanging {
        if (proposingMilestones) throw;
        _;
    }

    address public recipient;
    address public donor;
    address public arbitrator;
    Vault public vault;

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

    bool public proposingMilestones;



///////////
// Constuctor
///////////


    function MilestoneTracker (
        address _arbitrator,
        address _donor,
        address _recipient,
        address _vault
    ) {
        arbitrator = _arbitrator;
        donor = _donor;
        recipient = _recipient;
        vault = Vault(_vault);
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

    function changeVault(address _newVaultAddr) onlyRecipient {
        vault = Vault(_newVaultAddr);
    }


////////////
// Creation and modification of Milestones
////////////


    /// @param _newilestones RLP list encoded milestones. Each mileston has
    ///   this fields:
    ///       string _description,
    ///       string _url,
    ///       uint _amount,
    ///       address _payDestination,
    ///       bytes _payData,
    ///       uint _minDoneDate,
    ///       uint _maxDoneDate,
    ///       address _reviewer,
    ///       uint _reviewTime

    function proposeMilestones(bytes _newilestones) onlyRecipient campaigNotCancelled {
        proposedMilestones = _newilestones;
        proposingMilestones = true;
    }

    function unproposeMilestones() onlyRecipient campaigNotCancelled {
        delete proposedMilestones;
        proposingMilestones = false;
    }

    function acceptProposedMilestones(bytes32 hashProposals) onlyDonor campaigNotCancelled {

        uint i;
        if (!proposingMilestones) throw;
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

        proposingMilestones = false;
        NewProposals();
    }

    function milestoneCompleted(uint _idMilestone) onlyRecipient campaigNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if (milestone.status != MilestoneStatus.NotDone) throw;
        if (now < milestone.minDoneDate) throw;
        if (now > milestone.maxDoneDate) throw;
        milestone.status = MilestoneStatus.Done;
        milestone.doneTime = now;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }


    function approveMilestone(uint _idMilestone) campaigNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if ((msg.sender != milestone.reviewer) ||
            (milestone.status != MilestoneStatus.Done)) throw;

        doPayment(_idMilestone);
    }

    function disapproveMilestone(uint _idMilestone) campaigNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if ((msg.sender != milestone.reviewer) ||
            (milestone.status != MilestoneStatus.Done)) throw;

        milestone.status = MilestoneStatus.NotDone;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }

    function collectMilestone(uint _idMilestone) onlyRecipient campaigNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if  ((milestone.status != MilestoneStatus.Done) ||
             (now < milestone.doneTime + milestone.reviewTime))
            throw;

        doPayment(_idMilestone);
    }

    function cancelMilestone(uint _idMilestone) onlyRecipient campaigNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if  ((milestone.status != MilestoneStatus.NotDone) &&
             (milestone.status != MilestoneStatus.Done))
            throw;

        milestone.status = MilestoneStatus.Cancelled;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }

    function forceApproveMilestone(uint _idMilestone) onlyArbitrator campaigNotCancelled notChanging {
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
        vault.authorizePayment(milestone.description, milestone.payDestination, milestone.amount, milestone.payData, 0);
        ProposalStatusChanged(_idMilestone, milestone.status);
    }

    function cancelCampaign() onlyArbitrator campaigNotCancelled {
        campaignCancelled = true;
        CampaignCalncelled();
    }

    event NewProposals();
    event ProposalStatusChanged(uint idProposal, MilestoneStatus newProposal);
    event CampaignCalncelled();
}
