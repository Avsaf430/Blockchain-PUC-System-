"use strict";

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying PUCVerification contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const PUCVerification = await ethers.getContractFactory("PUCVerification");
  const pucVerification = await PUCVerification.deploy();
  await pucVerification.waitForDeployment();

  const contractAddress = await pucVerification.getAddress();

  console.log("-----------------------------------");
  console.log("PUCVerification deployed successfully!");
  console.log("Contract address:", contractAddress);
  console.log("Owner:", await pucVerification.owner());
  console.log(
    "Initial authorised centre:",
    await pucVerification.authorisedCentres(deployer.address)
  );
  console.log("-----------------------------------");

  // Automatically update Frontend/js/blockchain.js
  try {
    const blockchainJsPath = path.join(__dirname, "../../Frontend/js/blockchain.js");

    if (fs.existsSync(blockchainJsPath)) {
      let content = fs.readFileSync(blockchainJsPath, "utf8");
      const targetRegex = /const CONTRACT_ADDRESS\s*=\s*["'][^"']*["'];/;

      if (targetRegex.test(content)) {
        content = content.replace(
          targetRegex,
          `const CONTRACT_ADDRESS = "${contractAddress}";`
        );
        fs.writeFileSync(blockchainJsPath, content, "utf8");
        console.log("✅ CONTRACT_ADDRESS automatically updated in Frontend/js/blockchain.js!");
      } else {
        console.warn("⚠️ Could not locate 'const CONTRACT_ADDRESS' in blockchain.js to update automatically.");
      }
    } else {
      console.warn("⚠️ Frontend/js/blockchain.js not found at:", blockchainJsPath);
    }
  } catch (err) {
    console.error("Failed to automatically update Frontend/js/blockchain.js:", err.message);
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
