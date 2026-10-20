
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PUCVerification {
    address public owner;
    uint256 public nextCertificateId = 1;

    struct Certificate {
        string vehicleNumber;
        string ownerWallet;
        uint256 testDate;
        uint256 expiryDate;
        bool passed;
        address centre;
        bool revoked;
    }

    mapping(uint256 => Certificate) private certificates;
    mapping(address => bool) public authorisedCentres;

    event CentreAuthorised(address indexed centre, bool authorised);

    event CertificateIssued(
        uint256 indexed certificateId,
        string vehicleNumber,
        address indexed centre,
        bool passed
    );

    event CertificateRevoked(
        uint256 indexed certificateId,
        address indexed revokedBy
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner");
        _;
    }

    modifier onlyAuthorisedCentre() {
        require(
            authorisedCentres[msg.sender],
            "Caller is not an authorised PUC centre"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        authorisedCentres[msg.sender] = true;

        emit CentreAuthorised(msg.sender, true);
    }

    function authoriseCentre(address centre) external onlyOwner {
        require(centre != address(0), "Invalid centre address");

        authorisedCentres[centre] = true;
        emit CentreAuthorised(centre, true);
    }

    function removeCentre(address centre) external onlyOwner {
        require(centre != address(0), "Invalid centre address");

        authorisedCentres[centre] = false;
        emit CentreAuthorised(centre, false);
    }

    function issueCertificate(
        string calldata vehicleNumber,
        string calldata ownerWallet,
        uint256 testDate,
        uint256 expiryDate,
        bool passed
    ) external onlyAuthorisedCentre returns (uint256) {
        require(bytes(vehicleNumber).length > 0, "Vehicle number required");
        require(bytes(ownerWallet).length > 0, "Owner wallet required");
        require(testDate > 0, "Invalid test date");
        require(expiryDate >= testDate, "Invalid expiry date");

        uint256 certificateId = nextCertificateId++;

        certificates[certificateId] = Certificate({
            vehicleNumber: vehicleNumber,
            ownerWallet: ownerWallet,
            testDate: testDate,
            expiryDate: expiryDate,
            passed: passed,
            centre: msg.sender,
            revoked: false
        });

        emit CertificateIssued(
            certificateId,
            vehicleNumber,
            msg.sender,
            passed
        );

        return certificateId;
    }

    function getCertificate(
        uint256 certificateId
    )
        external
        view
        returns (
            string memory vehicleNumber,
            string memory ownerWallet,
            uint256 testDate,
            uint256 expiryDate,
            bool passed,
            address centre,
            bool revoked
        )
    {
        require(
            certificateId > 0 && certificateId < nextCertificateId,
            "Certificate does not exist"
        );

        Certificate storage certificate = certificates[certificateId];

        return (
            certificate.vehicleNumber,
            certificate.ownerWallet,
            certificate.testDate,
            certificate.expiryDate,
            certificate.passed,
            certificate.centre,
            certificate.revoked
        );
    }

    function revokeCertificate(
        uint256 certificateId
    ) external onlyOwner {
        require(
            certificateId > 0 && certificateId < nextCertificateId,
            "Certificate does not exist"
        );

        Certificate storage certificate = certificates[certificateId];

        require(!certificate.revoked, "Already revoked");

        certificate.revoked = true;

        emit CertificateRevoked(certificateId, msg.sender);
    }

    function isCertificateValid(
        uint256 certificateId
    ) external view returns (bool) {
        if (
            certificateId == 0 ||
            certificateId >= nextCertificateId
        ) {
            return false;
        }

        Certificate storage certificate = certificates[certificateId];

        return (
            !certificate.revoked &&
            certificate.passed &&
            certificate.expiryDate >= block.timestamp
        );
    }
}
