import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { PrePOMarket } from '../../typechain/PrePOMarket'

export async function prePOMarketFixture(
  governance: string,
  collateral: string,
  longToken: string,
  shortToken: string,
  floorLongPrice: BigNumber,
  ceilingLongPrice: BigNumber,
  floorValuation: BigNumber,
  ceilingValuation: BigNumber,
  mintingFee: number,
  redemptionFee: number,
  expiryTime: number,
  publicMinting: boolean
): Promise<PrePOMarket> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prePOMarket: any = await ethers.getContractFactory('PrePOMarket')
  return (await prePOMarket.deploy(
    governance,
    collateral,
    longToken,
    shortToken,
    floorLongPrice,
    ceilingLongPrice,
    floorValuation,
    ceilingValuation,
    mintingFee,
    redemptionFee,
    expiryTime,
    publicMinting
  )) as PrePOMarket
}

export async function prePOMarketAttachFixture(marketAddress: string): Promise<PrePOMarket> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prePOMarket: any = await ethers.getContractFactory('PrePOMarket')
  return prePOMarket.attach(marketAddress) as PrePOMarket
}
