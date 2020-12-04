pragma solidity ^0.6.1;

import {Ownable} from "@gelatonetwork/core/contracts/external/Ownable.sol";
import {SafeMath} from "@gelatonetwork/core/contracts/external/SafeMath.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

contract OracleAggregator is Ownable {
    using SafeMath for uint256;
    address private ETH_ADDRESS;
    address private USD_ADDRESS;

    mapping(address => mapping(address => address)) private tokenPairAddress;
    mapping(address => uint256) private nrOfDecimals_usd;

    constructor() public {
        nrOfDecimals_usd[0x7354C81fbCb229187480c4f497F945C6A312d5C3] = 8; /// USD
        nrOfDecimals_usd[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 6; /// USDT
        nrOfDecimals_usd[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = 6; /// USDC
        nrOfDecimals_usd[0x6B175474E89094C44Da98b954EedeAC495271d0F] = 18; /// DAI
        nrOfDecimals_usd[0x4Fabb145d64652a948d72533023f6E7A623C7C53] = 18; /// BUSD
        nrOfDecimals_usd[0x57Ab1ec28D129707052df4dF418D58a2D46d5f51] = 18; /// SUSD
        nrOfDecimals_usd[0x0000000000085d4780B73119b644AE5ecd22b376] = 18; /// TUSD

        ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
        USD_ADDRESS = 0x7354C81fbCb229187480c4f497F945C6A312d5C3; /// Random address

        tokenPairAddress[0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9][
            ETH_ADDRESS
        ] = 0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012; /// AAVE/ETH
        tokenPairAddress[0xADE00C28244d5CE17D72E40330B1c318cD12B7c3][
            USD_ADDRESS
        ] = 0x231e764B44b2C1b7Ca171fa8021A24ed520Cde10; /// ADX/USD

        tokenPairAddress[0x0D8775F648430679A709E98d2b0Cb6250d2887EF][
            ETH_ADDRESS
        ] = 0x0d16d4528239e9ee52fa531af613AcdB23D88c94; /// BAT/ETH
        tokenPairAddress[0xB8c77482e45F1F44dE1745F52C74426C631bDD52][
            USD_ADDRESS
        ] = 0x14e613AC84a31f709eadbdF89C6CC390fDc9540A; /// BNB/USD
        tokenPairAddress[0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C][
            ETH_ADDRESS
        ] = 0xCf61d1841B178fe82C8895fe60c2EDDa08314416; /// BNT/ETH
        tokenPairAddress[0x56d811088235F11C8920698a204A5010a788f4b3][
            ETH_ADDRESS
        ] = 0x8f7C7181Ed1a2BA41cfC3f5d064eF91b67daef66; /// BZRX/ETH

        tokenPairAddress[0xc00e94Cb662C3520282E6f5717214004A7f26888][
            ETH_ADDRESS
        ] = 0x1B39Ee86Ec5979ba5C322b826B3ECb8C79991699; /// COMP/ETH
        tokenPairAddress[0xc00e94Cb662C3520282E6f5717214004A7f26888][
            USD_ADDRESS
        ] = 0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5; /// COMP/USD
        tokenPairAddress[0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b][
            ETH_ADDRESS
        ] = 0xcA696a9Eb93b81ADFE6435759A29aB4cf2991A96; /// CRO/ETH

        tokenPairAddress[0xEd91879919B71bB6905f23af0A68d231EcF87b14][
            ETH_ADDRESS
        ] = 0xD010e899f7ab723AC93f825cDC5Aa057669557c2; /// DMG/ETH

        tokenPairAddress[0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c][
            ETH_ADDRESS
        ] = 0x24D9aB51950F3d62E9144fdC2f3135DAA6Ce8D1B; /// ENJ/ETH
        tokenPairAddress[ETH_ADDRESS][
            USD_ADDRESS
        ] = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419; /// ETH/USD

        tokenPairAddress[0xdd974D5C2e2928deA5F71b9825b8b646686BD200][
            ETH_ADDRESS
        ] = 0x656c0544eF4C98A6a98491833A89204Abb045d6b; /// KNC/ETH
        tokenPairAddress[0xdd974D5C2e2928deA5F71b9825b8b646686BD200][
            USD_ADDRESS
        ] = 0xf8fF43E991A81e6eC886a3D281A2C6cC19aE70Fc; /// KNC/USD

        tokenPairAddress[0x514910771AF9Ca656af840dff83E8264EcF986CA][
            USD_ADDRESS
        ] = 0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c; /// LINK/USD
        tokenPairAddress[0x514910771AF9Ca656af840dff83E8264EcF986CA][
            ETH_ADDRESS
        ] = 0xDC530D9457755926550b59e8ECcdaE7624181557; /// LINK/ETH
        tokenPairAddress[0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD][
            ETH_ADDRESS
        ] = 0x160AC928A16C93eD4895C2De6f81ECcE9a7eB7b4; /// LRC/ETH
        tokenPairAddress[0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD][
            USD_ADDRESS
        ] = 0x231e764B44b2C1b7Ca171fa8021A24ed520Cde10; /// LRC/USD

        tokenPairAddress[0x0F5D2fB29fb7d3CFeE444a200298f468908cC942][
            ETH_ADDRESS
        ] = 0x82A44D92D6c329826dc557c5E1Be6ebeC5D5FeB9; /// MANA/ETH
        tokenPairAddress[0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2][
            ETH_ADDRESS
        ] = 0x24551a8Fb2A7211A25a17B1481f043A8a8adC7f2; /// MKR/ETH

        tokenPairAddress[0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671][
            ETH_ADDRESS
        ] = 0x9cB2A01A7E64992d32A34db7cEea4c919C391f6A; /// NMR/ETH

        tokenPairAddress[0x408e41876cCCDC0F92210600ef50372656052a38][
            ETH_ADDRESS
        ] = 0x3147D7203354Dc06D9fd350c7a2437bcA92387a4; /// REN/ETH
        tokenPairAddress[0x408e41876cCCDC0F92210600ef50372656052a38][
            USD_ADDRESS
        ] = 0x0f59666EDE214281e956cb3b2D0d69415AfF4A01; /// REN/USD
        tokenPairAddress[0x221657776846890989a759BA2973e427DfF5C9bB][
            ETH_ADDRESS
        ] = 0xD4CE430C3b67b3E2F7026D86E7128588629e2455; /// REP/ETH

        tokenPairAddress[0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F][
            ETH_ADDRESS
        ] = 0x79291A9d692Df95334B1a0B3B4AE6bC606782f8c; /// SNX/ETH
        tokenPairAddress[0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F][
            USD_ADDRESS
        ] = 0xDC3EA94CD0AC27d9A86C180091e7f78C683d3699; /// SNX/USD
        tokenPairAddress[0x8CE9137d39326AD0cD6491fb5CC0CbA0e089b6A9][
            USD_ADDRESS
        ] = 0xFb0CfD6c19e25DB4a08D8a204a387cEa48Cc138f; /// SXP/USD

        tokenPairAddress[0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984][
            ETH_ADDRESS
        ] = 0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e; /// UNI/ETH
        tokenPairAddress[USD_ADDRESS][
            ETH_ADDRESS
        ] = 0x986b5E1e1755e3C2440e960477f25201B0a8bbD4; /// USDC/ETH

        tokenPairAddress[0xa982B2e19e90b2D9F7948e9C1b65D119F1CE88D6][
            ETH_ADDRESS
        ] = 0xcEBD2026d3C99F2a7CE028acf372C154aB4638a9; /// WOM/ETH

        tokenPairAddress[0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e][
            ETH_ADDRESS
        ] = 0x7c5d4F8345e66f68099581Db340cd65B078C41f4; /// YFI/ETH

        tokenPairAddress[0xE41d2489571d322189246DaFA5ebDe1F4699F498][
            ETH_ADDRESS
        ] = 0x2Da4983a622a8498bb1a21FaE9D8F6C664939962; /// ZRX/ETH
    }

    function addToken(
        address tokenAddress_a,
        address tokenAddress_b,
        address _tokenPairAddress
    ) public onlyOwner {
        tokenPairAddress[tokenAddress_a][tokenAddress_b] = _tokenPairAddress;
    }

    function getExpectedReturnAmount(
        uint256 amount,
        address tokenAddress_a,
        address tokenAddress_b
    ) public view returns (uint256 returnAmount) {
        require(amount > 0);

        uint256 returnRate_a;
        uint256 returnRate_b;
        address pair_a;
        address pair_b;
        uint256 nrOfDecimals;

        address stableCoinAddress =
            nrOfDecimals_usd[tokenAddress_b] > 0 ? tokenAddress_b : address(0);

        (tokenAddress_a, tokenAddress_b) = convertUSD(
            tokenAddress_a,
            tokenAddress_b
        );

        /// when token_b is ETH or USD
        if (tokenAddress_b == ETH_ADDRESS || tokenAddress_b == USD_ADDRESS) {
            /// oracle of token_a / token_b exists
            /// e.g. calculating KNC/ETH
            /// KNC/ETH oracle available
            if (
                tokenPairAddress[tokenAddress_a][tokenAddress_b] != address(0)
            ) {
                (returnRate_a, nrOfDecimals) = getRate(
                    tokenAddress_a,
                    tokenAddress_b
                );

                returnAmount = stableCoinAddress != address(0)
                    ? matchStableCoinDecimal(
                        stableCoinAddress,
                        amount,
                        nrOfDecimals,
                        0,
                        returnRate_a,
                        1
                    )
                    : amount * returnRate_a;

                nrOfDecimals = stableCoinAddress != address(0)
                    ? nrOfDecimals_usd[stableCoinAddress]
                    : nrOfDecimals;

                return (returnAmount.div(10**nrOfDecimals));
            } else {
                /// oracle of token_a / token_b does not exist
                /// e.g. calculating UNI/USD
                /// UNI/ETH and USD/ETH oracles available
                (pair_a, pair_b) = checkAvailablePair(
                    tokenAddress_a,
                    tokenAddress_b
                );
                if (pair_a == address(0) && pair_b == address(0)) return (0);
                (returnRate_a, ) = getRate(tokenAddress_a, pair_a);
                (returnRate_b, nrOfDecimals) = getRate(tokenAddress_b, pair_b);

                returnAmount = stableCoinAddress != address(0)
                    ? matchStableCoinDecimal(
                        stableCoinAddress,
                        amount,
                        nrOfDecimals,
                        nrOfDecimals,
                        returnRate_a,
                        returnRate_b
                    )
                    : (amount * (returnRate_a * 10**nrOfDecimals)) /
                        returnRate_b;

                nrOfDecimals = stableCoinAddress != address(0)
                    ? nrOfDecimals_usd[stableCoinAddress]
                    : nrOfDecimals;

                returnAmount =
                    (amount * (returnRate_a * 10**nrOfDecimals)) /
                    returnRate_b;

                return (returnAmount.div(10**nrOfDecimals));
            }
        } else {
            ///when token_b is not ETH or USD
            (pair_a, pair_b) = checkAvailablePair(
                tokenAddress_a,
                tokenAddress_b
            );
            if (pair_a == address(0) && pair_b == address(0)) return (0);
            /// oracle of token_a/ETH, token_b/ETH || token_a/USD, token_b/USD exists
            /// e.g. calculating KNC/UNI where
            /// KNC/ETH and UNI/ETH oracles available
            if (pair_a == pair_b) {
                (returnRate_a, nrOfDecimals) = getRate(tokenAddress_a, pair_a);
                (returnRate_b, ) = getRate(tokenAddress_b, pair_b);

                returnAmount =
                    (amount * (returnRate_a * 10**nrOfDecimals)) /
                    returnRate_b;

                return (returnAmount.div(10**nrOfDecimals));
            } else if (pair_a == ETH_ADDRESS && pair_b == USD_ADDRESS) {
                /// oracle of token_a/ETH and token_b/USD exists
                /// e.g. calculating UNI/SXP where
                /// UNI/ETH and SXP/USD oracles available
                (returnRate_a, nrOfDecimals) = getRate(tokenAddress_a, pair_a);
                (returnRate_b, ) = getRate(tokenAddress_b, pair_b);
                (uint256 returnRate_ETHUSD, ) =
                    getRate(ETH_ADDRESS, USD_ADDRESS);

                uint256 returnRate_aUSD = returnRate_a * returnRate_ETHUSD;

                returnAmount = (amount * returnRate_aUSD) / returnRate_b;

                return (returnAmount.div(10**nrOfDecimals));
            } else if (pair_a == USD_ADDRESS && pair_b == ETH_ADDRESS) {
                /// oracle of token_a/USD and token_b/ETH exists
                /// e.g. calculating SXP/UNI where
                /// SXP/USD and UNI/ETH oracles available
                (returnRate_a, nrOfDecimals) = getRate(tokenAddress_a, pair_a);
                (returnRate_b, ) = getRate(tokenAddress_b, pair_b);
                (uint256 returnRate_USDETH, uint256 nrOfDecimals_USDETH) =
                    getRate(USD_ADDRESS, ETH_ADDRESS);

                uint256 returnRate_aETH = returnRate_a * returnRate_USDETH;

                returnAmount =
                    ((amount * returnRate_aETH) / returnRate_b) *
                    10**(nrOfDecimals_USDETH - nrOfDecimals);

                return (returnAmount.div(10**nrOfDecimals_USDETH));
            }
        }
    }

    /// check the available oracles for token a & b and choose which oracles to use
    function checkAvailablePair(address tokenAddress_a, address tokenAddress_b)
        private
        view
        returns (address, address)
    {
        if (
            tokenPairAddress[tokenAddress_a][USD_ADDRESS] != address(0) &&
            tokenPairAddress[tokenAddress_b][USD_ADDRESS] != address(0)
        ) {
            return (USD_ADDRESS, USD_ADDRESS);
        } else if (
            tokenPairAddress[tokenAddress_a][ETH_ADDRESS] != address(0) &&
            tokenPairAddress[tokenAddress_b][ETH_ADDRESS] != address(0)
        ) {
            return (ETH_ADDRESS, ETH_ADDRESS);
        } else if (
            tokenPairAddress[tokenAddress_a][ETH_ADDRESS] != address(0) &&
            tokenPairAddress[tokenAddress_b][USD_ADDRESS] != address(0)
        ) {
            return (ETH_ADDRESS, USD_ADDRESS);
        } else if (
            tokenPairAddress[tokenAddress_a][USD_ADDRESS] != address(0) &&
            tokenPairAddress[tokenAddress_b][ETH_ADDRESS] != address(0)
        ) {
            return (USD_ADDRESS, ETH_ADDRESS);
        } else {
            return (address(0), address(0));
        }
    }

    function getRate(address tokenAddress_a, address tokenAddress_b)
        private
        view
        returns (uint256 tokenPrice, uint256 nrOfDecimals)
    {
        if (tokenAddress_a == tokenAddress_b) {
            return (1, 0);
        } else {
            AggregatorV3Interface priceFeed;

            priceFeed = AggregatorV3Interface(
                tokenPairAddress[tokenAddress_a][tokenAddress_b]
            );

            (, int256 price, , , ) = priceFeed.latestRoundData();

            nrOfDecimals = priceFeed.decimals();
            tokenPrice = uint256(price);

            return (tokenPrice, nrOfDecimals);
        }
    }

    /// converting all usd pegged stablecoins to single USD address
    function convertUSD(address tokenAddress_a, address tokenAddress_b)
        private
        view
        returns (address, address)
    {
        if (
            nrOfDecimals_usd[tokenAddress_a] > 0 &&
            nrOfDecimals_usd[tokenAddress_b] > 0
        ) {
            return (USD_ADDRESS, USD_ADDRESS);
        } else if (nrOfDecimals_usd[tokenAddress_a] > 0) {
            return (USD_ADDRESS, tokenAddress_b);
        } else if (nrOfDecimals_usd[tokenAddress_b] > 0) {
            return (tokenAddress_a, USD_ADDRESS);
        } else {
            return (tokenAddress_a, tokenAddress_b);
        }
    }

    /// modify nrOfDecimlas and amount to follow stableCoin's nrOfDecimals
    function matchStableCoinDecimal(
        address stableCoinAddress,
        uint256 amount,
        uint256 nrOfDecimals,
        uint256 padding,
        uint256 returnRate_a,
        uint256 returnRate_b
    ) private view returns (uint256 returnAmount) {
        uint256 div =
            nrOfDecimals_usd[stableCoinAddress] > nrOfDecimals
                ? 10**(nrOfDecimals_usd[stableCoinAddress] - nrOfDecimals)
                : 10**(nrOfDecimals - nrOfDecimals_usd[stableCoinAddress]);

        returnAmount = nrOfDecimals_usd[stableCoinAddress] > nrOfDecimals
            ? ((amount * (returnRate_a * 10**padding)) / returnRate_b) * div
            : (amount * (returnRate_a * 10**padding)) / returnRate_b / div;

        return (returnAmount);
    }
}
