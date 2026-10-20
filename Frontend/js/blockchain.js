
"use strict";

/*
 * DIGITAL PUC BLOCKCHAIN DAPP
 * Ethers.js v6 + MetaMask + Ganache
 *
 * IMPORTANT:
 * This file expects a deployed contract with these functions:
 *
 * issueCertificate(string, string, uint256, uint256, bool)
 * getCertificate(uint256)
 *
 * Update the ABI and function names if your Solidity contract
 * uses a different interface.
 */

const PUCBlockchain = (() => {

    // Ganache's default local chain ID.
    const GANACHE_CHAIN_ID = 1337;

    // Replace this with your deployed contract address.
    const CONTRACT_ADDRESS = "0x2E13D54fD4236cbf3E1A71C0b8A4025907a6Bd03";

    /*
     * Minimal example ABI.
     * These function signatures must match your Solidity contract.
     *
     * Expected getCertificate return fields:
     * vehicleNumber, ownerWallet, testDate, expiryDate,
     * passed, centre, revoked
     */
    const CONTRACT_ABI = [
        "function issueCertificate(string vehicleNumber, string ownerWallet, uint256 testDate, uint256 expiryDate, bool passed) returns (uint256)",
        "function getCertificate(uint256 certificateId) view returns (string vehicleNumber, string ownerWallet, uint256 testDate, uint256 expiryDate, bool passed, address centre, bool revoked)",
        "function nextCertificateId() view returns (uint256)"
    ];

    let provider = null;
    let signer = null;
    let contract = null;
    let connectedAddress = null;

    function requireEthers() {
        if (typeof ethers === "undefined") {
            throw new Error(
                "Ethers.js is not loaded. Add the Ethers.js v6 script before blockchain.js."
            );
        }
    }

    function requireContract() {
        if (!contract) {
            throw new Error(
                "Smart contract is not connected. Connect MetaMask and configure the contract address."
            );
        }
    }

    function validAddress(address) {
        requireEthers();

        if (!ethers.isAddress(address)) {
            throw new Error("Please enter a valid Ethereum wallet address.");
        }
    }

    function validateContractAddress() {
        requireEthers();

        if (
            !ethers.isAddress(CONTRACT_ADDRESS) ||
            CONTRACT_ADDRESS === "YOUR_DEPLOYED_CONTRACT_ADDRESS"
        ) {
            throw new Error(
                "Set CONTRACT_ADDRESS to the address printed when you deploy the contract."
            );
        }
    }

    // 1. Connect MetaMask and verify the Ganache network.
    async function connectWallet() {
        requireEthers();

        if (!window.ethereum) {
            throw new Error(
                "MetaMask was not found. Install the MetaMask browser extension."
            );
        }

        provider = new ethers.BrowserProvider(window.ethereum);

        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        if (!accounts || accounts.length === 0) {
            throw new Error("No wallet account was selected.");
        }

        const network = await provider.getNetwork();

        if (Number(network.chainId) !== GANACHE_CHAIN_ID) {
            throw new Error(
                "MetaMask is connected to the wrong network. Select your local Ganache network."
            );
        }

        signer = await provider.getSigner();
        connectedAddress = await signer.getAddress();

        validateContractAddress();

        contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            CONTRACT_ABI,
            signer
        );

        return {
            address: connectedAddress,
            chainId: Number(network.chainId),
            contractAddress: CONTRACT_ADDRESS
        };
    }

    // 2. Return the currently connected wallet.
    function getConnectedAddress() {
        return connectedAddress;
    }

    // 3. Issue a PUC certificate.
    // The connected wallet must be authorized by the smart contract.
    async function issueCertificate(details) {
        requireContract();

        if (!details || !details.vehicleNumber) {
            throw new Error("Vehicle registration number is required.");
        }

        if (!details.testDate || !details.expiryDate) {
            throw new Error("Test date and expiry date are required.");
        }

        if (details.expiryDate < details.testDate) {
            throw new Error("Expiry date cannot be earlier than test date.");
        }

        const ownerWallet = details.ownerWallet || ethers.ZeroAddress;
        validAddress(ownerWallet);

        const testTimestamp = Math.floor(
            new Date(details.testDate + "T00:00:00Z").getTime() / 1000
        );

        const expiryTimestamp = Math.floor(
            new Date(details.expiryDate + "T23:59:59Z").getTime() / 1000
        );

        if (
            !Number.isFinite(testTimestamp) ||
            !Number.isFinite(expiryTimestamp)
        ) {
            throw new Error("Please enter valid certificate dates.");
        }

        const passed = details.result === "Pass";

        // MetaMask asks the authorized centre to approve the transaction.
        const transaction = await contract.issueCertificate(
            details.vehicleNumber.trim().toUpperCase(),
            ownerWallet,
            testTimestamp,
            expiryTimestamp,
            passed
        );

        const receipt = await transaction.wait();

        if (!receipt || receipt.status !== 1) {
            throw new Error("Certificate transaction failed.");
        }

        return {
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            network: "Ganache",
            message: "Certificate transaction confirmed."
        };
    }

    // 4. Verify a certificate using its numeric on-chain ID.
    async function verifyCertificate(certificateId) {
        requireContract();

        if (!/^\d+$/.test(String(certificateId))) {
            throw new Error(
                "Enter the numeric certificate ID assigned by the smart contract."
            );
        }

        const record = await contract.getCertificate(
            BigInt(certificateId)
        );

        const vehicleNumber = record.vehicleNumber ?? record[0];
        const ownerWallet = record.ownerWallet ?? record[1];
        const testDate = record.testDate ?? record[2];
        const expiryDate = record.expiryDate ?? record[3];
        const passed = record.passed ?? record[4];
        const centre = record.centre ?? record[5];
        const revoked = record.revoked ?? record[6];

        const expiryTimestamp = Number(expiryDate);

        const expiryMs = expiryTimestamp * 1000;
        const expiryValid = Number.isFinite(expiryMs) &&
            expiryMs > 0;

        const isExpired = !expiryValid || expiryMs < Date.now();

        return {
            certificateId: String(certificateId),
            vehicleNumber,
            ownerWallet,
            testDate: new Date(Number(testDate) * 1000).toISOString(),
            expiryDate: expiryValid
                ? new Date(expiryMs).toISOString()
                : null,
            passed: Boolean(passed),
            centre,
            revoked: Boolean(revoked),
            expired: isExpired,
            valid: Boolean(passed) && !isExpired && !Boolean(revoked),
            transactionNetwork: "Ganache"
        };
    }

    // 5. Read the next certificate ID, if supported by the contract.
    async function getNextCertificateId() {
        requireContract();
        return await contract.nextCertificateId();
    }

    // 6. React to MetaMask account/network changes.
    function listenForWalletChanges(callback) {
        if (!window.ethereum) return;

        window.ethereum.on("accountsChanged", () => {
            provider = null;
            signer = null;
            contract = null;
            connectedAddress = null;

            if (typeof callback === "function") {
                callback({ type: "accountsChanged" });
            }
        });

        window.ethereum.on("chainChanged", () => {
            provider = null;
            signer = null;
            contract = null;
            connectedAddress = null;

            if (typeof callback === "function") {
                callback({ type: "chainChanged" });
            }
        });
    }

    return {
        connectWallet,
        getConnectedAddress,
        issueCertificate,
        verifyCertificate,
        getNextCertificateId,
        listenForWalletChanges
    };

})();
