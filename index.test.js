const { ethers, BigNumber, EthersAdapter } = require("ethers");
const Ganache = require("ganache-core");
require("dotenv").config();

const erc20 = require("@studydefi/money-legos/erc20");
const uniswap = require("@studydefi/money-legos/uniswap");
const omen = require("./condition_tokens_mm");
const gelatoContracts = require("./gelato");

// Gelato
const gelato = require("@gelatonetwork/core");

// Addresses
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const gelatoAddresses = {
  gelatoCore: "0x1d681d76ce96E4d70a88A00EBbcfc1E47808d0b8",
  timeCondition: "0x63129681c487d231aa9148e1e21837165f38deaf",
  gnosisSafeProviderModule: "0x3a994Cd3a464032B8d0eAa16F91C446A46c4fEbC",
};

// CPK
const CPK = require("contract-proxy-kit");
const { providers } = require("ethers");

const MAINNET_NODE_URL = `https://mainnet.infura.io/v3/${process.env.INFURA_URL}`;
const PRIV_KEY = process.env.PK;

const GAS_LIMIT = 5000000;

const INITIAL_FUNDS = ethers.utils.parseUnits("100", "18");

// Conditional Tokens
const NUM_OUTCOMES = 10;
const QUESTION_ID = ethers.constants.HashZero;
const PARENT_COLLETION_ID = ethers.constants.HashZero;

const fromWei = (x) => ethers.utils.formatUnits(x, 18);

const getIndexSets = (outcomesCount) => {
  const range = (length) => [...Array(length)].map((x, i) => i);
  return range(outcomesCount).map((x) => 1 << x);
};

const startChain = async () => {
  const ganache = Ganache.provider({
    fork: MAINNET_NODE_URL,
    network_id: 1,
    accounts: [
      {
        secretKey: PRIV_KEY,
        balance: ethers.utils.hexlify(ethers.utils.parseEther("1000")),
      },
    ],
    // unlocked_accounts: [EXECUTOR],
  });

  const provider = new ethers.providers.Web3Provider(ganache);
  const wallet = new ethers.Wallet(PRIV_KEY, provider);
  return wallet;
};

jest.setTimeout(100000);

