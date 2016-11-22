pragma solidity ^0.4.4;

contract Vault {
    function authorizePayment(string description, address _recipient, uint _value, bytes _data, uint _minPayTime) returns(uint) {}
}

contract MilestoneTracker {
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

    address public recipient;
    address public donor;
    address public arbitrator;
    Vault public vault;

    enum MilestoneStatus { PendingAcceptance, NotDone, Done, Paid, Cancelled }

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

    bool campaignCancelled;


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

    function changeVault(address _newVaultAddr) onlyDonor {
        vault = Vault(_newVaultAddr);
    }


////////////
// Creation and modification of Milestones
////////////


    function proposeNewMilestone(
        string _description,
        string _url,
        uint _amount,
        address _payDestination,
        bytes _payData,
        uint _minDoneDate,
        uint _maxDoneDate,
        address _reviewer,
        uint _reviewTime
    ) onlyRecipient returns (uint) {
        uint idMilestone = milestones.length ++;
        Milestone milestone = milestones[idMilestone];
        milestone.description = _description;
        milestone.url = _url;
        milestone.amount = _amount;
        milestone.minDoneDate = _minDoneDate;
        milestone.maxDoneDate = _maxDoneDate;
        milestone.reviewer = _reviewer;
        milestone.reviewTime = _reviewTime;
        milestone.payDestination = _payDestination;
        milestone.payData = _payData;

        milestone.status = MilestoneStatus.PendingAcceptance;
        NewProposal(idMilestone);
        return idMilestone;
    }

    function acceptNewMilestoneProposal(uint _idMilestone) onlyDonor campaigNotCancelled {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if (milestone.status != MilestoneStatus.PendingAcceptance) throw;
        milestone.status = MilestoneStatus.NotDone;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }



    function milestoneCompleted(uint _idMilestone) onlyRecipient campaigNotCancelled {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if (milestone.status != MilestoneStatus.NotDone) throw;
        if (now < milestone.minDoneDate) throw;
        if (now > milestone.maxDoneDate) throw;
        milestone.status = MilestoneStatus.Done;
        milestone.doneTime = now;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }


    function approveMilestone(uint _idMilestone) campaigNotCancelled {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if ((msg.sender != milestone.reviewer) ||
            (milestone.status != MilestoneStatus.Done)) throw;

        doPayment(_idMilestone);
    }

    function disapproveMilestone(uint _idMilestone) campaigNotCancelled {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if ((msg.sender != milestone.reviewer) ||
            (milestone.status != MilestoneStatus.Done)) throw;

        milestone.status = MilestoneStatus.NotDone;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }

    function collectMilestone(uint _idMilestone) onlyRecipient campaigNotCancelled {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if  ((milestone.status != MilestoneStatus.Done) ||
             (now < milestone.doneTime + milestone.reviewTime))
            throw;

        doPayment(_idMilestone);
    }

    function cancelMilestone(uint _idMilestone) onlyRecipient campaigNotCancelled {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if  ((milestone.status != MilestoneStatus.PendingAcceptance) &&
             (milestone.status != MilestoneStatus.NotDone) &&
             (milestone.status != MilestoneStatus.Done))
            throw;

        milestone.status = MilestoneStatus.Cancelled;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }

    function forceApproveMilestone(uint _idMilestone) onlyArbitrator campaigNotCancelled {
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

    event NewProposal(uint idProposal);
    event ProposalStatusChanged(uint idProposal, MilestoneStatus newProposal);
    event CampaignCalncelled();
}
