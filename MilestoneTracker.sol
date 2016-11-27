pragma solidity ^0.4.4;

// We use the RLP library to decode RLP
// https://github.com/androlo/standard-contracts/blob/master/contracts/src/codec/RLP.sol
import "RLP.sol";

contract MilestoneTracker {
    using RLP for RLP.RLPItem;
    using RLP for RLP.Iterator;
    using RLP for bytes;

    struct Milestone {
        string description;       // Description of the milestone
        string url;               // Ir can be a link to the swarm gateway
        uint minDoneDate;         // Minimum date that the DONE work is accepted
        uint maxDoneDate;         // Max date for the DONE work to be accepted
        address reviewer;         // Who will review the milestone
        uint reviewTime;          // How much time has the reviwer to do his job
        address payDestination;   // When milestone is acceped a call is done to
        bytes payData;            // `payDastination` with  `payData`

        MilestoneStatus status;   // Actual status of the milestone
        uint doneTime;            // Times stamp of when the milistone is DONE
    }

    // The list of all the milestones.
    Milestone[] public milestones;

    address public recipient;    // Actual recipient address
    address public donor;        // Actual donor address
    address public arbitrator;   // Actual arbitrator Address

    enum MilestoneStatus { NotDone, Done, Paid, Cancelled }

    // Truie if the campaign has been cancelled
    bool public campaignCancelled;

    // `true` if there is a pending to approve change on the milestones list
    bool public changingMilestones;

    // The pending to approve milestone list RLP encoded
    bytes public proposedMilestones;

    modifier onlyRecipient { if (msg.sender !=  recipient) throw; _; }
    modifier onlyArbitrator { if (msg.sender != arbitrator) throw; _; }
    modifier onlyDonor { if (msg.sender != donor) throw; _; }
    modifier campaignNotCancelled { if (campaignCancelled) throw; _; }
    modifier notChanging { if (changingMilestones) throw; _; }

    event NewMilestoneListProposed();
    event NewMilestoneListUnproposed();
    event NewMilestoneListAccepted();
    event ProposalStatusChanged(uint idProposal, MilestoneStatus newProposal);
    event CampaignCalncelled();


///////////
// Constuctor
///////////

    /// @notice Constructor
    /// @param _arbitrator The arbitratorº
    /// @param _donor The donor
    /// @param _recipient The recipient
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

    /// @notice Return the number of milestones including the cancelled ones.
    function numberOfMilestones() constant returns (uint) {
        return milestones.length;
    }


////////
// Change players
////////

    /// @notice Arbitrator can change the arbitrator
    /// @param _newArbitrator The new arbitrator
    function changeArbitrator(address _newArbitrator) onlyArbitrator {
        arbitrator = _newArbitrator;
    }

    /// @notice The donor can change the donor
    /// @param _newDonor The new donor
    function changeDonor(address _newDonor) onlyDonor {
        donor = _newDonor;
    }

    /// @notice The recipientn can change the recipient
    /// @param _newRecipient The new recipient
    function changeRecipient(address _newRecipient) onlyRecipient {
        recipient = _newRecipient;
    }


////////////
// Creation and modification of Milestones
////////////

    /// @notice The recipientn propose a new milestone list
    /// @param _newMilestones RLP list encoded milestones. Each mileston has
    ///   this fields:
    ///       string _description,
    ///       string _url,
    ///       address _payDestination,
    ///       bytes _payData,
    ///       uint _minDoneDate,
    ///       uint _maxDoneDate,
    ///       address _reviewer,
    ///       uint _reviewTime
    function proposeMilestones(bytes _newMilestones) onlyRecipient campaignNotCancelled {
        proposedMilestones = _newMilestones;
        changingMilestones = true;
        NewMilestoneListProposed();
    }


////////////
// Normal actions that will change the state of the milestones
////////////

    /// @notice The recipientn can cancel the proposed milestone list and
    ///  continue with the old one
    function unproposeMilestones() onlyRecipient campaignNotCancelled {
        delete proposedMilestones;
        changingMilestones = false;
        NewMilestoneListUnproposed();
    }

    /// @notice The donor accepts the milestone list
    /// @param _hashProposals sha3() of the proposed bytes that are accepted
    ///  This parameter is important for the donor to be sure which milestons
    ///  is he accepting
    function acceptProposedMilestones(bytes32 _hashProposals) onlyDonor campaignNotCancelled {

        uint i;
        if (!changingMilestones) throw;
        if (sha3(proposedMilestones) != _hashProposals) throw;

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
        NewMilestoneListAccepted();
    }

    /// @notice Recipient marks a milestone as DONE and ready to review.
    /// @param _idMilestone Id of the miletone that is marked as DONE.
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

    /// @notice The reviewer approves the milestone
    /// @param _idMilestone Id of the miletone that is approved.
    function approveMilestone(uint _idMilestone) campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if ((msg.sender != milestone.reviewer) ||
            (milestone.status != MilestoneStatus.Done)) throw;

        doPayment(_idMilestone);
    }

    /// @notice The reviewer unapproves the milestone. The milestone will change
    ///  back to the `NotDone` state
    /// @param _idMilestone Id of the miletone that is disapproved.
    function disapproveMilestone(uint _idMilestone) campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if ((msg.sender != milestone.reviewer) ||
            (milestone.status != MilestoneStatus.Done)) throw;

        milestone.status = MilestoneStatus.NotDone;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }

    /// @notice The recipient claims the milestone when the reviewer did not
    ///   review the milestone in the `reviewTime` period
    /// @param _idMilestone Id of the miletone to collect.
    function collectMilestone(uint _idMilestone) onlyRecipient campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if  ((milestone.status != MilestoneStatus.Done) ||
             (now < milestone.doneTime + milestone.reviewTime))
            throw;

        doPayment(_idMilestone);
    }

    /// @notice The recipient cancels a milestone.
    /// @param _idMilestone Id of the miletone to be cancelled.
    function cancelMilestone(uint _idMilestone) onlyRecipient campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if  ((milestone.status != MilestoneStatus.NotDone) &&
             (milestone.status != MilestoneStatus.Done))
            throw;

        milestone.status = MilestoneStatus.Cancelled;
        ProposalStatusChanged(_idMilestone, milestone.status);
    }

    /// @notice Arbitrator forces a milestone to be payed. The milestone can be
    /// in the `notDone` and `done` state.
    /// @param _idMilestone Id of the miletone tah will be payrd.
    function forceApproveMilestone(uint _idMilestone) onlyArbitrator campaignNotCancelled notChanging {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        if  ((milestone.status != MilestoneStatus.NotDone) &&
             (milestone.status != MilestoneStatus.Done))
           throw;
        doPayment(_idMilestone);
    }

    /// @notice Arbitrator cancels the campaig
    function cancelCampaign() onlyArbitrator campaignNotCancelled {
        campaignCancelled = true;
        CampaignCalncelled();
    }

    // This internal function is executed when the mailseton is approved.
    function doPayment(uint _idMilestone) internal {
        if (_idMilestone >= milestones.length) throw;
        Milestone milestone = milestones[_idMilestone];
        // Recheck again to not pay 2 times
        if (milestone.status == MilestoneStatus.Paid) throw;
        milestone.status = MilestoneStatus.Paid;
        milestone.payDestination.call.value(0)(milestone.payData);
        ProposalStatusChanged(_idMilestone, milestone.status);
    }
}
