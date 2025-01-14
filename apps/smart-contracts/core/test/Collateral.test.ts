import chai, { expect } from 'chai'
import { ethers, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseEther, parseUnits } from 'ethers/lib/utils'
import { BigNumber, Contract } from 'ethers'
import { MockContract, smock } from '@defi-wonderland/smock'
import { DEFAULT_ADMIN_ROLE, ZERO_ADDRESS } from 'prepo-constants'
import { smockManagerWithdrawHookFixture } from './fixtures/HookFixture'
import { collateralFixture } from './fixtures/CollateralFixture'
import { smockCollateralDepositRecordFixture } from './fixtures/CollateralDepositRecordFixture'
import { testERC20Fixture } from './fixtures/TestERC20Fixture'
import { FEE_DENOMINATOR, grantAndAcceptRole, PERCENT_DENOMINATOR } from './utils'
import { Collateral, TestERC20 } from '../typechain'

chai.use(smock.matchers)

describe('=> Collateral', () => {
  let deployer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let manager: SignerWithAddress
  let baseToken: TestERC20
  let collateral: Collateral
  let depositRecord: MockContract<Contract>
  let managerWithdrawHook: MockContract<Contract>
  const TEST_DEPOSIT_FEE = 1000 // 0.1%
  const TEST_WITHDRAW_FEE = 2000 // 0.2%
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_USER_DEPOSIT_CAP = parseEther('50')
  const TEST_MIN_RESERVE_PERCENTAGE = 250000 // 25%
  const USDC_DECIMALS = 6

  const getSignersAndDeployCollateral = async (): Promise<void> => {
    ;[deployer, manager, user1, user2] = await ethers.getSigners()
    baseToken = await testERC20Fixture('USD Coin', 'USDC', USDC_DECIMALS)
    collateral = await collateralFixture(
      'prePO USDC Collateral',
      'preUSD',
      baseToken.address,
      USDC_DECIMALS
    )
    depositRecord = await smockCollateralDepositRecordFixture(
      TEST_GLOBAL_DEPOSIT_CAP,
      TEST_USER_DEPOSIT_CAP
    )
    managerWithdrawHook = await smockManagerWithdrawHookFixture(depositRecord.address)
    await grantAndAcceptRole(
      managerWithdrawHook,
      deployer,
      deployer,
      await managerWithdrawHook.SET_COLLATERAL_ROLE()
    )
    await grantAndAcceptRole(
      managerWithdrawHook,
      deployer,
      deployer,
      await managerWithdrawHook.SET_MIN_RESERVE_PERCENTAGE_ROLE()
    )
    await managerWithdrawHook.connect(deployer).setCollateral(collateral.address)
    await managerWithdrawHook.connect(deployer).setMinReservePercentage(TEST_MIN_RESERVE_PERCENTAGE)
  }

  const setupCollateral = async (): Promise<void> => {
    await getSignersAndDeployCollateral()
    await grantAndAcceptRole(
      collateral,
      deployer,
      deployer,
      await collateral.MANAGER_WITHDRAW_ROLE()
    )
    await grantAndAcceptRole(collateral, deployer, deployer, await collateral.SET_MANAGER_ROLE())
    await grantAndAcceptRole(
      collateral,
      deployer,
      deployer,
      await collateral.SET_DEPOSIT_FEE_ROLE()
    )
    await grantAndAcceptRole(
      collateral,
      deployer,
      deployer,
      await collateral.SET_WITHDRAW_FEE_ROLE()
    )
    await grantAndAcceptRole(
      collateral,
      deployer,
      deployer,
      await collateral.SET_DEPOSIT_HOOK_ROLE()
    )
    await grantAndAcceptRole(
      collateral,
      deployer,
      deployer,
      await collateral.SET_WITHDRAW_HOOK_ROLE()
    )
    await grantAndAcceptRole(
      collateral,
      deployer,
      deployer,
      await collateral.SET_MANAGER_WITHDRAW_HOOK_ROLE()
    )
    await collateral.connect(deployer).setManager(manager.address)
  }

  before(() => {
    upgrades.silenceWarnings()
  })

  describe('initial state', () => {
    beforeEach(async () => {
      await getSignersAndDeployCollateral()
    })

    it('sets base token from constructor', async () => {
      expect(await collateral.getBaseToken()).to.eq(baseToken.address)
    })

    it('sets name from initialize', async () => {
      expect(await collateral.name()).to.eq('prePO USDC Collateral')
    })

    it('sets symbol from initialize', async () => {
      expect(await collateral.symbol()).to.eq('preUSD')
    })

    it('sets DEFAULT_ADMIN_ROLE holder to deployer', async () => {
      expect(await collateral.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.eq(true)
    })

    it('sets role constants to the correct hash', async () => {
      expect(await collateral.MANAGER_WITHDRAW_ROLE()).to.eq(
        id('Collateral_managerWithdraw(uint256)')
      )
      expect(await collateral.SET_MANAGER_ROLE()).to.eq(id('Collateral_setManager(address)'))
      expect(await collateral.SET_DEPOSIT_FEE_ROLE()).to.eq(id('Collateral_setDepositFee(uint256)'))
      expect(await collateral.SET_WITHDRAW_FEE_ROLE()).to.eq(
        id('Collateral_setWithdrawFee(uint256)')
      )
      expect(await collateral.SET_DEPOSIT_HOOK_ROLE()).to.eq(id('Collateral_setDepositHook(IHook)'))
      expect(await collateral.SET_WITHDRAW_HOOK_ROLE()).to.eq(
        id('Collateral_setWithdrawHook(IHook)')
      )
      expect(await collateral.SET_MANAGER_WITHDRAW_HOOK_ROLE()).to.eq(
        id('Collateral_setManagerWithdrawHook(IHook)')
      )
    })
  })

  describe('# setManager ', () => {
    beforeEach(async () => {
      await getSignersAndDeployCollateral()
      await grantAndAcceptRole(collateral, deployer, deployer, await collateral.SET_MANAGER_ROLE())
    })

    it('reverts if not role holder', async () => {
      expect(await collateral.hasRole(await collateral.SET_MANAGER_ROLE(), user1.address)).to.eq(
        false
      )

      await expect(collateral.connect(user1).setManager(manager.address)).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.SET_MANAGER_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      expect(await collateral.getManager()).to.not.eq(manager.address)

      await collateral.connect(deployer).setManager(manager.address)

      expect(await collateral.getManager()).to.eq(manager.address)
    })

    it('sets to zero address', async () => {
      await collateral.connect(deployer).setManager(manager.address)
      expect(await collateral.getManager()).to.not.eq(ZERO_ADDRESS)

      await collateral.connect(deployer).setManager(ZERO_ADDRESS)

      expect(await collateral.getManager()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await collateral.getManager()).to.not.eq(manager.address)

      await collateral.connect(deployer).setManager(manager.address)

      expect(await collateral.getManager()).to.eq(manager.address)

      await collateral.connect(deployer).setManager(manager.address)

      expect(await collateral.getManager()).to.eq(manager.address)
    })

    it('emits ManagerChange', async () => {
      const tx = await collateral.connect(deployer).setManager(manager.address)

      await expect(tx).to.emit(collateral, 'ManagerChange').withArgs(manager.address)
    })
  })

  describe('# setDepositFee', () => {
    beforeEach(async () => {
      await getSignersAndDeployCollateral()
      await grantAndAcceptRole(
        collateral,
        deployer,
        deployer,
        await collateral.SET_DEPOSIT_FEE_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_DEPOSIT_FEE_ROLE(), user1.address)
      ).to.eq(false)

      await expect(collateral.connect(user1).setDepositFee(TEST_DEPOSIT_FEE)).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.SET_DEPOSIT_FEE_ROLE()}`
      )
    })

    it('sets to non-zero value', async () => {
      expect(TEST_DEPOSIT_FEE).to.not.eq(0)
      expect(await collateral.getDepositFee()).to.not.eq(TEST_DEPOSIT_FEE)

      await collateral.connect(deployer).setDepositFee(TEST_DEPOSIT_FEE)

      expect(await collateral.getDepositFee()).to.eq(TEST_DEPOSIT_FEE)
    })

    it('sets to zero', async () => {
      await collateral.connect(deployer).setDepositFee(TEST_DEPOSIT_FEE)
      expect(await collateral.getDepositFee()).to.not.eq(0)

      await collateral.connect(deployer).setDepositFee(0)

      expect(await collateral.getDepositFee()).to.eq(0)
    })

    it('is idempotent', async () => {
      expect(await collateral.getDepositFee()).to.not.eq(TEST_DEPOSIT_FEE)

      await collateral.connect(deployer).setDepositFee(TEST_DEPOSIT_FEE)

      expect(await collateral.getDepositFee()).to.eq(TEST_DEPOSIT_FEE)

      await collateral.connect(deployer).setDepositFee(TEST_DEPOSIT_FEE)

      expect(await collateral.getDepositFee()).to.eq(TEST_DEPOSIT_FEE)
    })

    it('emits DepositFeeChange', async () => {
      const tx = await collateral.connect(deployer).setDepositFee(TEST_DEPOSIT_FEE)

      await expect(tx).to.emit(collateral, 'DepositFeeChange').withArgs(TEST_DEPOSIT_FEE)
    })
  })

  describe('# setWithdrawFee', () => {
    beforeEach(async () => {
      await getSignersAndDeployCollateral()
      await grantAndAcceptRole(
        collateral,
        deployer,
        deployer,
        await collateral.SET_WITHDRAW_FEE_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_WITHDRAW_FEE_ROLE(), user1.address)
      ).to.eq(false)

      await expect(collateral.connect(user1).setWithdrawFee(TEST_WITHDRAW_FEE)).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.SET_WITHDRAW_FEE_ROLE()}`
      )
    })

    it('sets to non-zero value', async () => {
      expect(TEST_WITHDRAW_FEE).to.not.eq(0)
      expect(await collateral.getWithdrawFee()).to.not.eq(TEST_WITHDRAW_FEE)

      await collateral.connect(deployer).setWithdrawFee(TEST_WITHDRAW_FEE)

      expect(await collateral.getWithdrawFee()).to.eq(TEST_WITHDRAW_FEE)
    })

    it('sets to zero', async () => {
      await collateral.connect(deployer).setWithdrawFee(TEST_WITHDRAW_FEE)
      expect(await collateral.getWithdrawFee()).to.not.eq(0)

      await collateral.connect(deployer).setWithdrawFee(0)

      expect(await collateral.getWithdrawFee()).to.eq(0)
    })

    it('is idempotent', async () => {
      expect(await collateral.getWithdrawFee()).to.not.eq(TEST_WITHDRAW_FEE)

      await collateral.connect(deployer).setWithdrawFee(TEST_WITHDRAW_FEE)

      expect(await collateral.getWithdrawFee()).to.eq(TEST_WITHDRAW_FEE)

      await collateral.connect(deployer).setWithdrawFee(TEST_WITHDRAW_FEE)

      expect(await collateral.getWithdrawFee()).to.eq(TEST_WITHDRAW_FEE)
    })

    it('emits WithdrawFeeChange', async () => {
      const tx = await collateral.connect(deployer).setWithdrawFee(TEST_WITHDRAW_FEE)

      await expect(tx).to.emit(collateral, 'WithdrawFeeChange').withArgs(TEST_WITHDRAW_FEE)
    })
  })

  describe('# setDepositHook', () => {
    beforeEach(async () => {
      await getSignersAndDeployCollateral()
      await grantAndAcceptRole(
        collateral,
        deployer,
        deployer,
        await collateral.SET_DEPOSIT_HOOK_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_DEPOSIT_HOOK_ROLE(), user1.address)
      ).to.eq(false)

      await expect(collateral.connect(user1).setDepositHook(user1.address)).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.SET_DEPOSIT_HOOK_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      expect(await collateral.getDepositHook()).to.not.eq(user1.address)

      await collateral.connect(deployer).setDepositHook(user1.address)

      expect(await collateral.getDepositHook()).to.eq(user1.address)
    })

    it('sets to zero address', async () => {
      await collateral.connect(deployer).setDepositHook(user1.address)
      expect(await collateral.getDepositHook()).to.not.eq(ZERO_ADDRESS)

      await collateral.connect(deployer).setDepositHook(ZERO_ADDRESS)

      expect(await collateral.getDepositHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await collateral.getDepositHook()).to.not.eq(user1.address)

      await collateral.connect(deployer).setDepositHook(user1.address)

      expect(await collateral.getDepositHook()).to.eq(user1.address)

      await collateral.connect(deployer).setDepositHook(user1.address)

      expect(await collateral.getDepositHook()).to.eq(user1.address)
    })

    it('emits DepositHookChange', async () => {
      const tx = await collateral.connect(deployer).setDepositHook(user1.address)

      await expect(tx).to.emit(collateral, 'DepositHookChange').withArgs(user1.address)
    })
  })

  describe('# setWithdrawHook', () => {
    beforeEach(async () => {
      await getSignersAndDeployCollateral()
      await grantAndAcceptRole(
        collateral,
        deployer,
        deployer,
        await collateral.SET_WITHDRAW_HOOK_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_WITHDRAW_HOOK_ROLE(), user1.address)
      ).to.eq(false)

      await expect(collateral.connect(user1).setWithdrawHook(user1.address)).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.SET_WITHDRAW_HOOK_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      expect(await collateral.getWithdrawHook()).to.not.eq(user1.address)

      await collateral.connect(deployer).setWithdrawHook(user1.address)

      expect(await collateral.getWithdrawHook()).to.eq(user1.address)
    })

    it('sets to zero address', async () => {
      await collateral.connect(deployer).setWithdrawHook(user1.address)
      expect(await collateral.getWithdrawHook()).to.not.eq(ZERO_ADDRESS)

      await collateral.connect(deployer).setWithdrawHook(ZERO_ADDRESS)

      expect(await collateral.getWithdrawHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await collateral.getWithdrawHook()).to.not.eq(user1.address)

      await collateral.connect(deployer).setWithdrawHook(user1.address)

      expect(await collateral.getWithdrawHook()).to.eq(user1.address)

      await collateral.connect(deployer).setWithdrawHook(user1.address)

      expect(await collateral.getWithdrawHook()).to.eq(user1.address)
    })

    it('emits WithdrawHookChange', async () => {
      const tx = await collateral.connect(deployer).setWithdrawHook(user1.address)

      await expect(tx).to.emit(collateral, 'WithdrawHookChange').withArgs(user1.address)
    })
  })

  describe('# setManagerWithdrawHook', () => {
    beforeEach(async () => {
      await getSignersAndDeployCollateral()
      await grantAndAcceptRole(
        collateral,
        deployer,
        deployer,
        await collateral.SET_MANAGER_WITHDRAW_HOOK_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_MANAGER_WITHDRAW_HOOK_ROLE(), user1.address)
      ).to.eq(false)

      await expect(collateral.connect(user1).setManagerWithdrawHook(user1.address)).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.SET_MANAGER_WITHDRAW_HOOK_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      expect(await collateral.getManagerWithdrawHook()).to.not.eq(user1.address)

      await collateral.connect(deployer).setManagerWithdrawHook(user1.address)

      expect(await collateral.getManagerWithdrawHook()).to.eq(user1.address)
    })

    it('sets to zero address', async () => {
      await collateral.connect(deployer).setManagerWithdrawHook(user1.address)
      expect(await collateral.getManagerWithdrawHook()).to.not.eq(ZERO_ADDRESS)

      await collateral.connect(deployer).setManagerWithdrawHook(ZERO_ADDRESS)

      expect(await collateral.getManagerWithdrawHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await collateral.getManagerWithdrawHook()).to.not.eq(user1.address)

      await collateral.connect(deployer).setManagerWithdrawHook(user1.address)

      expect(await collateral.getManagerWithdrawHook()).to.eq(user1.address)

      await collateral.connect(deployer).setManagerWithdrawHook(user1.address)

      expect(await collateral.getManagerWithdrawHook()).to.eq(user1.address)
    })

    it('emits ManagerWithdrawHookChange', async () => {
      const tx = await collateral.connect(deployer).setManagerWithdrawHook(user1.address)

      await expect(tx).to.emit(collateral, 'ManagerWithdrawHookChange').withArgs(user1.address)
    })
  })

  describe('# getReserve', () => {
    beforeEach(async () => {
      await setupCollateral()
    })

    it("returns contract's base token balance", async () => {
      await baseToken.connect(deployer).mint(collateral.address, parseEther('1'))
      const contractBalance = await baseToken.balanceOf(collateral.address)
      expect(contractBalance).to.be.eq(parseEther('1'))

      expect(await collateral.getReserve()).to.eq(contractBalance)
    })
  })

  describe('# managerWithdraw', () => {
    beforeEach(async () => {
      await setupCollateral()
      await baseToken.mint(collateral.address, parseUnits('1', 6))
      await collateral.connect(deployer).setManagerWithdrawHook(managerWithdrawHook.address)
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.MANAGER_WITHDRAW_ROLE(), user1.address)
      ).to.eq(false)

      await expect(collateral.connect(user1).managerWithdraw(1)).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await collateral.MANAGER_WITHDRAW_ROLE()}`
      )
    })

    it('reverts if hook reverts', async () => {
      /**
       * Still providing valid inputs to ensure withdrawals are only reverting due to smock
       * since we cannot verify revert by message.
       */
      const contractBT = await baseToken.balanceOf(collateral.address)
      const baseTokenManagerCanWithdraw = contractBT
        .mul(TEST_MIN_RESERVE_PERCENTAGE)
        .div(PERCENT_DENOMINATOR)
      const amountToWithdraw = baseTokenManagerCanWithdraw
      expect(amountToWithdraw).to.be.gt(0)
      managerWithdrawHook.hook.reverts()

      await expect(collateral.connect(deployer).managerWithdraw(amountToWithdraw)).reverted
    })

    it('calls manager withdraw hook with correct parameters', async () => {
      const contractBT = await baseToken.balanceOf(collateral.address)
      const baseTokenManagerCanWithdraw = contractBT
        .mul(TEST_MIN_RESERVE_PERCENTAGE)
        .div(PERCENT_DENOMINATOR)
      const amountToWithdraw = baseTokenManagerCanWithdraw
      expect(amountToWithdraw).to.be.gt(0)

      await collateral.connect(deployer).managerWithdraw(amountToWithdraw)

      expect(managerWithdrawHook.hook).to.be.calledWith(
        deployer.address,
        amountToWithdraw,
        amountToWithdraw
      )
    })

    it('transfers base tokens to manager', async () => {
      const contractBTBefore = await baseToken.balanceOf(collateral.address)
      const baseTokenManagerCanWithdraw = contractBTBefore
        .mul(TEST_MIN_RESERVE_PERCENTAGE)
        .div(PERCENT_DENOMINATOR)
      const managerBTBefore = await baseToken.balanceOf(manager.address)
      const amountToWithdraw = baseTokenManagerCanWithdraw
      expect(amountToWithdraw).to.be.gt(0)

      await collateral.connect(deployer).managerWithdraw(amountToWithdraw)

      expect(await baseToken.balanceOf(collateral.address)).to.eq(
        contractBTBefore.sub(amountToWithdraw)
      )
      expect(await baseToken.balanceOf(manager.address)).to.eq(
        managerBTBefore.add(amountToWithdraw)
      )
    })
  })
})
