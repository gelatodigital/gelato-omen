const { BigNumber } = require("ethers");
const { expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const { deployments, ethers } = hre;

const erc20 = require("@studydefi/money-legos/erc20");
const uniswap = require("@studydefi/money-legos/uniswap");

// Gelato
const gelato = require("@gelatonetwork/core");

// CPK
const CPK = require("contract-proxy-kit");

const GAS_LIMIT = 5000000;

const INITIAL_FUNDS = ethers.utils.parseUnits("500", "18");

// Conditional Tokens
const NUM_OUTCOMES = 10;
const QUESTION_ID = ethers.constants.HashZero;
const PARENT_COLLETION_ID = ethers.constants.HashZero;

const fromWei = (x) => ethers.utils.formatUnits(x, 18);

const getIndexSets = (outcomesCount) => {
  const range = (length) => [...Array(length)].map((x, i) => i);
  return range(outcomesCount).map((x) => 1 << x);
};

describe("Omen automated withdrawal test with Gelato", function () {
  this.timeout(0);

  let wallet;
  let admin;
  let conditionalTokens;
  let fPMMDeterministicFactory;
  let dai;
  let fixedProductMarketMaker;
  let gelatoCore;
  let cpk;
  let taskSubmitTxReceipt;
  let conditionId;
  let executionTime;
  let actionLiquidityWithdraw;
  let daiExchangeContract;
  let provider;
  let task;
  let taskReceipt;
  let oracleAggregator;
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

    admin = await wallet.getAddress();

    // Deploy ActionWithdrawLiquidity and OracleAggregator
    await deployments.fixture();

    oracleAggregator = await ethers.getContract("OracleAggregator");

    actionLiquidityWithdraw = await ethers.getContract(
      "ActionWithdrawLiquidity"
    );

    conditionalTokens = new ethers.Contract(
      hre.network.config.addresses.conditionalTokens,
      hre.network.config.abis.conditionalTokensAbi,
      wallet
    );

    dai = new ethers.Contract(erc20.dai.address, erc20.dai.abi, wallet);

    fPMMDeterministicFactory = new ethers.Contract(
      hre.network.config.addresses.fPMMDeterministicFactory,
      hre.network.config.abis.fPMMDeterministicFactoryAbi,
      wallet
    );

    gelatoCore = new ethers.Contract(
      hre.network.config.addresses.gelatoCore,
      gelato.GelatoCore.abi,
      wallet
    );

    // uniRouterV2 = new ethers.Contract(
    //   gelatoContracts.uniswapV2Router.address,
    //   gelatoContracts.uniswapV2Router.abi,
    //   wallet
    // );

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

  it("Verify Price Oracle expected return", async () => {
    let x = await oracleAggregator.getExpectedReturnAmount(
      ethers.utils.parseEther("1"),
      "0x8CE9137d39326AD0cD6491fb5CC0CbA0e089b6A9",
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
    );
    let y = await oracleAggregator.getExpectedReturnAmount(
      ethers.utils.parseEther("1"),
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      "0x8CE9137d39326AD0cD6491fb5CC0CbA0e089b6A9"
    );
    expect(
      Math.round(
        Number(
          (x / ethers.utils.parseEther("1")) *
            (y / ethers.utils.parseEther("1"))
        )
      )
    ).to.be.eq(1);
  });

  it("Buy DAI from Uniswap", async () => {
    // 1. instantiate contracts
    const uniswapFactoryContract = new ethers.Contract(
      uniswap.factory.address,
      uniswap.factory.abi,
      wallet
    );

    const daiExchangeAddress = await uniswapFactoryContract.getExchange(
      dai.address,
      {
        gasLimit: GAS_LIMIT,
      }
    );
    daiExchangeContract = new ethers.Contract(
      daiExchangeAddress,
      uniswap.exchange.abi,
      wallet
    );

    // 2. do the actual swapping
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
  });

  it("Create a fixed product market maker", async () => {
    // 1. Prepare a condition on the conditional tokens contract
    await conditionalTokens.prepareCondition(admin, QUESTION_ID, NUM_OUTCOMES, {
      gasLimit: GAS_LIMIT,
    });

    conditionId = await conditionalTokens.getConditionId(
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
      [conditionId],
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

    const topics = fPMMDeterministicFactory.filters.FixedProductMarketMakerCreation(
      admin
    ).topics;

    const filter = {
      address: fPMMDeterministicFactory.address,
      blockHash: receipt.blockhash,
      topics: topics,
    };

    let iface = new ethers.utils.Interface(
      hre.network.config.abis.fPMMDeterministicFactoryAbi
    );

    const logs = await wallet.provider.getLogs(filter);

    const log = logs.find((log) => log.transactionHash === tx.hash);

    let event = iface.parseLog(log);

    fixedProductMarketMaker = new ethers.Contract(
      event.args.fixedProductMarketMaker,
      hre.network.config.abis.fixedProductMarketMakerAbi,
      wallet
    );
  });

  it("Fund User Proxy with DAI", async () => {
    // 1. Fund Proxy with DAI
    await dai.transfer(cpk.address, INITIAL_FUNDS);
    const proxyDaiBalance = await dai.balanceOf(cpk.address);

    // Proxy should have initial Funds DAI
    expect(parseFloat(fromWei(proxyDaiBalance))).to.be.gte(
      parseFloat(fromWei(INITIAL_FUNDS))
    );
  });

  it("Add Funding via User Proxy", async () => {
    // 1. Fund Proxy with DAI
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
            fixedProductMarketMaker.address,
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

    const addFundingTx = await cpk.execTransactions(
      [
        {
          to: fixedProductMarketMaker.address,
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

    const liquidityPoolTokenBalance = await fixedProductMarketMaker.balanceOf(
      cpk.address
    );

    // Proxy should have initial Funds LP Tplens
    expect(parseFloat(fromWei(liquidityPoolTokenBalance))).to.be.eq(
      parseFloat(fromWei(INITIAL_FUNDS))
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
      value: ethers.utils.parseEther("500"),
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
    const buyAmount = await fixedProductMarketMaker.calcBuyAmount(
      actualDaiReceived,
      outcomeIndex
    );

    const approveTx = await dai
      .connect(provider)
      .approve(fixedProductMarketMaker.address, actualDaiReceived);
    await approveTx.wait();

    const buyConditionalTokenTx = await fixedProductMarketMaker
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
        PARENT_COLLETION_ID,
        conditionId,
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
    fixedProductMarketMaker.connect(wallet);
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

    // const batchProvideTx = await cpk.execTransactions(
    //   [
    //     {
    //       to: gelatoCore.address,
    //       operation: CPK.CALL,
    //       value: proxyEtherBalance, // Deposit 1 eth on Gelato,
    //       data: ifaceGelato.encodeFunctionData("multiProvide", [
    //         wallet.address, // Executor address (in this case user is its own executor)
    //         [],
    //         [gelatoAddresses.gnosisSafeProviderModule],
    //       ]),
    //     },
    //   ],
    //   {
    //     gasLimit: 5000000,
    //   }
    // );

    // await batchProvideTx.transactionResponse.wait();

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
        PARENT_COLLETION_ID,
        conditionId,
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
      fixedProductMarketMaker.address,
      positionIds,
      conditionId,
      PARENT_COLLETION_ID,
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
    const gelatoGasPriceOracle = new ethers.Contract(
      gelatoGasPriceOracleAddress,
      oracleAbi,
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

    const poolTokenBalanceBefore = await fixedProductMarketMaker.balanceOf(
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

    // const providerPreBalance = await gelatoCore.providerFunds(providerAddress);

    // // Should have buyAmount Specific conditional token balance
    // const indexSet = getIndexSets(NUM_OUTCOMES);
    // const positionIds = [];
    // const addresses = [];
    // for (const index of indexSet) {
    //   const collectionId = await conditionalTokens.getCollectionId(
    //     PARENT_COLLETION_ID,
    //     conditionId,
    //     index
    //   );
    //   const positionId = await conditionalTokens.getPositionId(
    //     dai.address,
    //     collectionId
    //   );
    //   positionIds.push(positionId);
    //   addresses.push(cpk.address);
    // }

    // let conditionalTokenBalances = await conditionalTokens.balanceOfBatch(
    //   addresses,
    //   positionIds
    // );

    // console.log(conditionalTokenBalances);

    // const smallestConditionalTokenBalance = conditionalTokenBalances.reduce(
    //   (min, amount) => (amount.lt(min) ? amount : min)
    // );

    // console.log(
    //   `Smallest Conditional Token Balance: ${smallestConditionalTokenBalance.toString()}`
    // );

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

    const poolTokenBalanceAfter = await fixedProductMarketMaker.balanceOf(
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
