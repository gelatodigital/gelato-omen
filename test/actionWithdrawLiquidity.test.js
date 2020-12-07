const { BigNumber } = require("ethers");
const { expect } = require("chai");
const hre = require("hardhat");
const erc20 = require("@studydefi/money-legos/erc20");
const uniswap = require("@studydefi/money-legos/uniswap");

// Gelato
const gelato = require("@gelatonetwork/core");

// CPK
const CPK = require("contract-proxy-kit");

const { deployments, ethers } = hre;
const { fromWei, getIndexSets } = require("./helpers");

// CONSTANTS
const GAS_LIMIT = 5000000;
const INITIAL_FUNDS = ethers.utils.parseUnits("500", "18");
// // Conditional Tokens
const NUM_OUTCOMES = 10;
const QUESTION_ID = ethers.constants.HashZero;
const PARENT_COLLECTION_ID = ethers.constants.HashZero;

describe("ActionWithdrawLiquidity.sol test", function () {
  this.timeout(0);

  let wallet;
  let admin;
  let conditionalTokens;
  let fPMMDeterministicFactory;
  let dai;
  let gno;
  let rep;
  let fixedProductMarketMakerDai;
  let fixedProductMarketMakerGno;
  let fixedProductMarketMakerRep;
  let gelatoCore;
  let cpk;
  let taskSubmitTxReceipt;
  let conditionIdDai;
  let conditionIdGno;
  let conditionIdRep;
  let executionTime;
  let actionLiquidityWithdraw;
  let daiExchangeContract;
  let provider;
  let task;
  let taskReceipt;
  let providerAddress;

  before(async () => {
    [wallet] = await ethers.getSigners();

    // Unlock Gelato Provider
    provider = await ethers.provider.getSigner(
      hre.network.config.addresses.externalProvider
    );
    providerAddress = await provider.getAddress();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [providerAddress],
    });
    // Unlock Gelato Provider END

    admin = await wallet.getAddress();

    // Deploy ActionWithdrawLiquidity and OracleAggregator
    await deployments.fixture();

    actionLiquidityWithdraw = await ethers.getContract(
      "ActionWithdrawLiquidity"
    );

    conditionalTokens = await ethers.getContractAt(
      hre.network.config.abis.conditionalTokensAbi,
      hre.network.config.addresses.conditionalTokens
    );

    dai = await ethers.getContractAt(erc20.dai.abi, erc20.dai.address);
    gno = await ethers.getContractAt(
      erc20.dai.abi,
      hre.network.config.addresses.erc20.GNO
    );
    rep = await ethers.getContractAt(
      erc20.dai.abi,
      hre.network.config.addresses.erc20.REP
    );

    fPMMDeterministicFactory = await ethers.getContractAt(
      hre.network.config.abis.fPMMDeterministicFactoryAbi,
      hre.network.config.addresses.fPMMDeterministicFactory
    );

    gelatoCore = await ethers.getContractAt(
      gelato.GelatoCore.abi,
      hre.network.config.addresses.gelatoCore
    );

    cpk = await CPK.create({
      ethers,
      signer: wallet,
      networks: {
        1337: {
          masterCopyAddress: hre.network.config.addresses.masterCopyAddress,
          proxyFactoryAddress: hre.network.config.addresses.proxyFactoryAddress,
          multiSendAddress: hre.network.config.addresses.multiSendAddress,
          fallbackHandlerAddress:
            hre.network.config.addresses.fallbackHandlerAddress,
        },
      },
    });
  });

  it("Buy Tokens from Uniswap", async () => {
    // 1. instantiate contracts
    const uniswapFactoryContract = await ethers.getContractAt(
      uniswap.factory.abi,
      uniswap.factory.address,
      wallet
    );

    const daiExchangeAddress = await uniswapFactoryContract.getExchange(
      dai.address,
      {
        gasLimit: GAS_LIMIT,
      }
    );

    daiExchangeContract = await ethers.getContractAt(
      uniswap.exchange.abi,
      daiExchangeAddress,
      wallet
    );

    // 2. do the actual swapping for DAI
    await daiExchangeContract.ethToTokenSwapOutput(
      INITIAL_FUNDS.mul(BigNumber.from("2")), // min amount of token retrieved
      2525644800, // random timestamp in the future (year 2050)
      {
        gasLimit: GAS_LIMIT,
        value: ethers.utils.parseEther("50"),
      }
    );

    // 3. check DAI balance
    const daiBalanceWei = await dai.balanceOf(wallet.address, {
      gasLimit: GAS_LIMIT,
    });

    const daiBalance = parseFloat(fromWei(daiBalanceWei));
    expect(daiBalance).to.be.gt(0);

    // Repeat steps for GNO
    const gnoExchangeAddress = await uniswapFactoryContract.getExchange(
      gno.address,
      {
        gasLimit: GAS_LIMIT,
      }
    );

    let gnoExchangeContract = await ethers.getContractAt(
      uniswap.exchange.abi,
      gnoExchangeAddress,
      wallet
    );

    await gnoExchangeContract.ethToTokenSwapOutput(
      ethers.utils.parseEther("10").toString(),
      2525644800,
      {
        gasLimit: GAS_LIMIT,
        value: ethers.utils.parseEther("300").toString(),
      }
    );

    const gnoBalanceWei = await gno.balanceOf(wallet.address, {
      gasLimit: GAS_LIMIT,
    });
    const gnoBalance = parseFloat(fromWei(gnoBalanceWei));
    expect(gnoBalance).to.be.gte(
      parseFloat(fromWei(ethers.utils.parseEther("10")))
    );

    // Repeat steps for REP
    const repExchangeAddress = await uniswapFactoryContract.getExchange(
      rep.address,
      {
        gasLimit: GAS_LIMIT,
      }
    );

    let repExchangeContract = await ethers.getContractAt(
      uniswap.exchange.abi,
      repExchangeAddress,
      wallet
    );

    await repExchangeContract.ethToTokenSwapOutput(
      ethers.utils.parseEther("200").toString(),
      2525644800,
      {
        gasLimit: GAS_LIMIT,
        value: ethers.utils.parseEther("300").toString(),
      }
    );

    const repBalanceWei = await rep.balanceOf(wallet.address, {
      gasLimit: GAS_LIMIT,
    });
    const repBalance = parseFloat(fromWei(repBalanceWei));
    expect(repBalance).to.be.gte(
      parseFloat(fromWei(ethers.utils.parseEther("200")))
    );
  });

  it("Create fixed product market makers", async () => {
    // 1. Prepare a condition on the conditional tokens contract
    await conditionalTokens.prepareCondition(admin, QUESTION_ID, NUM_OUTCOMES, {
      gasLimit: GAS_LIMIT,
    });

    conditionIdDai = await conditionalTokens.getConditionId(
      admin,
      QUESTION_ID,
      NUM_OUTCOMES,
      {
        gasLimit: GAS_LIMIT,
      }
    );

    // Create Fixed Point Market Maker
    const saltNonce = BigNumber.from("202089898");
    const feeFactor = BigNumber.from((3e15).toString()); // (0.3%))
    const initialDistribution = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const createArgs = [
      saltNonce,
      conditionalTokens.address,
      dai.address,
      [conditionIdDai],
      feeFactor,
      INITIAL_FUNDS,
      initialDistribution,
    ];

    const daiBalanceWei = await dai.balanceOf(wallet.address, {
      gasLimit: GAS_LIMIT,
    });

    expect(parseFloat(fromWei(daiBalanceWei))).to.be.gte(
      parseFloat(fromWei(INITIAL_FUNDS))
    );

    await dai.approve(fPMMDeterministicFactory.address, INITIAL_FUNDS, {
      gasLimit: GAS_LIMIT,
    });

    const tx = await fPMMDeterministicFactory.create2FixedProductMarketMaker(
      ...createArgs,
      { gasLimit: 6000000 }
    );

    const receipt = await tx.wait();

    let topics = fPMMDeterministicFactory.filters.FixedProductMarketMakerCreation(
      admin
    ).topics;

    let filter = {
      address: fPMMDeterministicFactory.address,
      blockHash: receipt.blockhash,
      topics: topics,
    };

    let iface = new ethers.utils.Interface(
      hre.network.config.abis.fPMMDeterministicFactoryAbi
    );

    let logs = await wallet.provider.getLogs(filter);
    let log = logs.find((log) => log.transactionHash === tx.hash);
    let event = iface.parseLog(log);

    fixedProductMarketMakerDai = await ethers.getContractAt(
      hre.network.config.abis.fixedProductMarketMakerAbi,
      event.args.fixedProductMarketMaker
    );

    // Repeat process
    await conditionalTokens.prepareCondition(admin, QUESTION_ID, 2, {
      gasLimit: GAS_LIMIT,
    });

    conditionIdGno = await conditionalTokens.getConditionId(
      admin,
      QUESTION_ID,
      2,
      {
        gasLimit: GAS_LIMIT,
      }
    );

    const saltNonce_2 = BigNumber.from("202089897");
    const initialDistribution_2 = [2, 1];
    const createArgs_2 = [
      saltNonce_2,
      conditionalTokens.address,
      gno.address,
      [conditionIdGno],
      feeFactor,
      ethers.utils.parseEther("5"),
      initialDistribution_2,
    ];

    const gnoBalanceWei = await gno.balanceOf(wallet.address, {
      gasLimit: GAS_LIMIT,
    });

    expect(parseFloat(fromWei(gnoBalanceWei))).to.be.gte(
      parseFloat(fromWei(ethers.utils.parseEther("5")))
    );

    await gno.approve(
      fPMMDeterministicFactory.address,
      ethers.utils.parseEther("5"),
      {
        gasLimit: GAS_LIMIT,
      }
    );

    const tx_2 = await fPMMDeterministicFactory.create2FixedProductMarketMaker(
      ...createArgs_2,
      { gasLimit: 6000000 }
    );

    const receipt_2 = await tx_2.wait();

    topics = fPMMDeterministicFactory.filters.FixedProductMarketMakerCreation(
      admin
    ).topics;

    filter = {
      address: fPMMDeterministicFactory.address,
      blockHash: receipt_2.blockhash,
      topics: topics,
    };

    logs = await wallet.provider.getLogs(filter);
    log = logs.find((log) => log.transactionHash === tx_2.hash);
    event = iface.parseLog(log);

    fixedProductMarketMakerGno = await ethers.getContractAt(
      hre.network.config.abis.fixedProductMarketMakerAbi,
      event.args.fixedProductMarketMaker
    );

    // Repeat process
    await conditionalTokens.prepareCondition(admin, QUESTION_ID, 4, {
      gasLimit: GAS_LIMIT,
    });

    conditionIdRep = await conditionalTokens.getConditionId(
      admin,
      QUESTION_ID,
      4,
      {
        gasLimit: GAS_LIMIT,
      }
    );

    const saltNonce_3 = BigNumber.from("202089896");
    const initialDistribution_3 = [4, 3, 2, 1];
    const createArgs_3 = [
      saltNonce_3,
      conditionalTokens.address,
      rep.address,
      [conditionIdRep],
      feeFactor,
      ethers.utils.parseEther("100"),
      initialDistribution_3,
    ];

    const repBalanceWei = await rep.balanceOf(wallet.address, {
      gasLimit: GAS_LIMIT,
    });

    expect(parseFloat(fromWei(repBalanceWei))).to.be.gte(
      parseFloat(fromWei(ethers.utils.parseEther("100")))
    );

    await rep.approve(
      fPMMDeterministicFactory.address,
      ethers.utils.parseEther("100"),
      {
        gasLimit: GAS_LIMIT,
      }
    );

    const tx_3 = await fPMMDeterministicFactory.create2FixedProductMarketMaker(
      ...createArgs_3,
      { gasLimit: 6000000 }
    );

    const receipt_3 = await tx_3.wait();

    topics = fPMMDeterministicFactory.filters.FixedProductMarketMakerCreation(
      admin
    ).topics;

    filter = {
      address: fPMMDeterministicFactory.address,
      blockHash: receipt_3.blockhash,
      topics: topics,
    };

    logs = await wallet.provider.getLogs(filter);
    log = logs.find((log) => log.transactionHash === tx_3.hash);
    event = iface.parseLog(log);

    fixedProductMarketMakerRep = await ethers.getContractAt(
      hre.network.config.abis.fixedProductMarketMakerAbi,
      event.args.fixedProductMarketMaker
    );
  });

  it("Fund User Proxy with Tokens", async () => {
    // 1. Fund Proxy with DAI
    await dai.transfer(cpk.address, INITIAL_FUNDS);
    const proxyDaiBalance = await dai.balanceOf(cpk.address);

    // Proxy should have initial Funds DAI
    expect(parseFloat(fromWei(proxyDaiBalance))).to.be.gte(
      parseFloat(fromWei(INITIAL_FUNDS))
    );

    // 2. Fund Proxy with GNO
    await gno.transfer(cpk.address, ethers.utils.parseEther("5"));
    const proxyGnoBalance = await gno.balanceOf(cpk.address);

    expect(parseFloat(fromWei(proxyGnoBalance))).to.be.gte(
      parseFloat(fromWei(ethers.utils.parseEther("5")))
    );

    // 3. Fund Proxy with REP
    await rep.transfer(cpk.address, ethers.utils.parseEther("100"));
    const proxyRepBalance = await rep.balanceOf(cpk.address);

    expect(parseFloat(fromWei(proxyRepBalance))).to.be.gte(
      parseFloat(fromWei(ethers.utils.parseEther("100")))
    );
  });

  it("Add Funding via User Proxy", async () => {
    let iface = new ethers.utils.Interface([
      "function approve(address,uint256)",
      "function addFunding(uint256,uint256[])",
    ]);

    const approveTx = await cpk.execTransactions(
      [
        {
          to: dai.address,
          operation: CPK.CALL,
          value: 0,
          data: iface.encodeFunctionData("approve", [
            fixedProductMarketMakerDai.address,
            INITIAL_FUNDS,
          ]),
        },
      ],
      {
        value: 0,
        gasLimit: 5000000,
      }
    );

    await approveTx.transactionResponse.wait();

    const approveTx_2 = await cpk.execTransactions(
      [
        {
          to: gno.address,
          operation: CPK.CALL,
          value: 0,
          data: iface.encodeFunctionData("approve", [
            fixedProductMarketMakerGno.address,
            ethers.utils.parseEther("5"),
          ]),
        },
      ],
      {
        value: 0,
        gasLimit: 5000000,
      }
    );

    await approveTx_2.transactionResponse.wait();

    const approveTx_3 = await cpk.execTransactions(
      [
        {
          to: rep.address,
          operation: CPK.CALL,
          value: 0,
          data: iface.encodeFunctionData("approve", [
            fixedProductMarketMakerRep.address,
            ethers.utils.parseEther("100"),
          ]),
        },
      ],
      {
        value: 0,
        gasLimit: 5000000,
      }
    );

    await approveTx_3.transactionResponse.wait();

    const addFundingTx = await cpk.execTransactions(
      [
        {
          to: fixedProductMarketMakerDai.address,
          operation: CPK.CALL,
          value: 0,
          data: iface.encodeFunctionData("addFunding", [INITIAL_FUNDS, []]),
        },
      ],
      {
        value: 0,
        gasLimit: 5000000,
      }
    );

    await addFundingTx.transactionResponse.wait();

    const addFundingTx_2 = await cpk.execTransactions(
      [
        {
          to: fixedProductMarketMakerGno.address,
          operation: CPK.CALL,
          value: 0,
          data: iface.encodeFunctionData("addFunding", [
            ethers.utils.parseEther("5"),
            [],
          ]),
        },
      ],
      {
        value: 0,
        gasLimit: 5000000,
      }
    );

    await addFundingTx_2.transactionResponse.wait();

    const addFundingTx_3 = await cpk.execTransactions(
      [
        {
          to: fixedProductMarketMakerRep.address,
          operation: CPK.CALL,
          value: 0,
          data: iface.encodeFunctionData("addFunding", [
            ethers.utils.parseEther("100"),
            [],
          ]),
        },
      ],
      {
        value: 0,
        gasLimit: 5000000,
      }
    );

    await addFundingTx_3.transactionResponse.wait();

    const liquidityPoolTokenBalanceDai = await fixedProductMarketMakerDai.balanceOf(
      cpk.address
    );
    const liquidityPoolTokenBalanceGno = await fixedProductMarketMakerGno.balanceOf(
      cpk.address
    );
    const liquidityPoolTokenBalanceRep = await fixedProductMarketMakerRep.balanceOf(
      cpk.address
    );

    // Proxy should have initial Funds LP Tplens
    expect(parseFloat(fromWei(liquidityPoolTokenBalanceDai))).to.be.eq(
      parseFloat(fromWei(INITIAL_FUNDS))
    );
    expect(parseFloat(fromWei(liquidityPoolTokenBalanceGno))).to.be.eq(
      parseFloat(fromWei(ethers.utils.parseEther("5")))
    );
    expect(parseFloat(fromWei(liquidityPoolTokenBalanceRep))).to.be.eq(
      parseFloat(fromWei(ethers.utils.parseEther("100")))
    );
  });

  it("Test ActionWithdrawLiquidity directly via Proxy", async () => {
    const liquidityActionArtifact = hre.artifacts.readArtifactSync(
      "ActionWithdrawLiquidity"
    );

    let ifaceActionLiquidityWithdraw = new ethers.utils.Interface(
      liquidityActionArtifact.abi
    );

    let indexSet = getIndexSets(2);

    let positionIds = [];

    for (const index of indexSet) {
      const collectionId = await conditionalTokens.getCollectionId(
        PARENT_COLLECTION_ID,
        conditionIdGno,
        index
      );
      const positionId = await conditionalTokens.getPositionId(
        gno.address,
        collectionId
      );
      positionIds.push(positionId);
    }

    const actionLiquidityWithdrawGnoInputs = [
      conditionalTokens.address,
      fixedProductMarketMakerGno.address,
      positionIds,
      conditionIdGno,
      PARENT_COLLECTION_ID,
      gno.address,
      wallet.address,
    ];

    let gnoWeiBalanceBefore = await gno.balanceOf(wallet.address);

    // Test ActionWithdrawLiquidity with GNO (uses fallback Uniswap oracle)
    const actionTestTx = await cpk.execTransactions(
      [
        {
          to: actionLiquidityWithdraw.address,
          operation: CPK.DELEGATECALL,
          value: 0,
          data: ifaceActionLiquidityWithdraw.encodeFunctionData(
            "action",
            actionLiquidityWithdrawGnoInputs
          ),
        },
      ],
      {
        value: 0,
        gasLimit: 5000000,
      }
    );

    await actionTestTx.transactionResponse.wait();

    let gnoWeiBalanceAfter = await gno.balanceOf(wallet.address);
    expect(parseFloat(fromWei(gnoWeiBalanceBefore))).to.be.lt(
      parseFloat(fromWei(gnoWeiBalanceAfter))
    );

    indexSet = getIndexSets(4);

    positionIds = [];

    for (const index of indexSet) {
      const collectionId = await conditionalTokens.getCollectionId(
        PARENT_COLLECTION_ID,
        conditionIdRep,
        index
      );
      const positionId = await conditionalTokens.getPositionId(
        rep.address,
        collectionId
      );
      positionIds.push(positionId);
    }

    const actionLiquidityWithdrawRepInputs = [
      conditionalTokens.address,
      fixedProductMarketMakerRep.address,
      positionIds,
      conditionIdRep,
      PARENT_COLLECTION_ID,
      rep.address,
      wallet.address,
    ];

    let repWeiBalanceBefore = await rep.balanceOf(wallet.address);

    // Test ActionWithdrawLiquidity with REP (uses chainlink OracleAggregator)
    const actionTestTx_2 = await cpk.execTransactions(
      [
        {
          to: actionLiquidityWithdraw.address,
          operation: CPK.DELEGATECALL,
          value: 0,
          data: ifaceActionLiquidityWithdraw.encodeFunctionData(
            "action",
            actionLiquidityWithdrawRepInputs
          ),
        },
      ],
      {
        value: 0,
        gasLimit: 5000000,
      }
    );

    await actionTestTx_2.transactionResponse.wait();

    let repWeiBalanceAfter = await rep.balanceOf(wallet.address);
    expect(parseFloat(fromWei(repWeiBalanceBefore))).to.be.lt(
      parseFloat(fromWei(repWeiBalanceAfter))
    );
  });

  it("Wallet becomes executor on gelato", async () => {
    const minExecutorStake = await gelatoCore.minExecutorStake();
    await gelatoCore.stakeExecutor({
      value: minExecutorStake,
      gasLimit: GAS_LIMIT,
    });
  });

  it("Random User buys outcome tokens", async () => {
    // Fund Random User With ETH
    await wallet.sendTransaction({
      to: providerAddress,
      value: ethers.utils.parseEther("100"),
      gasLimit: GAS_LIMIT,
    });

    let daiBalanceWeiBefore = await dai.balanceOf(providerAddress);

    // Random User buys DAI
    const daiAmountToBuy = ethers.utils.parseEther("4");
    daiExchangeContract = daiExchangeContract.connect(provider);
    const swapTx = await daiExchangeContract.ethToTokenSwapOutput(
      daiAmountToBuy, // min amount of token retrieved
      2525644800, // random timestamp in the future (year 2050)
      {
        gasLimit: GAS_LIMIT,
        value: ethers.utils.parseEther("4"),
      }
    );
    await swapTx.wait();

    let daiBalanceWeiAfter = await dai.balanceOf(providerAddress);

    let actualDaiReceived = daiBalanceWeiAfter.sub(daiBalanceWeiBefore);

    expect(daiBalanceWeiAfter).to.be.gt(0);

    // Now random user buys outcome tokens
    const outcomeIndex = 2;
    const buyAmount = await fixedProductMarketMakerDai.calcBuyAmount(
      actualDaiReceived,
      outcomeIndex
    );

    const approveTx = await dai
      .connect(provider)
      .approve(fixedProductMarketMakerDai.address, actualDaiReceived);
    await approveTx.wait();

    const buyConditionalTokenTx = await fixedProductMarketMakerDai
      .connect(provider)
      .buy(actualDaiReceived, outcomeIndex, buyAmount);
    await buyConditionalTokenTx.wait();

    // Should have 0 DAI
    let daiBalanceWeiAfter2 = await dai.balanceOf(providerAddress, {
      gasLimit: GAS_LIMIT,
    });

    expect(daiBalanceWeiAfter2).to.be.eq(daiBalanceWeiBefore);

    // Should have buyAmount Specific conditional token balance
    const indexSet = getIndexSets(NUM_OUTCOMES);
    const positionIds = [];
    const addresses = [];
    for (const index of indexSet) {
      const collectionId = await conditionalTokens.getCollectionId(
        PARENT_COLLECTION_ID,
        conditionIdDai,
        index
      );
      const positionId = await conditionalTokens.getPositionId(
        dai.address,
        collectionId
      );
      positionIds.push(positionId);
      addresses.push(providerAddress);
    }

    const conditionalTokenBalances = await conditionalTokens.balanceOfBatch(
      addresses,
      positionIds
    );

    expect(
      parseFloat(fromWei(conditionalTokenBalances[outcomeIndex]))
    ).to.be.eq(parseFloat(fromWei(buyAmount)));

    // // Re connect to old account
    fixedProductMarketMakerDai.connect(wallet);
    dai.connect(wallet);
  });

  it("Submit Task On Gelato", async () => {
    let ifaceGelato = new ethers.utils.Interface(gelato.GelatoCore.abi);
    let ifaceGnoSafe = new ethers.utils.Interface([
      "function enableModule(address)",
    ]);
    // let ifaceFixedProductMarketMaker = new ethers.utils.Interface([
    //   "function removeFunding(uint256)",
    // ]);
    const liquidityActionArtifact = hre.artifacts.readArtifactSync(
      "ActionWithdrawLiquidity"
    );
    let ifaceActionLiquidityWithdraw = new ethers.utils.Interface(
      liquidityActionArtifact.abi
    );

    // Send some ETH To Proxy
    await wallet.sendTransaction({
      to: cpk.address,
      value: ethers.utils.parseEther("1"),
      gasLimit: GAS_LIMIT,
    });

    // const proxyEtherBalance = await wallet.provider.getBalance(cpk.address);

    const enableModuleTx = await cpk.execTransactions(
      [
        {
          to: cpk.address,
          operation: CPK.CALL,
          value: 0,
          data: ifaceGnoSafe.encodeFunctionData("enableModule", [
            gelatoCore.address,
          ]),
        },
      ],
      {
        gasLimit: 5000000,
      }
    );

    await enableModuleTx.transactionResponse.wait();

    const myGelatoProvider = {
      addr: providerAddress,
      module: hre.network.config.addresses.gnosisSafeProviderModule,
    };

    const block = await wallet.provider.getBlock();

    executionTime = block.timestamp + 5 * 60; // 5 minutes

    const timeCondition = new gelato.Condition({
      inst: hre.network.config.addresses.timeCondition,
      data: ethers.utils.defaultAbiCoder.encode(["uint256"], [executionTime]),
    });

    const indexSet = getIndexSets(NUM_OUTCOMES);

    const positionIds = [];

    for (const index of indexSet) {
      const collectionId = await conditionalTokens.getCollectionId(
        PARENT_COLLECTION_ID,
        conditionIdDai,
        index
      );
      const positionId = await conditionalTokens.getPositionId(
        dai.address,
        collectionId
      );
      positionIds.push(positionId);
    }

    const actionLiquidityWithdrawInputs = [
      conditionalTokens.address,
      fixedProductMarketMakerDai.address,
      positionIds,
      conditionIdDai,
      PARENT_COLLECTION_ID,
      dai.address,
      wallet.address,
    ];

    const actionLiquidityWithdrawAction = new gelato.Action({
      addr: actionLiquidityWithdraw.address,
      data: ifaceActionLiquidityWithdraw.encodeFunctionData(
        "action",
        actionLiquidityWithdrawInputs
      ),
      operation: gelato.Operation.Delegatecall,
    });

    task = new gelato.Task({
      conditions: [timeCondition],
      actions: [actionLiquidityWithdrawAction],
      selfProviderGasLimit: 0,
      selfProviderGasPriceCeil: 0,
    });

    let currentGelatoId = await gelatoCore.currentTaskReceiptId();
    const submitTaskTx = await cpk.execTransactions(
      [
        {
          to: gelatoCore.address,
          operation: CPK.CALL,
          value: 0,
          data: ifaceGelato.encodeFunctionData("submitTask", [
            myGelatoProvider, // Executor address
            task,
            0,
          ]),
        },
      ],
      {
        gasLimit: 5000000,
      }
    );

    taskSubmitTxReceipt = await submitTaskTx.transactionResponse.wait();

    // Fetch event of the last task receipt
    currentGelatoId = await gelatoCore.currentTaskReceiptId();
    const topics = gelatoCore.filters.LogTaskSubmitted(currentGelatoId).topics;
    const filter = {
      address: gelatoCore.address.toLowerCase(),
      blockhash: taskSubmitTxReceipt.blockHash,
      topics,
    };

    let iface = new ethers.utils.Interface(gelato.GelatoCore.abi);

    const logs = await wallet.provider.getLogs(filter);

    const log = logs.find(
      (log) => log.transactionHash === taskSubmitTxReceipt.transactionHash
    );

    let event = iface.parseLog(log);

    taskReceipt = event.args.taskReceipt;
  });

  it("Whitelist Task Spec as External Provider", async () => {
    const taskSpec = new gelato.TaskSpec({
      conditions: [task.conditions[0].inst],
      actions: task.actions,
      gasPriceCeil: 0,
    });

    // Provide Task Spec
    const provideTaskSpecTx = await gelatoCore.connect(provider).multiProvide(
      wallet.address, // executor
      [taskSpec], // Task Specs
      [hre.network.config.addresses.gnosisSafeProviderModule], // Gnosis Safe provider Module
      {
        gasLimit: GAS_LIMIT,
        value: ethers.utils.parseEther("10"),
      }
    );
    await provideTaskSpecTx.wait();
  });

  it("Execute TaskReceipt with Wallet as Executor", async () => {
    // See if it is executable
    const oracleAbi = ["function latestAnswer() view returns (int256)"];
    const gelatoGasPriceOracleAddress = await gelatoCore.gelatoGasPriceOracle();

    // Get gelatoGasPriceOracleAddress
    const gelatoGasPriceOracle = await ethers.getContractAt(
      oracleAbi,
      gelatoGasPriceOracleAddress,
      wallet
    );

    // lastAnswer is used by GelatoGasPriceOracle as well as the Chainlink Oracle
    const gelatoGasPrice = await gelatoGasPriceOracle.latestAnswer();
    const gelatoMaxGas = await gelatoCore.gelatoMaxGas();

    let canExecResult = await gelatoCore.canExec(
      taskReceipt,
      gelatoMaxGas,
      gelatoGasPrice
    );

    // Fast forward in time
    await wallet.provider.send("evm_mine", [executionTime]);

    canExecResult = await gelatoCore.canExec(
      taskReceipt,
      taskReceipt.tasks[0].selfProviderGasLimit,
      gelatoGasPrice
    );

    expect(canExecResult).to.be.eq("OK");

    const poolTokenBalanceBefore = await fixedProductMarketMakerDai.balanceOf(
      cpk.address
    );

    expect(parseFloat(fromWei(poolTokenBalanceBefore))).to.be.eq(
      parseFloat(fromWei(INITIAL_FUNDS))
    );

    const daiBalanceBeforeUser = await dai.balanceOf(wallet.address);
    const daiBalanceBeforeProvider = await dai.balanceOf(providerAddress);

    expect(parseFloat(fromWei(daiBalanceBeforeUser))).to.be.eq(
      parseFloat(fromWei(0))
    );

    // ########### PRE EXEUTION
    await expect(
      gelatoCore.connect(wallet).exec(taskReceipt, {
        gasPrice: gelatoGasPrice,
        gasLimit: 5000000,
      })
    ).to.emit(gelatoCore, "LogExecSuccess");

    // 🚧 For Debugging:
    // const txResponse2 = await gelatoCore.connect(wallet).exec(taskReceipt, {
    //   gasPrice: gelatoGasPrice,
    //   gasLimit: 5000000,
    // });
    // const { blockHash } = await txResponse2.wait();
    // const logs = await ethers.provider.getLogs({ blockHash });
    // const iFace = new ethers.utils.Interface(gelato.GelatoCore.abi);
    // for (const log of logs) {
    //  console.log(iFace.parseLog(log).args.reason);
    // }

    // const providerPostBalance = await gelatoCore.providerFunds(providerAddress);

    // const executionCost = providerPreBalance.sub(providerPostBalance);
    // console.log(`Total Gelato Execution Cost: ${executionCost.toString()}`);
    // const gasConsumed = executionCost.div(gelatoGasPrice);
    // console.log(`Gas Consumed: ${gasConsumed.toString()}`);

    // ########### POST EXECUTION

    // const execTxReceipt = await execTx.wait();
    // console.log(`Tx gasUsed: ${execTxReceipt.gasUsed.toString()}`);
    // const executionCosts = BigNumber.from(execTxReceipt.gasUsed.toString()).mul(
    //   gelatoGasPrice
    // );

    // console.log(`Exec Costs: ${executionCosts.toString()}`);

    // Get Uniswap Router getAmountsOut
    // const executionCostInDai = await uniRouterV2.getAmountsOut(executionCosts, [
    //   WETH,
    //   dai.address,
    // ]);
    // console.log(
    //   `Execution Costs in Dai: ${parseFloat(fromWei(executionCostInDai[1]))}`
    // );

    const poolTokenBalanceAfter = await fixedProductMarketMakerDai.balanceOf(
      cpk.address
    );

    expect(poolTokenBalanceAfter).to.be.lt(poolTokenBalanceBefore);

    // const daiBalanceAfterUser = await dai.balanceOf(wallet.address);
    // console.log(
    //   `Collateral Received back to User: ${parseFloat(
    //     fromWei(daiBalanceAfterUser)
    //   )}`
    // );

    const daiBalanceAfterProvider = await dai.balanceOf(providerAddress);
    const providerRefund = daiBalanceAfterProvider.sub(
      daiBalanceBeforeProvider
    );
    // console.log(
    //   `Collateral Received back to Provider: ${parseFloat(
    //     fromWei(providerRefund)
    //   )}`
    // );

    // @ DEV need to update that test to check for exact external provider refund
    expect(providerRefund).to.be.gte(0);
  });
});
