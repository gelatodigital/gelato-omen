const { ethers, BigNumber, EthersAdapter } = require("ethers");
const Ganache = require("ganache-core");
require("dotenv").config();

const erc20 = require("@studydefi/money-legos/erc20");
const uniswap = require("@studydefi/money-legos/uniswap");
const omen = require("./condition_tokens_mm");

// Gelato
const gelato = require("@gelatonetwork/core");

const gelatoAddresses = {
  gelatoCore: "0x1d681d76ce96E4d70a88A00EBbcfc1E47808d0b8",
  timeCondition: "0x63129681c487d231aa9148e1e21837165f38deaf",
};

// CPK
const CPK = require("contract-proxy-kit");

const MAINNET_NODE_URL = `https://mainnet.infura.io/v3/${process.env.INFURA_URL}`;
const PRIV_KEY = process.env.PK;

const GAS_LIMIT = 5000000;

const initialFunds = BigNumber.from((10e18).toString());

// Conditional Tokens
const NUM_OUTCOMES = 10;
const QUESTION_ID = ethers.constants.HashZero;

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
    const daiExchangeContract = new ethers.Contract(
      daiExchangeAddress,
      uniswap.exchange.abi,
      wallet
    );

    // 2. do the actual swapping
    try {
      await daiExchangeContract.ethToTokenSwapOutput(
        initialFunds.mul(BigNumber.from("2")), // min amount of token retrieved
        2525644800, // random timestamp in the future (year 2050)
        {
          gasLimit: GAS_LIMIT,
          value: ethers.utils.parseEther("5"),
        }
      );
    } catch (err) {
      console.log(err);
      console.log("Could not swap");
    }

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
      initialFunds,
      initialDistribution,
    ];

    const daiBalanceWei = await dai.balanceOf(wallet.address, {
      gasLimit: GAS_LIMIT,
    });

    expect(parseFloat(fromWei(daiBalanceWei))).toBeGreaterThanOrEqual(
      parseFloat(fromWei(initialFunds))
    );

    await dai.approve(fPMMDeterministicFactory.address, initialFunds, {
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
    await dai.transfer(cpk.address, initialFunds);
    const proxyDaiBalance = await dai.balanceOf(cpk.address);

    // Proxy should have initial Funds DAI
    expect(parseFloat(fromWei(proxyDaiBalance))).toBeGreaterThanOrEqual(
      parseFloat(fromWei(initialFunds))
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
            initialFunds,
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
          data: iface.encodeFunctionData("addFunding", [initialFunds, []]),
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

    // Proxy should have initial Funds DAI
    expect(parseFloat(fromWei(liquidityPoolTokenBalance))).toBe(
      parseFloat(fromWei(initialFunds))
    );
  });

  test("Wallet becomes executor on gelato", async () => {
    const minExecutorStake = await gelatoCore.minExecutorStake();
    await gelatoCore.stakeExecutor({
      value: minExecutorStake,
      gasLimit: GAS_LIMIT,
    });
  });

  test("Submit Task On Gelato", async () => {
    let ifaceGelato = new ethers.utils.Interface(gelato.GelatoCore.abi);
    let ifaceGnoSafe = new ethers.utils.Interface([
      "function enableModule(address)",
    ]);
    let ifaceFixedProductMarketMaker = new ethers.utils.Interface([
      "function removeFunding(uint256)",
    ]);
    let ifaceTimeCondition = new ethers.utils.Interface([
      "function timeCheck(uint256)",
    ]);

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

    const gnosisSafeProviderModule =
      "0x3a994Cd3a464032B8d0eAa16F91C446A46c4fEbC";

    const batchProvideTx = await cpk.execTransactions(
      [
        {
          to: gelatoCore.address,
          operation: CPK.CALL,
          value: proxyEtherBalance, // Deposit 1 eth on Gelato,
          data: ifaceGelato.encodeFunctionData("multiProvide", [
            wallet.address, // Executor address (in this case user is its own executor)
            [],
            [gnosisSafeProviderModule],
          ]),
        },
      ],
      {
        gasLimit: 5000000,
      }
    );

    await batchProvideTx.transactionResponse.wait();

    console.log("Gelato Batch Enabled");

    const myGelatoProvider = {
      addr: cpk.address,
      module: gnosisSafeProviderModule,
    };

    const block = await wallet.provider.getBlock();
    console.log(block);
    console.log(`Current Block Time: ${block.timestamp}`);

    executionTime = block.timestamp + 5 * 60; // 5 minutes
    console.log(`Execution Time: ${executionTime}`);

    const timeCondition = new gelato.Condition({
      inst: gelatoAddresses.timeCondition,
      data: ethers.utils.defaultAbiCoder.encode(["uint256"], [executionTime]),
    });

    const removeFundingAction = new gelato.Action({
      addr: fixedProductMarketMaker.address,
      data: ifaceFixedProductMarketMaker.encodeFunctionData("removeFunding", [
        initialFunds,
      ]),
      operation: gelato.Operation.Call,
    });

    const task = new gelato.Task({
      conditions: [timeCondition],
      actions: [removeFundingAction],
      selfProviderGasLimit: 2000000,
    });

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

    console.log("Submit Task Successull");
  });

  test("Execute TaskReceipt with unlocked Executor", async () => {
    // Fetch event of the last task receipt
    const currentGelatoId = await gelatoCore.currentTaskReceiptId();
    const topics = gelatoCore.filters.LogTaskSubmitted(currentGelatoId).topics;

    const filter = {
      address: gelatoCore.address,
      blockHash: taskSubmitTxReceipt.blockhash,
      topics: topics,
    };

    let iface = new ethers.utils.Interface(gelato.GelatoCore.abi);

    const logs = await wallet.provider.getLogs(filter);

    const log = logs.find(
      (log) => log.transactionHash === taskSubmitTxReceipt.transactionHash
    );

    let event = iface.parseLog(log);

    const taskReceipt = event.args.taskReceipt;

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

    console.log("pre Can Exec");
    let canExecResult = await gelatoCore.canExec(
      taskReceipt,
      taskReceipt.tasks[0].selfProviderGasLimit,
      gelatoGasPrice
    );
    console.log(`Can Exec Result = ${canExecResult}`);

    await wallet.provider.send("evm_mine", [executionTime]);
    const block = await wallet.provider.getBlock();
    console.log(`Current time: ${block.timestamp}`);
    console.log(`Exec time: ${executionTime}`);

    console.log("pre Can Exec");
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
      parseFloat(fromWei(initialFunds))
    );

    console.log(`Pool Token Balance Pre: ${poolTokenBalanceBefore.toString()}`);

    await gelatoCore.exec(taskReceipt, {
      gasPrice: gelatoGasPrice,
      gasLimit: 5000000,
    });

    const poolTokenBalanceAfter = await fixedProductMarketMaker.balanceOf(
      cpk.address
    );
    console.log(`Pool Token Balance Post: ${poolTokenBalanceAfter.toString()}`);

    expect(parseFloat(fromWei(poolTokenBalanceAfter))).toBe(parseFloat("0"));
  });

  test("Check the conditional token balances", async () => {
    // conditionalTokens
    // The amount of conditional tokens to receive back should equal to
    // where:
    // Condtional token balance = Smallest conditional token balance we have
    // Rempved funds equal to balance of LP tokens
    // PoolShareSupply == Total supply of Pool => VERIDY
    // conditionalTokenBalance.mul(removedFunds).div(poolShareSupply)

    // 1. Remove funds and receive back outcome tokens for LP tokens => Done

    // 2. Check the balance of each outcome token
    const indexSet = getIndexSets(NUM_OUTCOMES);
    const parentCollectionId = ethers.constants.HashZero;
    let tokenBalances = [];
    for (let index of indexSet) {
      const collectionId = await conditionalTokens.getCollectionId(
        parentCollectionId,
        conditionId,
        index
      );

      const positionId = await conditionalTokens.getPositionId(
        dai.address,
        collectionId
      );

      const balanceOfSpecificToken = await conditionalTokens.balanceOf(
        cpk.address,
        positionId
      );
      tokenBalances.push(balanceOfSpecificToken);
    }

    // Reduce Token Balance to smallest number
    const conditionTokenAmountMerge = tokenBalances.reduce((min, amount) => {
      console.log(min);
      console.log(amount);
      return amount.lt(min) ? amount : min;
    });

    console.log(`Amount to be merged: ${conditionTokenAmountMerge}`);

    // console.log(`Collection Id: ${collectionId}`)
    // const positionId = await conditionalTokens.getPositionId(dai.address, collectionId)
    // console.log(`Position Id: ${positionId}`)

    // const balanceOfSpecificToken = await conditionalTokens.balanceOf(cpk.address, positionId)

    // 4. Call "MergePositions" with smallest outcome token balance available
    const daiBalanceBefore = await dai.balanceOf(cpk.address);
    console.log(`Dai Balance before: ${daiBalanceBefore.toString()}`);

    // Send Tx via Proxy
    let ifaceConditionalTokens = new ethers.utils.Interface(
      omen.conditionalTokens.abi
    );

    const mergeTx = await cpk.execTransactions(
      [
        {
          to: conditionalTokens.address,
          operation: CPK.CALL,
          value: 0,
          data: ifaceConditionalTokens.encodeFunctionData("mergePositions", [
            dai.address,
            parentCollectionId,
            conditionId,
            indexSet,
            conditionTokenAmountMerge,
          ]),
        },
      ],
      {
        gasLimit: 5000000,
      }
    );

    taskSubmitTxReceipt = await mergeTx.transactionResponse.wait();

    const daiBalanceAfter = await dai.balanceOf(cpk.address);
    console.log(`Dai Balance after: ${daiBalanceAfter.toString()}`);
    expect(parseFloat(fromWei(daiBalanceAfter))).toBe(
      parseFloat(fromWei(initialFunds))
    );
  });
});
