// eslint-disable no-console
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { CollateralDepositRecord } from '../typechain'

const { assertIsTestnetChain } = utils

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  console.log('Running WithdrawHook deployment script with', deployer, 'as the deployer')
  const currentChain = await getChainId()
  /**
   * Make sure this script is not accidentally targeted towards a production environment.
   * This can be temporarily removed if deploying to prod.
   */
  assertIsTestnetChain(currentChain as unknown as ChainId)
  // Retrieve existing non-upgradeable deployments using hardhat-deploy
  const collateralDepositRecord = (await ethers.getContract(
    'CollateralDepositRecord'
  )) as CollateralDepositRecord
  // Deploy WithdrawHook and configure external contracts to point to it
  const { address: withdrawHookAddress, newlyDeployed: withdrawHookNewlyDeployed } = await deploy(
    'WithdrawHook',
    {
      from: deployer,
      contract: 'WithdrawHook',
      deterministicDeployment: false,
      args: [collateralDepositRecord.address],
      skipIfAlreadyDeployed: true,
    }
  )
  if (withdrawHookNewlyDeployed) {
    console.log('Deployed WithdrawHook to', withdrawHookAddress)
  } else {
    console.log('Existing WithdrawHook at', withdrawHookAddress)
  }
  if (!(await collateralDepositRecord.isHookAllowed(withdrawHookAddress))) {
    console.log(
      'Configuring CollateralDepositRecord at',
      collateralDepositRecord.address,
      'to allow the WithdrawHook...'
    )
    const setAllowedHookTx = await collateralDepositRecord.setAllowedHook(withdrawHookAddress, true)
    await setAllowedHookTx.wait()
  }
  console.log('')
}

export default deployFunction

deployFunction.dependencies = ['CollateralDepositRecord']

deployFunction.tags = ['WithdrawHook']
