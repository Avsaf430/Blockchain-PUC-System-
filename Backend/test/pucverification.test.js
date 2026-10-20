
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PUCVerification", function () {
  let puc;
  let owner;
  let centre;
  let vehicleOwner;
  let unauthorized;

  const vehicleNumber = "MH12AB1234";
  const ownerWallet = "0x1111111111111111111111111111111111111111";
  const testDate = 1792368000;
  const expiryDate = 1823904000;

  beforeEach(async function () {
    [owner, centre, vehicleOwner, unauthorized] =
      await ethers.getSigners();

    const PUCVerification = await ethers.getContractFactory(
      "PUCVerification"
    );

    puc = await PUCVerification.deploy();
    await puc.waitForDeployment();
  });

  it("should set the deployer as owner", async function () {
    expect(await puc.owner()).to.equal(owner.address);
  });

  it("should authorise the deployer initially", async function () {
    expect(
      await puc.authorisedCentres(owner.address)
    ).to.equal(true);
  });

  it("should allow the owner to authorise a PUC centre", async function () {
    await puc.authoriseCentre(centre.address);

    expect(
      await puc.authorisedCentres(centre.address)
    ).to.equal(true);
  });

  it("should allow an authorised centre to issue a certificate", async function () {
    await puc.authoriseCentre(centre.address);

    await expect(
      puc.connect(centre).issueCertificate(
        vehicleNumber,
        ownerWallet,
        testDate,
        expiryDate,
        true
      )
    )
      .to.emit(puc, "CertificateIssued")
      .withArgs(1, vehicleNumber, centre.address, true);

    const certificate = await puc.getCertificate(1);

    expect(certificate.vehicleNumber).to.equal(vehicleNumber);
    expect(certificate.ownerWallet).to.equal(ownerWallet);
    expect(certificate.testDate).to.equal(BigInt(testDate));
    expect(certificate.expiryDate).to.equal(BigInt(expiryDate));
    expect(certificate.passed).to.equal(true);
    expect(certificate.centre).to.equal(centre.address);
    expect(certificate.revoked).to.equal(false);
  });

  it("should reject certificate issuance by an unauthorised address", async function () {
    await expect(
      puc.connect(unauthorized).issueCertificate(
        vehicleNumber,
        ownerWallet,
        testDate,
        expiryDate,
        true
      )
    ).to.be.revertedWith(
      "Caller is not an authorised PUC centre"
    );
  });

  it("should reject an expiry date earlier than the test date", async function () {
    await expect(
      puc.issueCertificate(
        vehicleNumber,
        ownerWallet,
        expiryDate,
        testDate,
        true
      )
    ).to.be.revertedWith("Invalid expiry date");
  });

  it("should increment certificate IDs", async function () {
    await puc.issueCertificate(
      vehicleNumber,
      ownerWallet,
      testDate,
      expiryDate,
      true
    );

    await puc.issueCertificate(
      "MH14CD5678",
      ownerWallet,
      testDate,
      expiryDate,
      false
    );

    expect(await puc.nextCertificateId()).to.equal(3);
  });

  it("should allow the owner to revoke a certificate", async function () {
    await puc.issueCertificate(
      vehicleNumber,
      ownerWallet,
      testDate,
      expiryDate,
      true
    );

    await expect(puc.revokeCertificate(1))
      .to.emit(puc, "CertificateRevoked")
      .withArgs(1, owner.address);

    const certificate = await puc.getCertificate(1);
    expect(certificate.revoked).to.equal(true);
    expect(await puc.isCertificateValid(1)).to.equal(false);
  });

  it("should reject revocation by a non-owner", async function () {
    await puc.issueCertificate(
      vehicleNumber,
      ownerWallet,
      testDate,
      expiryDate,
      true
    );

    await expect(
      puc.connect(unauthorized).revokeCertificate(1)
    ).to.be.revertedWith("Only contract owner");
  });

  it("should reject reading a nonexistent certificate", async function () {
    await expect(
      puc.getCertificate(99)
    ).to.be.revertedWith("Certificate does not exist");
  });
});
