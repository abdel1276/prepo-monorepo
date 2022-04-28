import notification from 'antd/lib/notification'
import { RootStore as PRootStore } from '@prepo-io/stores'
import { captureException } from '@sentry/nextjs'
import { UiStore } from './UiStore'
import { UniswapV2RouterContractStore } from './UniswapV2RouterContractStore'
import LocalStorageStore from './LocalStorageStore'
import { Erc20Store } from './entities/Erc20.entity'
import { BrandingContractStore } from './BrandingContractStore'
import { AcquireRPCostContractStore } from './AcquireRPCostContractStore'
import { AcquisitionRoyaleContractStore } from './AcquisitionRoyaleContractStore'
import { AcquisitionRoyaleRPShopContractStore } from './AcquisitionRoyaleRPShopContractStore'
import { CompeteV1ContractStore } from './CompeteV1ContractStore'
import { ConsumablesContractStore } from './ConsumablesContractStore'
import { MergeRPCostContractStore } from './MergeRPCostContract'
import { RunwayPointsContractStore } from './RunwayPointsContractStore'
import { InternContractStore } from './InternContractStore'
import { InternStore } from './InternStore'
import { EnterpriseStore } from './EnterprisesStore'
import { storeConfig } from './utils/stores-config'
import { ActionsStore } from '../features/mvp/ActionsStore'
import { RpShopStore } from '../features/mvp/stores/RpShopStore'
import { SupportedContracts } from '../lib/supported-contracts'
import { MergeStore } from '../features/mvp/merge'
import { AcquireStore } from '../features/mvp/acquire'

export class RootStore extends PRootStore<SupportedContracts> {
  uiStore: UiStore
  acquireStore: AcquireStore
  acquireRPCostContractStore: AcquireRPCostContractStore
  acquisitionRoyaleContractStore: AcquisitionRoyaleContractStore
  acquisitionRoyaleRPShopContractStore: AcquisitionRoyaleRPShopContractStore
  competeV1ContractStore: CompeteV1ContractStore
  consumablesContractStore: ConsumablesContractStore
  mergeStore: MergeStore
  mergeRPCostContractStore: MergeRPCostContractStore
  uniswapV2RouterContractStore: UniswapV2RouterContractStore
  localStorageStore: LocalStorageStore
  runwayPointsContractStore: RunwayPointsContractStore
  usdcStore: Erc20Store
  brandingContractStore: BrandingContractStore
  actionsStore: ActionsStore
  enterprisesStore: EnterpriseStore
  internContractStore: InternContractStore
  internStore: InternStore
  rpShopStore: RpShopStore

  constructor() {
    super({
      errorCapturer: (error): void => {
        captureException(error.message, {
          extra: { error },
        })
      },
      toast: notification,
      storeConfig,
    })
    this.uiStore = new UiStore(this)
    this.uniswapV2RouterContractStore = new UniswapV2RouterContractStore(this)
    this.localStorageStore = new LocalStorageStore(this)
    this.acquisitionRoyaleContractStore = new AcquisitionRoyaleContractStore(this)
    this.acquireRPCostContractStore = new AcquireRPCostContractStore(this)
    this.acquisitionRoyaleRPShopContractStore = new AcquisitionRoyaleRPShopContractStore(this)
    this.acquireStore = new AcquireStore(this)
    this.consumablesContractStore = new ConsumablesContractStore(this)
    this.mergeStore = new MergeStore(this)
    this.mergeRPCostContractStore = new MergeRPCostContractStore(this)
    this.runwayPointsContractStore = new RunwayPointsContractStore(this)
    this.usdcStore = new Erc20Store(this, 'USDC')
    this.brandingContractStore = new BrandingContractStore(this)
    this.enterprisesStore = new EnterpriseStore(this)
    this.actionsStore = new ActionsStore(this)
    this.competeV1ContractStore = new CompeteV1ContractStore(this)
    this.internContractStore = new InternContractStore(this)
    this.internStore = new InternStore(this)
    this.rpShopStore = new RpShopStore(this)
  }
}