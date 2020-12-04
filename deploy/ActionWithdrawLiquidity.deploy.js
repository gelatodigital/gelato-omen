const hre = require("hardhat");
const { sleep } = require("@gelatonetwork/core");

module.exports = async (hre) => {
  if (hre.network.name === "mainnet") {
    console.log(
      "\n\n Deploying ConnectGelato to mainnet. Hit ctrl + c to abort"
    );
    console.log("❗ CONNECTOR DEPLOYMENT: VERIFY & HARDCODE CONNECTOR ID");
    await sleep(10000);
  }
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy("ActionWithdrawLiquidity", {
    from: deployer,
    args: [
      hre.network.config.addresses.gelatoCore,
      hre.network.config.addresses.externalProvider,
      hre.network.config.addresses.weth,
      hre.network.config.addresses.uniswapV2Router02,
      (await deployments.get("OracleAggregator")).address,
    ],
  });
};
module.exports.tags = ["ActionWithdrawLiquidity"];
module.exports.dependencies = ["OracleAggregator"];
