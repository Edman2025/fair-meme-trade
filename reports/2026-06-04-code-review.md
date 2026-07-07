# Fair Meme Trade 测试报告

| 字段 | 值 |
| --- | --- |
| 报告日期 | 2026-06-04 |
| 报告时间 | 12:00 (Asia/Shanghai) |
| 项目 | fair-meme-trade |
| 报告范围 | 智能合约、Fastify 后端、Indexer worker、前端 lib/页面 |
| 报告类型 | 静态代码审查 + 缺失功能盘点 |
| 严重级别 | 🔴 高 / 🟠 中 / 🟡 低 |

---

## 1. 审查范围

| 类别 | 文件数 | 备注 |
| --- | --- | --- |
| Solidity 合约 | 5 | `FairMemeToken.sol` / `FairMemeFactory.sol` / `FairMemeFactoryV2.sol` / `LpLockVault.sol` / `LpLockVaultV2.sol` / `CommissionVault.sol` |
| 后端 | 9 | `server/src/{index,app,env}.ts`、`db/{client,schema}.ts`、`lib/{auth,chainExecutor,http}.ts`、`routes/{auth,core}.ts`、`worker/indexer.ts` |
| 脚本 | 9 | 部署/烟雾测试/数据库迁移 |
| 前端 | 50+ | 上下文、lib、关键页面与组件 |
| 文档 | 5 | `README.md` / `MVP_BACKEND_CONTRACT.md` / `REALITY_ROADMAP.md` / `contracts/README.md` / `deploy/README.md` |

> ⚠️ 本次审查为静态分析，**未实际运行**合约测试、Hardhat 编译、TypeScript 类型检查或后端 API 集成测试。下表标记为「未验证」的项目需在 CI 中补充。

---

## 2. 严重 Bug（🔴 高）

