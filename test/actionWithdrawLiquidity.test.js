const { expect } = require("chai");
const hre = require("hardhat");
const erc20 = require("@studydefi/money-legos/erc20");

// Gelato
const gelato = require("@gelatonetwork/core");

// CPK
const CPK = require("contract-proxy-kit");

const { deployments, ethers } = hre;
const {
  fromWei,
  getTokenFromFaucet,
  createFPMM,
  getConditionIds,
  getPriceFromOracle,
} = require("./helpers");

// CONSTANTS
const GAS_LIMIT = 5000000;
const INITIAL_FUNDS = ethers.utils.parseUnits("500", "18");

// // Conditional Tokens
const OUTCOMES_DAI = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const OUTCOMES_REP = [4, 3, 2, 1];
const OUTCOMES_GNO = [2, 1];

describe("ActionWithdrawLiquidity.sol test", function () {
  this.timeout(0);

  let user;
  let userAddress;
  let conditionalTokens;
  let dai;
  let gno;
  let rep;
  let fixedProductMarketMakerDai;
  let fixedProductMarketMakerGno;
  let fixedProductMarketMakerRep;
  let gelatoCore;
  let cpk;
  let taskSubmitTxReceipt;
  let executionTime;
  let actionLiquidityWithdraw;
  let provider;
  let task;
  let taskReceipt;
  let providerAddress;
  let receiver;
  let receiverAddress;

  before(async () => {
    //#region Get Signers
    [user, receiver] = await ethers.getSigners();

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

    userAddress = await user.getAddress();
    receiverAddress = await receiver.getAddress();
    //#endregion

    //#region Instantiate Contracts
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

    gelatoCore = await ethers.getContractAt(
      gelato.GelatoCore.abi,
      hre.network.config.addresses.gelatoCore
    );

    cpk = await CPK.create({
      ethers,
      signer: user,
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
    //#endregion

    //#region Prefund UserAddress and Gnosis Safe Address
    await getTokenFromFaucet(dai.address, userAddress, INITIAL_FUNDS);
    await getTokenFromFaucet(dai.address, cpk.address, INITIAL_FUNDS);
    await getTokenFromFaucet(gno.address, userAddress, INITIAL_FUNDS);
    await getTokenFromFaucet(gno.address, cpk.address, INITIAL_FUNDS);
    await getTokenFromFaucet(rep.address, userAddress, INITIAL_FUNDS);
    await getTokenFromFaucet(rep.address, cpk.address, INITIAL_FUNDS);
    //#endregion
  });

  it("Create fixed product market makers", async () => {
    //#region Create Fixed Product Market Makers
    fixedProductMarketMakerDai = await createFPMM(
      conditionalTokens,
      user,
      dai,
      INITIAL_FUNDS,
      OUTCOMES_DAI
    );
    fixedProductMarketMakerGno = await createFPMM(
      conditionalTokens,
      user,
      gno,
      INITIAL_FUNDS,
      OUTCOMES_GNO
    );
    fixedProductMarketMakerRep = await createFPMM(
      conditionalTokens,
      user,
      rep,
      INITIAL_FUNDS,
      OUTCOMES_REP
    );
    //#endregion
  });

  it("Add funding via User Proxy", async () => {
    const fpmmContracts = [
      { token: dai, fpmm: fixedProductMarketMakerDai },
      { token: gno, fpmm: fixedProductMarketMakerGno },
      { token: rep, fpmm: fixedProductMarketMakerRep },
    ];
    for (let i = 0; i < fpmmContracts.length; i++) {
      //#region Add funding in collateral token to FPMM
      const approveTx = await cpk.execTransactions(
        [
          {
            to: fpmmContracts[i].token.address,
            operation: CPK.CALL,
            value: 0,
            data: fpmmContracts[i].token.interface.encodeFunctionData(
              "approve",
              [fpmmContracts[i].fpmm.address, INITIAL_FUNDS]
            ),
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
            to: fpmmContracts[i].fpmm.address,
            operation: CPK.CALL,
            value: 0,
            data: fpmmContracts[
              i
            ].fpmm.interface.encodeFunctionData("addFunding", [
              INITIAL_FUNDS,
              [],
            ]),
          },
        ],
        {
          value: 0,
          gasLimit: 5000000,
        }
      );
      await addFundingTx.transactionResponse.wait();

      const liquidityPoolTokenBalance = await fpmmContracts[i].fpmm.balanceOf(
        cpk.address
      );

      expect(parseFloat(fromWei(liquidityPoolTokenBalance))).to.be.eq(
        parseFloat(fromWei(INITIAL_FUNDS))
      );
      //#endregion
    }
  });

  it("Test ActionWithdrawLiquidity via UserProxy", async () => {
    const gnoIds = await getConditionIds(
      conditionalTokens,
      userAddress,
      gno.address,
      OUTCOMES_GNO.length
    );
    const actionLiquidityWithdrawGnoInputs = [
      conditionalTokens.address,
      fixedProductMarketMakerGno.address,
      gnoIds.positionIds,
      gnoIds.conditionId,
      gnoIds.parentCollectionId,
      gno.address,
      userAddress,
    ];

    let gnoWeiBalanceBefore = await gno.balanceOf(userAddress);
    console.log("gno action...");
    // Test ActionWithdrawLiquidity with GNO (uses fallback Uniswap oracle)
    const actionTestTx = await cpk.execTransactions(
      [
        {
          to: actionLiquidityWithdraw.address,
          operation: CPK.DELEGATECALL,
          value: 0,
          data: actionLiquidityWithdraw.interface.encodeFunctionData(
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

    let gnoWeiBalanceAfter = await gno.balanceOf(userAddress);
    expect(parseFloat(fromWei(gnoWeiBalanceBefore))).to.be.lt(
      parseFloat(fromWei(gnoWeiBalanceAfter))
    );

    const repIds = await getConditionIds(
      conditionalTokens,
      userAddress,
      rep.address,
      OUTCOMES_REP.length
    );

    const actionLiquidityWithdrawRepInputs = [
      conditionalTokens.address,
      fixedProductMarketMakerRep.address,
      repIds.positionIds,
      repIds.conditionId,
      repIds.parentCollectionId,
      rep.address,
      userAddress,
    ];
    console.log("rep action...");
    let repWeiBalanceBefore = await rep.balanceOf(userAddress);

    // Test ActionWithdrawLiquidity with REP (uses chainlink OracleAggregator)
    const actionTestTx_2 = await cpk.execTransactions(
      [
        {
          to: actionLiquidityWithdraw.address,
          operation: CPK.DELEGATECALL,
          value: 0,
          data: actionLiquidityWithdraw.interface.encodeFunctionData(
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

    let repWeiBalanceAfter = await rep.balanceOf(userAddress);
    expect(parseFloat(fromWei(repWeiBalanceBefore))).to.be.lt(
      parseFloat(fromWei(repWeiBalanceAfter))
    );
  });

  it("Set up executor on gelato", async () => {
    const minExecutorStake = await gelatoCore.minExecutorStake();
    await gelatoCore.connect(user).stakeExecutor({
      value: minExecutorStake,
      gasLimit: GAS_LIMIT,
    });
  });

  it("Random User buys outcome tokens", async () => {
    // Fund Random User With ETH
    await user.sendTransaction({
      to: providerAddress,
      value: ethers.utils.parseEther("100"),
    });

    // Random User buys DAI
    const daiAmount = ethers.utils.parseEther("4");
    const daiBalanceWeiBefore = await dai.balanceOf(providerAddress);
    await getTokenFromFaucet(dai.address, providerAddress, daiAmount);

    // Now random user buys outcome tokens
    const outcomeIndex = 2;
    const buyAmount = await fixedProductMarketMakerDai.calcBuyAmount(
      daiAmount,
      outcomeIndex
    );

    const approveTx = await dai
      .connect(provider)
      .approve(fixedProductMarketMakerDai.address, daiAmount);
    await approveTx.wait();

    const buyConditionalTokenTx = await fixedProductMarketMakerDai
      .connect(provider)
      .buy(daiAmount, outcomeIndex, buyAmount);
    await buyConditionalTokenTx.wait();

    // Should have 0 DAI
    let daiBalanceWeiAfter = await dai.balanceOf(providerAddress);

    expect(daiBalanceWeiAfter).to.be.eq(daiBalanceWeiBefore);

    // Should have buyAmount Specific conditional token balance
    const daiIds = await getConditionIds(
      conditionalTokens,
      userAddress,
      dai.address,
      OUTCOMES_DAI.length
    );
    const addresses = daiIds.positionIds.map(() => providerAddress);

    const conditionalTokenBalances = await conditionalTokens.balanceOfBatch(
      addresses,
      daiIds.positionIds
    );

    expect(
      parseFloat(fromWei(conditionalTokenBalances[outcomeIndex]))
    ).to.be.eq(parseFloat(fromWei(buyAmount)));

    // // Re connect to old account
    fixedProductMarketMakerDai.connect(user);
    dai.connect(user);
  });

  it("Submit Task On Gelato", async () => {
    let ifaceGnoSafe = new ethers.utils.Interface([
      "function enableModule(address)",
    ]);

    // Send some ETH To Proxy
    await user.sendTransaction({
      to: cpk.address,
      value: ethers.utils.parseEther("1"),
    });

    // const proxyEtherBalance = await user.provider.getBalance(cpk.address);

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

    const block = await user.provider.getBlock();

    executionTime = block.timestamp + 5 * 60; // 5 minutes

    const timeCondition = new gelato.Condition({
      inst: hre.network.config.addresses.timeCondition,
      data: ethers.utils.defaultAbiCoder.encode(["uint256"], [executionTime]),
    });

    const daiIds = await getConditionIds(
      conditionalTokens,
      userAddress,
      dai.address,
      OUTCOMES_DAI.length
    );

    const actionLiquidityWithdrawInputs = [
      conditionalTokens.address,
      fixedProductMarketMakerDai.address,
      daiIds.positionIds,
      daiIds.conditionId,
      daiIds.parentCollectionId,
      dai.address,
      receiverAddress,
    ];

    const actionLiquidityWithdrawAction = new gelato.Action({
      addr: actionLiquidityWithdraw.address,
      data: actionLiquidityWithdraw.interface.encodeFunctionData(
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
          data: gelatoCore.interface.encodeFunctionData("submitTask", [
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

    const logs = await user.provider.getLogs(filter);

    const log = logs.find(
      (log) => log.transactionHash === taskSubmitTxReceipt.transactionHash
    );

    let event = gelatoCore.interface.parseLog(log);

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
      userAddress, // executor
      [taskSpec], // Task Specs
      [hre.network.config.addresses.gnosisSafeProviderModule], // Gnosis Safe provider Module
      {
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
      user
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
    await user.provider.send("evm_mine", [executionTime]);

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

    // ########### PRE EXECUTION
    const userDaiBalanceWei = await dai.balanceOf(userAddress);
    expect(parseFloat(fromWei(userDaiBalanceWei))).to.be.eq(
      parseFloat(fromWei(0))
    );
    const userBalanceWei = await user.getBalance();
    //const receiverDaiBalanceWei = await dai.balanceOf(receiverAddress);

    console.log("dai action...");
    await expect(
      gelatoCore.connect(user).exec(taskReceipt, {
        gasPrice: gelatoGasPrice,
        gasLimit: 5000000,
      })
    ).to.emit(gelatoCore, "LogExecSuccess");

    const userDaiBalanceWeiAfter = await dai.balanceOf(userAddress);
    const userBalanceWeiAfter = await user.getBalance();
    //const receiverDaiBalanceWeiAfter = await dai.balanceOf(receiverAddress);

    // 🚧 For Debugging:
    // const txResponse2 = await gelatoCore.connect(user).exec(taskReceipt, {
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

    // const daiBalanceAfterUser = await dai.balanceOf(userAddress);
    // console.log(
    //   `Collateral Received back to User: ${parseFloat(
    //     fromWei(daiBalanceAfterUser)
    //   )}`
    // );

    const executorRefund = userDaiBalanceWeiAfter.sub(userDaiBalanceWei);
    const executorSpent = userBalanceWei.sub(userBalanceWeiAfter);
    // console.log(
    //   `Collateral Received back to Provider: ${parseFloat(
    //     fromWei(providerRefund)
    //   )}`
    // );

    // @ DEV need to update that test to check for exact external provider refund
    expect(executorRefund).to.be.gte(0);
    console.log(`Actual gas units used: ${executorSpent / gelatoGasPrice}`);
    console.log(``);
    console.log(`executor dai-wei refund: ${executorRefund}`);
    console.log(`executor wei spent gas: ${executorSpent}`);
    const ethPrice = await getPriceFromOracle(
      hre.network.config.addresses.chainlink.ETH_USD
    );
    console.log(
      `profit: ${fromWei(
        (executorRefund / ethPrice - executorSpent).toString()
      )}`
    );
    console.log(
      `profit (1 re-execution): ${fromWei(
        (executorRefund / ethPrice - executorSpent * 1.11).toString()
      )}`
    );
    console.log(
      `profit (2 re-executions): ${fromWei(
        (executorRefund / ethPrice - executorSpent * 1.11 * 1.11).toString()
      )}`
    );
    console.log(
      `profit (3 re-executions): ${fromWei(
        (
          executorRefund / ethPrice -
          executorSpent * 1.11 * 1.11 * 1.11
        ).toString()
      )}`
    );
  });
});
