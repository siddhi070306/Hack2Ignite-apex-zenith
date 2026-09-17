// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TriageAnchor
 * @dev Anchors patient triage hashes on-chain to provide immutable, legally-verifiable
 * timestamps and urgency ratings for ASHA health assessments.
 */
contract TriageAnchor {

    struct AnchorRecord {
        bytes32 dataHash;      // SHA-256 hash of patient data + transcript
        uint256 timestamp;     // Timestamp of the block when anchored
        string workerId;       // Anonymized identifier of the ASHA worker
        string urgency;        // Urgency tier: RED, YELLOW, GREEN
    }

    // Mapping from unique triage transaction key to AnchorRecord
    mapping(bytes32 => AnchorRecord) public anchors;

    // Log verification events
    event TriageAnchored(
        bytes32 indexed txHash,
        bytes32 indexed dataHash,
        uint256 timestamp,
        string workerId,
        string urgency
    );

    /**
     * @notice Registers a triage record's cryptographic hash on the blockchain.
     * @param txHash Unique local transaction reference key.
     * @param dataHash Cryptographic SHA-256 hash of patient file details.
     * @param workerId Anonymized worker ID for auditing.
     * @param urgency urgency status classification.
     */
    function anchorTriage(
        bytes32 txHash,
        bytes32 dataHash,
        string calldata workerId,
        string calldata urgency
    ) external {
        require(anchors[txHash].timestamp == 0, "Record already anchored");

        anchors[txHash] = AnchorRecord({
            dataHash: dataHash,
            timestamp: block.timestamp,
            workerId: workerId,
            urgency: urgency
        });

        emit TriageAnchored(txHash, dataHash, block.timestamp, workerId, urgency);
    }

    /**
     * @notice Checks if a specific triage receipt has been anchored and returns its details.
     */
    function getAnchor(bytes32 txHash) external view returns (
        bytes32 dataHash,
        uint256 timestamp,
        string memory workerId,
        string memory urgency
    ) {
        AnchorRecord memory record = anchors[txHash];
        require(record.timestamp > 0, "Anchor not found");
        return (record.dataHash, record.timestamp, record.workerId, record.urgency);
    }
}