### 2.1 真实链上事件类型被错误归类
- **位置**: [src/lib/realChainIndexer.ts#L102-L112](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/realChainIndexer.ts#L102-L112)
- **现象**: `ProjectReviewed` 事件分支将 `type` 写为 `"TokenCreated"`，且未填 `walletAddress`。
- **影响**: admin / indexer 视图把审核事件算成代币创建，造成数据污染。
- **建议修复**: 改为 `type: "ProjectReviewed"` + `walletAddress: parsed.args.reviewer`。

### 2.2 V1 / V2 合约 ABI 错配
- **位置**: [src/lib/contractAbi.ts#L3-L13](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/contractAbi.ts#L3-L13)、[src/lib/chainWrite.ts](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/chainWrite.ts)
- **现象**: `chainWrite.createTokenOnChain` 走 V2 ABI；`smoke-bsc-testnet-flow.mjs` 引用 V1 部署（`deployments.bsc-testnet.json`）却用 V1 ABI。V2 部署后，前端用 V2 ABI 给 V1 合约发交易会 `revert`。
- **影响**: 真实链上创建代币的端到端流程不可用。
- **建议修复**: 拆分 `FAIR_MEME_FACTORY_ABI`（V1）/ `FAIR_MEME_FACTORY_V2_ABI`（V2），按 `factoryAddress` 选择。

### 2.3 `LpLockVault.withdraw` 累计字段错误
- **位置**: [contracts/LpLockVault.sol#L49-L51](file:///Users/edman_openclaw/Documents/fair-meme-trade/contracts/LpLockVault.sol#L49-L51)、[contracts/LpLockVaultV2.sol#L68-L70](file:///Users/edman_openclaw/Documents/fair-meme-trade/contracts/LpLockVaultV2.sol#L68-L70)
- **现象**: `position.withdrawn = position.amount` 直接置为总额；不支持分批/线性释放。
- **影响**: 文档承诺的"线性释放"在链上无法表达。
- **建议修复**: 新增 `releaseAmount(uint256 positionId, uint256 amount)` 并维护 `withdrawn` 累计。

### 2.4 `LpWithdrawn` 事件索引器覆盖历史
- **位置**: [server/src/worker/indexer.ts#L118-L122](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/worker/indexer.ts#L118-L122)
- **现象**: `withdrawn = payload.amount` 直接覆盖，多次部分提现会丢失早期数据。
- **影响**: `/admin` LP 锁仓面板的 `Withdrawn` 永远只反映最近一次。
- **建议修复**: 改为 `withdrawn + payload.amount`（SQL 累加或前端读后写回）。

### 2.5 Factory 交易/LP 接口无真实转账校验
- **位置**: [contracts/FairMemeFactory.sol#L95-L104](file:///Users/edman_openclaw/Documents/fair-meme-trade/contracts/FairMemeFactory.sol#L95-L104)
- **现象**: `recordTrade` / `addLp` 不要求 ERC20 转账，仅 emit 事件。
- **影响**: 任何人能伪造任意金额的链上事件灌入 indexer，污染后端数据。
- **建议修复**: 工厂要求 caller 同时 `transfer` 项目代币到工厂或在路由层进行 ERC20 真实性校验。

### 2.6 `Create` 页面链上失败后无 demo 回退
- **位置**: [src/pages/Create.tsx#L187-L249](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/pages/Create.tsx#L187-L249)
- **现象**: 第一步直接 `createTokenOnChain`，没有 `VITE_FACTORY_ADDRESS` 时整流程 404。
- **影响**: 演示 / 未配置环境无法创建代币；MvpContext 本来设计有 demo 回退未生效。
- **建议修复**: 用 `try { chain } catch { /* fall through to demo */ }` 包裹。

### 2.7 `pairToken` 配对币种依赖地址白名单
- **位置**: [src/contexts/MvpContext.tsx#L630](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/contexts/MvpContext.tsx#L630)
- **现象**: `pairToken === ZeroAddress ? "BNB" : "USDT"` 写死，遇到 WBNB 或其他 BNB 配对会被错配。
- **影响**: 真实链上数据展示不稳定。
- **建议修复**: 在工厂合约加 `pairKind` 枚举，或在 `chainConfig` 维护 BNB/WBNB 地址集合。

---

## 3. 中等 Bug（🟠 中）

### 3.1 `MvpContext` 把 server 与本地状态混存 `localStorage`
- **位置**: [src/contexts/MvpContext.tsx#L715-L746](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/contexts/MvpContext.tsx#L715-L746)
- **现象**: 13 个状态数组统一序列化；服务器 push 数据会覆盖本地新增 demo 数据；性能损耗。
- **建议**: 拆"用户操作"与"服务器同步"两套存储。

### 3.2 `requireApiKeyScope` 写审计日志无 keyId 仍插入
- **位置**: [server/src/lib/http.ts#L29-L57](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/lib/http.ts#L29-L57)
- **现象**: 未识别 key 也写 audit 表，可被刷爆。
- **建议**: 未识别 key 直接 429 限流，不入 audit。

### 3.3 后端登录无速率限制 + nonce 无 TTL
- **位置**: [server/src/routes/auth.ts](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/routes/auth.ts)
- **现象**: `/api/auth/nonce` 任意写入；`/api/auth/verify` nonce 无过期清理。
- **建议**: IP 限流 + 定时清理 `consumedAt IS NULL AND issued_at < now() - 10m`。

### 3.4 `markProjectLaunchedOnChain` 二次插入 `chainTransactions`
- **位置**: [server/src/routes/core.ts#L160-L175](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/routes/core.ts#L160-L175)
- **现象**: `chainExecutor` 已经 insertSubmittedTx 一次，路由层再 insert 一次，第二次因 `txHash` 唯一索引 `onConflictDoNothing` 丢弃 `note` 字段。
- **建议**: 把 `note` 透传到 `markProjectLaunchedOnChain`，路由层不再写。

### 3.5 `MvpContext` 异步闭包持有旧 state
- **位置**: [src/contexts/MvpContext.tsx#L980-L1008](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/contexts/MvpContext.tsx#L980-L1008) 等
- **现象**: `recordTrade`、`approveAdminItem` 等回调通过 `useMemo` 缓存，内部读取的 `currentWalletAddress` 可能是过期值。
- **建议**: 改用 `useRef` 持有最新 state，或拆 `useCallback`。

### 3.6 `adminQueue` 被服务器覆盖
- **位置**: [src/contexts/MvpContext.tsx#L782-L790](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/contexts/MvpContext.tsx#L782-L790)
- **现象**: `setAdminQueue(queue.map(reviewItemFromServer))` 全量覆盖，本地未提交的 pending 节点申请 / 提现会被静默删除。
- **建议**: 按 id 合并而非覆盖。

### 3.7 旧 `TradingPanel.tsx` 死代码
- **位置**: [src/components/TradingPanel.tsx](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/components/TradingPanel.tsx)
- **现象**: `setPercentage` 硬编码 `1000000`，未连真实余额。
- **建议**: 删除或与 `AdvancedTradingPanel` 合并。

### 3.8 硬编码 magic address
- **位置**: [src/components/Header.tsx#L149](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/components/Header.tsx#L149)
- **现象**: "Charts" 菜单指向 `0x924fa68a0fc644485b8df8abfa0a41c2e7744444`，点击会回退到 ROCKET 数据。
- **建议**: 改为 `/token/ROCKET` 或新增 `/charts` 路由。

### 3.9 API 文档与实际端点不符
- **位置**: [src/pages/Api.tsx#L210-L213](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/pages/Api.tsx#L210-L213)
- **现象**: 文档写 `/trade/buy`、`/trade/sell`、`https://api.yourplatform.com/v1`，后端实际只有 `/api/tokens`、`/api/chain-transactions` 等。
- **建议**: 同步到真实端点或补齐缺失实现。

---

## 4. 较轻 Bug（🟡 低）

| 编号 | 位置 | 现象 | 建议 |
| --- | --- | --- | --- |
| 4.1 | [src/components/LpNotifications.tsx#L23-L46](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/components/LpNotifications.tsx#L23-L46) | 通知触发窗口仅 1 分钟 | 用 `useRef` 标记已通知 |
| 4.2 | [src/contexts/MvpContext.tsx#L1037-L1052](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/contexts/MvpContext.tsx#L1037-L1052) | `withdrawLp` 把 `expectedWithdraw` 与 `withdrawnAmount` 互换 | 重新设计语义 |
| 4.3 | [src/pages/MyLp.tsx#L29-L102](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/pages/MyLp.tsx#L29-L102)、[src/pages/LpLaunch.tsx#L34-L89](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/pages/LpLaunch.tsx#L34-L89) | 死代码 mock | 删除 |
| 4.4 | [src/contexts/MvpContext.tsx#L1220-L1223](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/contexts/MvpContext.tsx#L1220-L1223) | 审核通过后 token 状态仍置为 "pending" | 改为 "launched" |
| 4.5 | [src/lib/chainConfig.ts#L33-L34](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/chainConfig.ts#L33-L34) | 写死 PancakeSwap v1 router | 增加 v2 / 主网配置 |
| 4.6 | [src/lib/bscKnownTransactions.ts](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/bscKnownTransactions.ts) | V1 部署 hash, V2 已不再使用 | 删除或替换 |
| 4.7 | [src/contexts/LanguageContext.tsx#L3](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/contexts/LanguageContext.tsx#L3) | 缺少"简体中文"语言 | 增加 zh-CN |
| 4.8 | [src/contexts/MvpContext.tsx#L641](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/contexts/MvpContext.tsx#L641) | `event.payload?.symbol` 判定无效 | 增加真实 key 校验 |
| 4.9 | [src/components/Header.tsx#L64-L77](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/components/Header.tsx#L64-L77) | 积分 mock 数据 | 接入后端 API |
| 4.10 | [package.json#L102](file:///Users/edman_openclaw/Documents/fair-meme-trade/package.json#L102) | `hardhat ^3.7.0` 仍在 beta | 锁回 2.22.x |
| 4.11 | [hardhat.config.ts](file:///Users/edman_openclaw/Documents/fair-meme-trade/hardhat.config.ts) | 缺 `@nomicfoundation/hardhat-toolbox` | 添加 toolbox |

---

## 5. 未完成功能（来自 `REALITY_ROADMAP.md`）

| 状态 | 路线项 |
| --- | --- |
| ✅ 已实现 | 后端 + Postgres + `chainTransactions` / `indexedEvents` / `wallet_sessions` / `indexerState` / `api_keys` / `api_audit_logs` |
| ✅ 已实现 | 持久 Indexer worker（`server/src/worker/indexer.ts`，8000ms loop） |
| ⚠️ 部分实现 | 本地 `createToken` 仍然先于链上；链上失败直接 404（见 2.6） |
| ⚠️ 部分实现 | LP 锁仓：合约支持 `lock` / `withdraw`，但不支持线性释放（见 2.3） |
| ❌ 未实现 | LP 锁仓 `releaseType` 落库后没有与 vault 接口对接 |
| ❌ 未实现 | BscScan 合约验证脚本（`npx hardhat verify`） |
| ❌ 未实现 | 合约测试（`test/` 目录、`hardhat test` 任务） |
| ❌ 未实现 | 自动化集成测试 / E2E（Playwright / Vitest + supertest） |
| ❌ 未实现 | 限价单 / 止损单 / 移动止盈的链上落地（`limitOrder` / `riskOrder` 链上 action） |
| ❌ 未实现 | Commission vault `depositFor` 的服务器调用（无任何路由触发） |

---

## 6. 测试覆盖矩阵

| 模块 | 单元测试 | 集成测试 | E2E | 备注 |
| --- | --- | --- | --- | --- |
| 合约 `FairMemeFactory` / `V2` | ❌ | ❌ | ❌ | 应覆盖：审核状态机、事件签名、权限 |
| 合约 `FairMemeToken` | ❌ | ❌ | ❌ | 应覆盖：转账边界、approve 流程 |
| 合约 `LpLockVault` / `V2` | ❌ | ❌ | ❌ | 应覆盖：lock/withdraw 边界、线性释放 |
| 合约 `CommissionVault` | ❌ | ❌ | ❌ | 应覆盖：deposit/request/review/pay 流程 |
| 后端 `/api/auth/*` | ❌ | ❌ | ❌ | 应覆盖：nonce、签名、过期、TTL |
| 后端 `/api/admin/*` | ❌ | ❌ | ❌ | 应覆盖：管理员 token 校验、链上调用 mock |
| 后端 `/api/tokens` / `chain-transactions` | ❌ | ❌ | ❌ | 应覆盖：onConflictDoNothing 行为、payload 序列化 |
| Indexer worker | ❌ | ❌ | ❌ | 应覆盖：窗口滚动、failureCount、退避 |
| 前端 `MvpContext` | ❌ | ❌ | ❌ | 应覆盖：localStorage 回写、异步竞态 |
| 前端 `pancakeSwap` | ❌ | ❌ | ❌ | 应覆盖：quote、slippage、allowance 流程 |
| 前端 Pages | ❌ | ❌ | ❌ | 至少 `Create` / `TokenDetail` / `MyLp` 需 smoke 测试 |

> **覆盖率估算**：手动测试覆盖 < 5%，自动化测试 0%。

---

## 7. 修复优先级建议

| 优先级 | 编号 | 内容 | 估计工作量 |
| --- | --- | --- | --- |
| P0 | 2.1 / 2.2 | 链上事件归类 + ABI 错配 | 0.5d |
| P0 | 2.6 | Create 页面 demo 回退 | 0.5d |
| P0 | 2.5 | Factory `recordTrade` / `addLp` 加 transfer 校验 | 1d（合约改动） |
| P1 | 2.3 / 2.4 | LP 锁仓累计释放 + indexer 累加 | 1d |
| P1 | 3.3 / 3.4 | 后端速率限制 + 重复插入修复 | 0.5d |
| P1 | 3.6 | adminQueue 合并而非覆盖 | 0.5d |
| P2 | 3.7 / 3.8 / 3.9 | 死代码清理 + 文档同步 | 0.5d |
| P2 | 4.* | 次要问题集中修复 | 1d |
| P3 | 5.* 全部 | 补齐单元 / 集成测试 | 3-5d |

---

## 8. 风险与建议

- **生产部署风险**: `deploy/README.md` 公开了 `8.149.140.26` 真实服务器 IP + Postgres 库名。建议改为内部文档并加 IP 白名单。
- **Hardhat 3.x 风险**: 当前 `package.json` 锁定 `^3.7.0` 仍处 beta，且配置风格为 v2；`npm run contracts:compile` 大概率失败。
- **PancakeSwap router 风险**: 默认地址是 BSC Testnet v1；切到主网会立即失败。
- **数据正确性风险**: 多个 `withdrawn` / `reviewQueue` 更新路径没有事务包裹；并发场景下会出现脏写。

---

## 9. 后续行动

1. **立即**: 修复 7 个 🔴 Bug 中的 2.1 / 2.2 / 2.6（影响最大）。
2. **本周**: 完成 P1 全部 3 项；补一份 Hardhat v2 锁定 + 编译通过的 PR。
3. **本月**: 补齐合约单元测试 + 后端 supertest 集成测试；CI 加入 `eslint`、`tsc --noEmit`、`hardhat compile`、`vitest run`。

---

**报告人**: 代码审查（自动）  
**复核人**: _（待指派）_  
**关联工单**: _（待创建）_
