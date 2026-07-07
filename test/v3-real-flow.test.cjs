const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("Fair Meme V3 real flow", function () {
  it("creates, reviews, and launches projects without public fake trade/lp methods", async function () {
    const [owner, admin, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FairMemeFactoryV3");
    const factory = await Factory.deploy(admin.address);
    await factory.waitForDeployment();

    const deadline = Math.floor(Date.now() / 1000) + 86400;
    const createTx = await factory.connect(user).createToken(
      "Smoke",
      "SMK",
      ethers.parseUnits("1000000", 18),
      "ipfs://smoke",
      ethers.ZeroAddress,
      deadline,
    );
    await expect(createTx).to.emit(factory, "TokenCreated");

    expect(factory.recordTrade).to.equal(undefined);
    expect(factory.addLp).to.equal(undefined);

    await expect(factory.connect(user).reviewProject(1, true, "nope")).to.be.revertedWith("ONLY_ADMIN");
    await expect(factory.connect(admin).reviewProject(1, true, "ok")).to.emit(factory, "ProjectReviewed");
    await expect(factory.connect(owner).markLaunched(1)).to.emit(factory, "ProjectLaunched");
  });

  it("locks LP and supports linear partial release with cumulative withdrawn", async function () {
    const [owner] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("FairMemeToken");
    const lp = await Token.deploy("LP", "LP", ethers.parseUnits("1000", 18), owner.address);
    const project = await Token.deploy("Project", "PRJ", ethers.parseUnits("1000", 18), owner.address);
    const Vault = await ethers.getContractFactory("LpLockVaultV3");
    const vault = await Vault.deploy();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const amount = ethers.parseUnits("100", 18);
    await lp.approve(await vault.getAddress(), amount);
    await vault.lock(await lp.getAddress(), await project.getAddress(), amount, now + 100, 1, now + 100, now + 200);

    await expect(vault.withdraw(1)).to.be.revertedWith("EMPTY");
    await network.provider.send("evm_setNextBlockTimestamp", [now + 150]);
    await network.provider.send("evm_mine");

    const releasable = await vault.releasableAmount(1);
    expect(releasable).to.equal(ethers.parseUnits("50", 18));
    await expect(vault.releaseAmount(1, ethers.parseUnits("25", 18))).to.emit(vault, "LpWithdrawn");
    const position = await vault.positions(1);
    expect(position.withdrawn).to.equal(ethers.parseUnits("25", 18));
  });

  it("deposits, reviews, and pays commission withdrawals", async function () {
    const [owner, admin, user] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("FairMemeToken");
    const token = await Token.deploy("USD", "USD", ethers.parseUnits("1000", 18), owner.address);
    const Vault = await ethers.getContractFactory("CommissionVault");
    const vault = await Vault.deploy(admin.address);

    const amount = ethers.parseUnits("10", 18);
    await token.approve(await vault.getAddress(), amount);
    await expect(vault.depositFor(user.address, await token.getAddress(), amount, "test")).to.emit(vault, "CommissionDeposited");
    await expect(vault.connect(user).requestWithdrawal(await token.getAddress(), amount)).to.emit(vault, "WithdrawalRequested");
    await expect(vault.connect(admin).reviewWithdrawal(1, true)).to.emit(vault, "WithdrawalReviewed");
    await expect(vault.connect(admin).payWithdrawal(1)).to.emit(vault, "WithdrawalPaid");
  });
});
