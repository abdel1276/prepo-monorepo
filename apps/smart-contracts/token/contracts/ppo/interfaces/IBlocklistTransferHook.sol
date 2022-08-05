// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import "./ITransferHook.sol";
import "./IAccountList.sol";

/**
 * @notice Hook that provides blocklist functionality for token transfers.
 * A blocked address cannot send or receive the specified ERC20 token.
 */
interface IBlocklistTransferHook is ITransferHook {
  /**
   * @notice Sets the `IAccountList` contract that specifies the addresses to
   * block.
   * @param newBlocklist Address of the `IAccountList` contract
   */
  function setBlocklist(IAccountList newBlocklist) external;

  ///@return The blocklist contract
  function getBlocklist() external view returns (IAccountList);
}