describe("Omen automated withdrawal test with Gelato", () => {
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
  let uniRouterV2;

  beforeAll(async () => {
    wallet = await startChain();
    admin = await wallet.getAddress();

    conditionalTokens = new ethers.Contract(
      omen.conditionalTokens.address,
      omen.conditionalTokens.abi,
      wallet
    );

    dai = new ethers.Contract(erc20.dai.address, erc20.dai.abi, wallet);

    fPMMDeterministicFactory = new ethers.Contract(
      omen.fPMMDeterministicFactory.address,
      omen.fPMMDeterministicFactory.abi,
      wallet
    );

    gelatoCore = new ethers.Contract(
      gelatoAddresses.gelatoCore,
      gelato.GelatoCore.abi,
      wallet
    );

    uniRouterV2 = new ethers.Contract(
      gelatoContracts.uniswapV2Router.address,
      gelatoContracts.uniswapV2Router.abi,
      wallet
    );

    cpk = await CPK.create({
      ethers,
      signer: wallet,
      networks: {
        1337: {
          masterCopyAddress: "0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F",
          proxyFactoryAddress: "0x0fB4340432e56c014fa96286de17222822a9281b",
          multiSendAddress: "0xB522a9f781924eD250A11C54105E51840B138AdD",
          fallbackHandlerAddress: "0x40A930851BD2e590Bd5A5C981b436de25742E980",
        },
      },
    });
  });

  test("buy DAI from Uniswap", async () => {
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
    expect(daiBalance).toBeGreaterThan(0);
  });

  test("Create a fixed product market maker", async () => {
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

    expect(parseFloat(fromWei(daiBalanceWei))).toBeGreaterThanOrEqual(
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

    let iface = new ethers.utils.Interface(omen.fPMMDeterministicFactory.abi);

    const logs = await wallet.provider.getLogs(filter);

    const log = logs.find((log) => log.transactionHash === tx.hash);

    let event = iface.parseLog(log);

    fixedProductMarketMaker = new ethers.Contract(
      event.args.fixedProductMarketMaker,
      omen.fixedProductMarketMaker.abi,
      wallet
    );
  });

  test("Fund User Proxy with DAI", async () => {
    // 1. Fund Proxy with DAI
    await dai.transfer(cpk.address, INITIAL_FUNDS);
    const proxyDaiBalance = await dai.balanceOf(cpk.address);

    // Proxy should have initial Funds DAI
    expect(parseFloat(fromWei(proxyDaiBalance))).toBeGreaterThanOrEqual(
      parseFloat(fromWei(INITIAL_FUNDS))
    );
  });

  test("Add Funding via User Proxy", async () => {
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
    expect(parseFloat(fromWei(liquidityPoolTokenBalance))).toBe(
      parseFloat(fromWei(INITIAL_FUNDS))
    );
  });

  test("Wallet becomes executor on gelato", async () => {
    const minExecutorStake = await gelatoCore.minExecutorStake();
    await gelatoCore.stakeExecutor({
      value: minExecutorStake,
      gasLimit: GAS_LIMIT,
    });
  });

  test("Deploy Liquidity Withdraw Action", async () => {
    provider = ethers.Wallet.createRandom().connect(wallet.provider);

    const actionLiquidityWithdrawFactory = new ethers.ContractFactory(
      gelatoContracts.actionWithdrawLiquidity.abi,
      gelatoContracts.actionWithdrawLiquidity.bytecode,
      wallet
    );

    actionLiquidityWithdraw = await actionLiquidityWithdrawFactory.deploy(
      gelatoCore.address,
      provider.address,
      WETH,
      gelatoContracts.uniswapV2Router.address
    );

    await actionLiquidityWithdraw.deployTransaction.wait();
  });

  test("Random User buys outcome tokens", async () => {
    // Fund Random User With ETH
    await wallet.sendTransaction({
      to: provider.address,
      value: ethers.utils.parseEther("100"),
      gasLimit: GAS_LIMIT,
    });

    const randomUserEthBalance = await wallet.provider.getBalance(
      provider.address
    );

    // Random User buys DAI
    const daiToSell = ethers.utils.parseEther("4");
    daiExchangeContract = daiExchangeContract.connect(provider);
    const swapTx = await daiExchangeContract.ethToTokenSwapOutput(
      daiToSell, // min amount of token retrieved
      2525644800, // random timestamp in the future (year 2050)
      {
        gasLimit: GAS_LIMIT,
        value: ethers.utils.parseEther("4"),
      }
    );
    await swapTx.wait();

    // check DAI balance
    let daiBalanceWei = await dai.balanceOf(provider.address, {
      gasLimit: GAS_LIMIT,
    });
    let daiBalance = parseFloat(fromWei(daiBalanceWei));
    expect(daiBalance).toBeGreaterThan(0);

    // Now random user buys outcome tokens
    const outcomeIndex = 2;
    const buyAmount = await fixedProductMarketMaker.calcBuyAmount(
      daiToSell,
      outcomeIndex
    );

    const approveTx = await dai
      .connect(provider)
      .approve(fixedProductMarketMaker.address, daiToSell);
    await approveTx.wait();

    const buyConditionalTokenTx = await fixedProductMarketMaker
      .connect(provider)
      .buy(daiToSell, outcomeIndex, buyAmount);
    await buyConditionalTokenTx.wait();

    // Should have 0 DAI
    daiBalanceWei = await dai.balanceOf(provider.address, {
      gasLimit: GAS_LIMIT,
    });
    daiBalance = parseFloat(fromWei(daiBalanceWei));

    expect(daiBalance).toBe(0);

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
      addresses.push(provider.address);
    }

    const conditionalTokenBalances = await conditionalTokens.balanceOfBatch(
      addresses,
      positionIds
    );

    expect(parseFloat(fromWei(conditionalTokenBalances[outcomeIndex]))).toBe(
      parseFloat(fromWei(buyAmount))
    );

    // // Re connect to old account
    fixedProductMarketMaker.connect(wallet);
    dai.connect(wallet);
  });

  test("Submit Task On Gelato", async () => {
    let ifaceGelato = new ethers.utils.Interface(gelato.GelatoCore.abi);
    let ifaceGnoSafe = new ethers.utils.Interface([
      "function enableModule(address)",
    ]);
    let ifaceFixedProductMarketMaker = new ethers.utils.Interface([
      "function removeFunding(uint256)",
    ]);
    let ifaceActionLiquidityWithdraw = new ethers.utils.Interface(
      gelatoContracts.actionWithdrawLiquidity.abi
    );

    // Send some ETH To Proxy
    await wallet.sendTransaction({
      to: cpk.address,
      value: ethers.utils.parseEther("1"),
      gasLimit: GAS_LIMIT,
    });

    const proxyEtherBalance = await wallet.provider.getBalance(cpk.address);

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
      addr: provider.address,
      module: gelatoAddresses.gnosisSafeProviderModule,
    };

    const block = await wallet.provider.getBlock();

    executionTime = block.timestamp + 5 * 60; // 5 minutes

    const timeCondition = new gelato.Condition({
      inst: gelatoAddresses.timeCondition,
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
    console.log(`Id: ${currentGelatoId}`);

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

  test("Whitelist Task Spec as External Provider", async () => {
    const taskSpec = new gelato.TaskSpec({
      conditions: [task.conditions[0].inst],
      actions: task.actions,
      gasPriceCeil: 0,
    });

    // Provide Task Spec
    const provideTaskSpecTx = await gelatoCore.connect(provider).multiProvide(
      wallet.address, // executor
      [taskSpec], // Task Specs
      [gelatoAddresses.gnosisSafeProviderModule], // Gnosis Safe provider Module
      {
        gasLimit: GAS_LIMIT,
        value: ethers.utils.parseEther("10"),
      }
    );
    await provideTaskSpecTx.wait();
  });

  test("Execute TaskReceipt with Wallet as Executor", async () => {
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
    console.log(`Can Exec Result = ${canExecResult}`);

    await wallet.provider.send("evm_mine", [executionTime]);

    canExecResult = await gelatoCore.canExec(
      taskReceipt,
      taskReceipt.tasks[0].selfProviderGasLimit,
      gelatoGasPrice
    );
    console.log(`Can Exec Result = ${canExecResult}`);

    const poolTokenBalanceBefore = await fixedProductMarketMaker.balanceOf(
      cpk.address
    );

    expect(parseFloat(fromWei(poolTokenBalanceBefore))).toBe(
      parseFloat(fromWei(INITIAL_FUNDS))
    );

    const daiBalanceBeforeUser = await dai.balanceOf(wallet.address);
    const daiBalanceBeforeProvider = await dai.balanceOf(provider.address);

    expect(parseFloat(fromWei(daiBalanceBeforeUser))).toBe(
      parseFloat(fromWei(0))
    );
    expect(parseFloat(fromWei(daiBalanceBeforeProvider))).toBe(
      parseFloat(fromWei(0))
    );

    const providerPreBalance = await gelatoCore.providerFunds(provider.address);

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
    const execTx = await gelatoCore.connect(wallet).exec(taskReceipt, {
      gasPrice: gelatoGasPrice,
      gasLimit: 5000000,
    });

    const providerPostBalance = await gelatoCore.providerFunds(
      provider.address
    );

    const executionCost = providerPreBalance.sub(providerPostBalance);
    console.log(`Total Gelato Execution Cost: ${executionCost.toString()}`);
    const gasConsumed = executionCost.div(gelatoGasPrice);
    console.log(`Gas Consumed: ${gasConsumed.toString()}`);

    // ########### POST EXEUTION

    const execTxReceipt = await execTx.wait();
    console.log(`Tx gasUsed: ${execTxReceipt.gasUsed.toString()}`);
    const executionCosts = BigNumber.from(execTxReceipt.gasUsed.toString()).mul(
      gelatoGasPrice
    );

    console.log(`Exec Costs: ${executionCosts.toString()}`);

    // Get Uniswap Router getAmountsOut
    const executionCostInDai = await uniRouterV2.getAmountsOut(executionCosts, [
      WETH,
      dai.address,
    ]);
    console.log(
      `Execution Costs in Dai: ${parseFloat(fromWei(executionCostInDai[1]))}`
    );

    const poolTokenBalanceAfter = await fixedProductMarketMaker.balanceOf(
      cpk.address
    );

    expect(parseFloat(fromWei(poolTokenBalanceAfter))).toBe(parseFloat("0"));

    const daiBalanceAfterUser = await dai.balanceOf(wallet.address);
    console.log(
      `Collateral Received back to User: ${parseFloat(
        fromWei(daiBalanceAfterUser)
      )}`
    );

    const daiBalanceAfterProvider = await dai.balanceOf(provider.address);
    console.log(
      `Collateral Received back to Provider: ${parseFloat(
        fromWei(daiBalanceAfterProvider)
      )}`
    );

    // expect(parseFloat(fromWei(daiBalanceAfter))).toBe(
    //   parseFloat(fromWei(INITIAL_FUNDS))
    // );
  });
});
