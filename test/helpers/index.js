const hre = require("hardhat");
const { ethers } = hre;

const QUESTION_ID = ethers.constants.HashZero;
const PARENT_COLLECTION_ID = ethers.constants.HashZero;

const getPriceFromOracle = async (oracleAddress) => {
  const ChainlinkOracle = await ethers.getContractAt(
    "IGasPriceOracle",
    oracleAddress
  );

  const oracleLatestAnswer = await ChainlinkOracle.latestAnswer();
  const oracleDecimals = await ChainlinkOracle.decimals();
  const oraclePrice =
    parseInt(oracleLatestAnswer) / Math.pow(10, parseInt(oracleDecimals));

  return oraclePrice;
};

const fromWei = (x) => ethers.utils.formatUnits(x, 18);

const getIndexSets = (outcomesCount) => {
  const range = (length) => [...Array(length)].map((x, i) => i);
  return range(outcomesCount).map((x) => 1 << x);
};

const getTokenFromFaucet = async (tokenAddress, recepient, amount) => {
  // Fetch actual Faucet
  const faucet = faucetByToken[tokenAddress.toLowerCase()];
  const faucetEthBalance = await (
    await ethers.provider.getSigner(faucet)
  ).getBalance();
  const oneEth = ethers.utils.parseEther("1");

  // Pre-fund faucet account with ETH to pay for tx fee
  if (
    faucet !== faucetByToken["0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"] &&
    faucetEthBalance.lt(oneEth)
  ) {
    // Fund faucet account with ETH
    const ethFaucet =
      faucetByToken["0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"];
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ethFaucet],
    });
    const ethFaucetSigner = await ethers.provider.getSigner(ethFaucet);
    const ethSignerBalance = await ethFaucetSigner.getBalance();
    if (ethSignerBalance.lt(oneEth))
      throw Error(`ETH Faucet has insufficient: ${tokenAddress}`);
    const ethTx = await ethFaucetSigner.sendTransaction({
      to: faucet,
      value: oneEth,
    });
    await ethTx.wait();
  }

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [faucet],
  });

  const faucetSigner = await ethers.provider.getSigner(faucet);

  const token = await ethers.getContractAt(
    [
      "function transfer(address _recepient, uint256 _amount) public",
      "function balanceOf(address _account) view returns(uint256)",
    ],
    tokenAddress,
    faucetSigner
  );

  const signerBalance = await token.balanceOf(faucet);
  if (signerBalance.lt(amount))
    throw Error(`Faucet has insufficient: ${tokenAddress}`);

  const tx = await token.connect(faucetSigner).transfer(recepient, amount);
  await tx.wait();
  const recepientBalance = await token.balanceOf(recepient);
  if (recepientBalance.lt(amount))
    throw Error(`Tranfer not succesfull: ${tokenAddress}`);
};

const createFPMM = async (
  conditionalTokens,
  user,
  token,
  amountToFund,
  initialDistribution
) => {
  const saltNonce = ethers.BigNumber.from("202089898");
  const feeFactor = ethers.BigNumber.from((3e15).toString()); // (0.3%))
  const userAddress = await user.getAddress();

  const fPMMDeterministicFactory = await ethers.getContractAt(
    hre.network.config.abis.fPMMDeterministicFactoryAbi,
    hre.network.config.addresses.fPMMDeterministicFactory
  );

  // Prepare a condition on the conditional tokens contract
  await conditionalTokens.prepareCondition(
    userAddress,
    QUESTION_ID,
    initialDistribution.length
  );

  let conditionId = await conditionalTokens.getConditionId(
    userAddress,
    QUESTION_ID,
    initialDistribution.length
  );

  // Create Fixed Point Market Maker
  const createArgs = [
    saltNonce,
    conditionalTokens.address,
    token.address,
    [conditionId],
    feeFactor,
    amountToFund,
    initialDistribution,
  ];

  const tokenBalanceWei = await token.balanceOf(userAddress);

  if (amountToFund > tokenBalanceWei) {
    throw Error(
      `User (${userAddress}) has insufficient funds of ${token.address}`
    );
  }

  await token.approve(fPMMDeterministicFactory.address, amountToFund);

  const tx = await fPMMDeterministicFactory.create2FixedProductMarketMaker(
    ...createArgs
  );
  const receipt = await tx.wait();

  let topics = fPMMDeterministicFactory.filters.FixedProductMarketMakerCreation(
    userAddress
  ).topics;

  let filter = {
    address: fPMMDeterministicFactory.address,
    blockHash: receipt.blockhash,
    topics: topics,
  };

  let logs = await user.provider.getLogs(filter);
  let log = logs.find((log) => log.transactionHash === tx.hash);
  let event = fPMMDeterministicFactory.interface.parseLog(log);

  let fixedProductMarketMaker = await ethers.getContractAt(
    hre.network.config.abis.fixedProductMarketMakerAbi,
    event.args.fixedProductMarketMaker
  );

  return fixedProductMarketMaker;
};

const getConditionIds = async (
  conditionalTokens,
  userAddress,
  tokenAddress,
  nOutcomes
) => {
  let indexSet = getIndexSets(nOutcomes);

  let positionIds = [];

  let conditionId = await conditionalTokens.getConditionId(
    userAddress,
    QUESTION_ID,
    nOutcomes
  );

  for (const index of indexSet) {
    const collectionId = await conditionalTokens.getCollectionId(
      PARENT_COLLECTION_ID,
      conditionId,
      index
    );
    const positionId = await conditionalTokens.getPositionId(
      tokenAddress,
      collectionId
    );
    positionIds.push(positionId);
  }

  return {
    positionIds: positionIds,
    conditionId: conditionId,
    parentCollectionId: PARENT_COLLECTION_ID,
  };
};

// @dev Faucet addresses must have payable fallback function
const faucetByToken = {
  // ETH
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee":
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  // DAI
  "0x6b175474e89094c44da98b954eedeac495271d0f":
    "0x2a1530C4C41db0B0b2bB646CB5Eb1A67b7158667",
  // KNC
  "0xdd974d5c2e2928dea5f71b9825b8b646686bd200":
    "0x3EB01B3391EA15CE752d01Cf3D3F09deC596F650",
  // GNO
  "0x6810e776880c02933d47db1b9fc05908e5386b96":
    "0xFBb1b73C4f0BDa4f67dcA266ce6Ef42f520fBB98",
  // REP
  "0x221657776846890989a759ba2973e427dff5c9bb":
    "0x78D196056E1F369Ec2d563aAac504EA53462B30e",
};

module.exports = {
  getPriceFromOracle,
  fromWei,
  getIndexSets,
  getTokenFromFaucet,
  createFPMM,
  getConditionIds,
};
