const { sleep } = require("@gelatonetwork/core");

module.exports = async (hre) => {
  if (hre.network.name === "mainnet") {
    console.log(
      "\n\n Deploying OracleAggregator to mainnet. Hit ctrl + c to abort"
    );
    console.log("❗ CONNECTOR DEPLOYMENT: VERIFY");
    await sleep(10000);
  }
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy("OracleAggregator", {
    from: deployer,
  });
};
module.exports.tags = ["OracleAggregator"];
