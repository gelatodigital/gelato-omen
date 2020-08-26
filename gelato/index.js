const actionWithdrawLiquidity = require("./abis/ActionWithdrawLiquidity.json");
const uniswapV2Router = require("./abis/UniswapV2Router.json");

module.exports = {
  actionWithdrawLiquidity: {
    abi: actionWithdrawLiquidity.abi,
    bytecode: actionWithdrawLiquidity.bytecode,
  },
  uniswapV2Router: {
    abi: uniswapV2Router.abi,
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  },
};
