// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import {
    GelatoProviderModuleStandard
} from "@gelatonetwork/core/contracts/gelato_provider_modules/GelatoProviderModuleStandard.sol";
import {
    IProviderModuleGnosisSafe
} from "./dapp_interfaces/gnosis_safe/IProviderModuleGnosisSafe.sol";
import {Ownable} from "@gelatonetwork/core/contracts/external/Ownable.sol";
import {
    GelatoBytes
} from "@gelatonetwork/core/contracts/libraries/GelatoBytes.sol";
import {
    GelatoActionPipeline
} from "@gelatonetwork/core/contracts/gelato_actions/GelatoActionPipeline.sol";
import {IGnosisSafe} from "./dapp_interfaces/gnosis_safe/IGnosisSafe.sol";
import {
    Task
} from "@gelatonetwork/core/contracts/gelato_core/interfaces/IGelatoCore.sol";

contract ProviderModuleGnosisSafe is
    GelatoProviderModuleStandard,
    IProviderModuleGnosisSafe,
    Ownable
{
    using GelatoBytes for bytes;

    mapping(bytes32 => bool) public override isProxyExtcodehashProvided;
    mapping(address => bool) public override isMastercopyProvided;
    address public immutable override gelatoCore;
    address public immutable override gelatoActionPipeline;

    constructor(
        bytes32[] memory hashes,
        address[] memory masterCopies,
        address _gelatoCore,
        address _gelatoActionPipeline
    ) public {
        multiProvide(hashes, masterCopies);
        gelatoCore = _gelatoCore;
        gelatoActionPipeline = _gelatoActionPipeline;
    }

    // ================= GELATO PROVIDER MODULE STANDARD ================
    // @dev since we check extcodehash prior to execution, we forego the execution option
    //  where the userProxy is deployed at execution time.
    function isProvided(
        address _userProxy,
        address,
        Task calldata
    ) external view override returns (string memory) {
        bytes32 codehash;
        assembly {
            codehash := extcodehash(_userProxy)
        }
        if (!isProxyExtcodehashProvided[codehash])
            return
                "ProviderModuleGnosisSafeProxy.isProvided:InvalidGSPCodehash";
        address mastercopy = IGnosisSafe(_userProxy).masterCopy();
        if (!isMastercopyProvided[mastercopy])
            return
                "ProviderModuleGnosisSafeProxy.isProvided:InvalidGSPMastercopy";
        if (!_isGelatoCoreWhitelisted(_userProxy))
            return
                "ProviderModuleGnosisSafeProxy.isProvided:GelatoCoreNotWhitelisted";
        return OK;
    }

    // solhint-disable function-max-lines
    function execPayload(
        uint256,
        address,
        address,
        Task calldata _task,
        uint256
    )
        external
        view
        override
        returns (bytes memory payload, bool proxyReturndataCheck)
    {
        // execTransactionFromModuleReturnData catches reverts so must check for reverts
        proxyReturndataCheck = true;

        if (_task.actions.length == 1) {
            payload = abi.encodeWithSelector(
                IGnosisSafe.execTransactionFromModuleReturnData.selector,
                _task.actions[0].addr, // to
                _task.actions[0].value,
                _task.actions[0].data,
                _task.actions[0].operation
            );
        } else if (_task.actions.length > 1) {
            // Action.Operation encoded into multiSendPayload and handled by Multisend
            bytes memory gelatoActionPipelinePayload =
                abi.encodeWithSelector(
                    GelatoActionPipeline.execActionsAndPipeData.selector,
                    _task.actions
                );

            payload = abi.encodeWithSelector(
                IGnosisSafe.execTransactionFromModuleReturnData.selector,
                gelatoActionPipeline, // to
                0, // value
                gelatoActionPipelinePayload, // data
                IGnosisSafe.Operation.DelegateCall
            );
        } else {
            revert(
                "ProviderModuleGnosisSafeProxy.execPayload: 0 _task.actions length"
            );
        }
    }

    function execRevertCheck(bytes calldata _proxyReturndata)
        external
        pure
        virtual
        override
    {
        (bool success, bytes memory returndata) =
            abi.decode(_proxyReturndata, (bool, bytes));
        if (!success)
            returndata.revertWithErrorString(":ProviderModuleGnosisSafeProxy:");
    }

    // GnosisSafeProxy
    function provideProxyExtcodehashes(bytes32[] memory _hashes)
        public
        override
        onlyOwner
    {
        for (uint256 i; i < _hashes.length; i++) {
            require(
                !isProxyExtcodehashProvided[_hashes[i]],
                "ProviderModuleGnosisSafeProxy.provideProxyExtcodehashes: redundant"
            );
            isProxyExtcodehashProvided[_hashes[i]] = true;
            emit LogProvideProxyExtcodehash(_hashes[i]);
        }
    }

    function unprovideProxyExtcodehashes(bytes32[] memory _hashes)
        public
        override
        onlyOwner
    {
        for (uint256 i; i < _hashes.length; i++) {
            require(
                isProxyExtcodehashProvided[_hashes[i]],
                "ProviderModuleGnosisSafeProxy.unprovideProxyExtcodehashes: redundant"
            );
            delete isProxyExtcodehashProvided[_hashes[i]];
            emit LogUnprovideProxyExtcodehash(_hashes[i]);
        }
    }

    function provideMastercopies(address[] memory _mastercopies)
        public
        override
        onlyOwner
    {
        for (uint256 i; i < _mastercopies.length; i++) {
            require(
                !isMastercopyProvided[_mastercopies[i]],
                "ProviderModuleGnosisSafeProxy.provideMastercopy: redundant"
            );
            isMastercopyProvided[_mastercopies[i]] = true;
            emit LogProvideMastercopy(_mastercopies[i]);
        }
    }

    function unprovideMastercopies(address[] memory _mastercopies)
        public
        override
        onlyOwner
    {
        for (uint256 i; i < _mastercopies.length; i++) {
            require(
                isMastercopyProvided[_mastercopies[i]],
                "ProviderModuleGnosisSafeProxy.unprovideMastercopies: redundant"
            );
            delete isMastercopyProvided[_mastercopies[i]];
            emit LogUnprovideMastercopy(_mastercopies[i]);
        }
    }

    // Batch (un-)provide
    function multiProvide(
        bytes32[] memory _hashes,
        address[] memory _mastercopies
    ) public override onlyOwner {
        provideProxyExtcodehashes(_hashes);
        provideMastercopies(_mastercopies);
    }

    function multiUnprovide(
        bytes32[] calldata _hashes,
        address[] calldata _mastercopies
    ) external override onlyOwner {
        unprovideProxyExtcodehashes(_hashes);
        unprovideMastercopies(_mastercopies);
    }

    function _isGelatoCoreWhitelisted(address _userProxy)
        internal
        view
        returns (bool)
    {
        address[] memory whitelistedModules =
            IGnosisSafe(_userProxy).getModules();
        for (uint256 i = 0; i < whitelistedModules.length; i++)
            if (whitelistedModules[i] == gelatoCore) return true;
        return false;
    }
}
