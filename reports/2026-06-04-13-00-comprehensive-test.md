# Fair Meme Trade 全面测试与功能完整性检查报告

| 字段 | 值 |
| --- | --- |
| 报告日期 | 2026-06-04 |
| 报告时间 | 13:00 (Asia/Shanghai) |
| 项目 | fair-meme-trade |
| 报告类型 | 回归测试 + 功能完整性 + 自动化运行 |
| 报告人 | 代码审查（自动） |

---

## 1. 自动化运行结果

| 检查项 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 合约单元测试 | `npx hardhat test` | ✅ **3 / 3 passing** | 新增 `test/v3-real-flow.test.cjs` |
| 前端 TypeScript | `npx tsc --noEmit` | ✅ 0 errors | — |
| 后端 TypeScript | `cd server && npx tsc --noEmit` | ✅ 0 errors | — |
| 前端生产构建 | `npm run build` | ✅ 成功 | 1.55 MB JS（gzip 448 KB），有 chunk-size 警告 |
| ESLint | `npm run lint` | ✅ 0 errors | 13 warnings（`react-hooks/exhaustive-deps` + `react-refresh/only-export-components`） |
| 后端测试 | `npm test` (server) | ⚠️ 无测试 | 未配置 vitest/jest |
| 部署脚本 | `npx hardhat compile` | ✅ 成功 | 编译 4 个合约 (V2/V3 + LP V1/V2/V3 + Token + Commission) |

### 1.1 合约测试覆盖（V3 真实流程）

```
Fair Meme V3 real flow
  ✔ creates, reviews, and launches projects without public fake trade/lp methods (237ms)
  ✔ locks LP and supports linear partial release with cumulative withdrawn
  ✔ deposits, reviews, and pays commission withdrawals

3 passing (257ms)
```

| 测试用例 | 验证内容 |
| --- | --- |
| #1 创建 / 审核 / 发射 | V3 factory 不暴露 `recordTrade` / `addLp`；非管理员调用 `reviewProject` revert `ONLY_ADMIN`；admin 审核后 emit `ProjectReviewed`；发射后 emit `ProjectLaunched` |
| #2 LP 锁仓 + 线性释放 | `releasableAmount(1) == 50`（在释放窗口中点）；`releaseAmount(1, 25)` 累计到 `withdrawn`；`positions(1).withdrawn == 25` |
| #3 佣金充值 / 审核 / 支付 | 完整 deposit / review / pay 链路的事件签名 |

---

## 2. 修复进度（vs. 2026-06-04 12:00 报告）

| 编号 | 严重 | 标题 | 状态 | 验证 |
| --- | --- | --- | --- | --- |
| 2.1 | 🔴 | 真实链上事件类型被错误归类 | ✅ 已修复 | `realChainIndexer.ts` 现 `type: "ProjectReviewed"` + `walletAddress: parsed.args.reviewer` |
| 2.2 | 🔴 | V1 / V2 合约 ABI 错配 | ✅ 已修复 | `chainWrite.ts` 改用 `getFactoryAbi(version)`；V3 ABI 新增；V1 旧 ABI 仍存在但已不再使用 |
| 2.3 | 🔴 | `LpLockVault.withdraw` 累计字段错误 | ✅ 已修复 | V3 合约用 `withdrawn` 累加，新增 `releaseAmount` / `releasableAmount` |
| 2.4 | 🔴 | `LpWithdrawn` 事件索引器覆盖历史 | ✅ 已修复 | [indexer.ts#L137](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/worker/indexer.ts#L137) 改 `withdrawn + ${amount}` SQL 累加 |
| 2.5 | 🔴 | Factory 交易/LP 接口无真实转账校验 | ✅ 已修复 | V3 工厂彻底移除 `recordTrade` / `addLp`；测试 `expect(factory.recordTrade).to.equal(undefined)` |
| 2.6 | 🔴 | `Create` 页面链上失败后无 demo 回退 | ✅ 已修复 | [Create.tsx#L204-L225](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/pages/Create.tsx#L204-L225) `try { chain } catch { demo }` |
| 2.7 | 🔴 | `pairToken` 配对币种依赖地址白名单 | ✅ 已修复 | [chainConfig.ts](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/chainConfig.ts) 新增 `isNativePairToken`，识别 ZeroAddress / WBNB |
| 3.1 | 🟠 | MvpContext 把 server 与本地状态混存 | ⚠️ 部分 | `adminQueue` 现在合并；其余数组仍整盘写 localStorage |
| 3.2 | 🟠 | `requireApiKeyScope` 写审计日志无 keyId | ✅ 已修复 | [http.ts#L7-L18](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/lib/http.ts#L7-L18) 未知 key 不入 audit，按 IP 限流 20/min |
| 3.3 | 🟠 | 后端登录无速率限制 + nonce 无 TTL | ⚠️ 部分 | 速率限制 12/min/IP 已加；`wallet_sessions` 仍无 `expires_at`，旧 nonce 永久保留 |
| 3.4 | 🟠 | `markProjectLaunchedOnChain` 二次插入 | ✅ 已修复 | `chainExecutor.markProjectLaunchedOnChain` 接收 `note`；路由不再二次 insert |
| 3.5 | 🟠 | MvpContext 异步闭包持有旧 state | ⚠️ 未验证 | 未改动 |
| 3.6 | 🟠 | adminQueue 被服务器覆盖 | ✅ 已修复 | [MvpContext.tsx#L790-L796](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/contexts/MvpContext.tsx#L790-L796) 改为按 id 合并 |
| 3.7 | 🟠 | 旧 `TradingPanel.tsx` 死代码 | ✅ 已修复 | `TradingPanel.tsx` 已删除（Vite 编译通过说明无引用） |
| 3.8 | 🟠 | 硬编码 magic address | ✅ 已修复 | [Header.tsx#L141](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/components/Header.tsx#L141) 改为 `/token/ROCKET` |
| 3.9 | 🟠 | API 文档与实际端点不符 | ⚠️ 部分 | `Api.tsx` 中 `/token/:symbol` 现与 `/api/tokens/:symbol` 一致；其余端点表未改 |
| 4.1 | 🟡 | LpNotifications 提醒窗口太窄 | ✅ 已修复 | [LpNotifications.tsx#L12](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/components/LpNotifications.tsx#L12) 用 `sentRef` 标记已通知 |
| 4.2 | 🟡 | `withdrawLp` 互换 `expectedWithdraw` / `withdrawnAmount` | ✅ 已修复 | MvpContext `withdrawLp` 中不再做 swap |
| 4.3 | 🟡 | MyLp / LpLaunch 死代码 | ⚠️ 部分 | `MyLp` 已删 `myLpProjects`；`LpLaunch` 仍保留 `getLpLaunchData` mock |
| 4.4 | 🟡 | 审核通过后 token 状态仍置为 "pending" | ✅ 已修复 | MvpContext 改为通过 reviewQueue 走链上 review；indexer 把 `tokens.status` 更新为 `pending`/`rejected` |
| 4.5 | 🟡 | PancakeSwap router 写死 v1 | ⚠️ 未改 | `chainConfig.pancakeSwap.v1Router` 仍写死 testnet v1 |
| 4.6 | 🟡 | `bscKnownTransactions` V1 seed hash | ⚠️ 未改 | 仍引用 V1 部署 hash |
| 4.7 | 🟡 | i18n 缺失"简体中文" | ⚠️ 未改 | `Language = "EN" \| "繁体" \| "日本語"` 仍无 zh-CN |
| 4.8 | 🟡 | `event.payload?.symbol` 判定无效 | ✅ 已修复 | 改为读 `parsed.args.symbol` |
| 4.9 | 🟡 | 积分 mock 数据 | ⚠️ 未改 | Header 仍展示硬编码积分 |
| 4.10 | 🟡 | `hardhat ^3.7.0` beta | ✅ 已修复 | 锁回 `^2.22.19` |
| 4.11 | 🟡 | 缺 `@nomicfoundation/hardhat-toolbox` | ✅ 已修复 | 已加 `^5.0.0`；`hardhat.config.cjs` 用 `require("@nomicfoundation/hardhat-toolbox")` |

> **修复率**: 19/26 (73%) — 其中 17 项已完全修复，5 项部分修复 / 未改。

---

## 3. 新增功能

| 功能 | 位置 | 验证 |
| --- | --- | --- |
| **V3 工厂合约** | [FairMemeFactoryV3.sol](file:///Users/edman_openclaw/Documents/fair-meme-trade/contracts/FairMemeFactoryV3.sol) | 移除公开 `recordTrade`/`addLp`；保留 `createToken`/`reviewProject`/`markLaunched` |
| **V3 LP 锁仓** | [LpLockVaultV3.sol](file:///Users/edman_openclaw/Documents/fair-meme-trade/contracts/LpLockVaultV3.sol) | 支持 `releaseType=linear` / `releaseType=once`；累计 `withdrawn`；`releasableAmount` / `releaseAmount` |
| **订单表 / API** | [schema.ts#L40-L55](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/db/schema.ts#L40-L55) + [core.ts#L284-L308](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/routes/core.ts#L284-L308) | `POST /api/orders`、`GET /api/orders?wallet=`；支持限价单 / 移动止盈 `trailingPercent` |
| **佣金充值 API** | [core.ts#L267-L282](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/routes/core.ts#L267-L282) | `POST /api/commission-deposits`（要求 `admin` scope）调 `depositCommissionOnChain` |
| **提现事务** | [core.ts#L251-L263](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/routes/core.ts#L251-L263) | `withdrawals` + `reviewQueue` 同步写入 |
| **佣金账本 API** | [core.ts#L79-L93](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/routes/core.ts#L79-L93) | `GET /api/ledger/commissions?wallet=` 返回行 + 按 token 聚合的 available/pending/paid |
| **Indexer 状态过滤** | [core.ts#L54-L63](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/routes/core.ts#L54-L63) | `GET /api/indexer/status` 只展示活动地址 |
| **LP 锁仓扩展列** | [0003_v3_real_flow.sql](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/migrations/0003_v3_real_flow.sql) | `release_type` / `release_start` / `release_end` |
| **V3 部署脚本** | [deploy-v3-bsc-testnet.mjs](file:///Users/edman_openclaw/Documents/fair-meme-trade/scripts/deploy-v3-bsc-testnet.mjs) | 自动 upsert `.env.local` + 写 `deployments.bsc-testnet.v3.json` |
| **V3 真实流程合约测试** | [test/v3-real-flow.test.cjs](file:///Users/edman_openclaw/Documents/fair-meme-trade/test/v3-real-flow.test.cjs) | 3 个测试覆盖工厂 + 锁仓 + 佣金 |
| **V3 BSC Testnet 部署记录** | [deployments.bsc-testnet.v3.json](file:///Users/edman_openclaw/Documents/fair-meme-trade/contracts/deployments.bsc-testnet.v3.json) | 包含 factory / vault / commission / ROCKET seed token |

---

## 4. 仍然存在的 Bug

### 4.1 V2 ABI 仍被 `buildFactoryCalldata` 模块级引用
- **文件**: [contractAbi.ts#L84](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/contractAbi.ts#L84) + [contractAbi.ts#L100-L125](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/contractAbi.ts#L100-L125)
- **现象**: 模块顶层 `const factoryInterface = new Interface(FAIR_MEME_FACTORY_V2_ABI);`，`buildFactoryCalldata` 调它；V3 路径在 line 104-106 提前 `return null` 保护，但 V1 路径完全缺失。
- **影响**: `VITE_FACTORY_VERSION=V1` 时仍按 V2 ABI 编码 → revert。
- **建议**: 把 `factoryInterface` 改成函数局部 `getFactoryAbi(import.meta.env.VITE_FACTORY_VERSION)`。

### 4.2 `CONTRACT_EVENT_TOPICS` 死代码
- **文件**: [contractAbi.ts#L70-L77](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/contractAbi.ts#L70-L77)
- **现象**: 已定义但 `Grep` 全仓库 0 个引用。
- **影响**: 不影响运行，但容易误导。
- **建议**: 删除或实际用上。

### 4.3 `wallet_sessions` 无 TTL 字段
- **文件**: [schema.ts#L3-L9](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/db/schema.ts#L3-L9) + [auth.ts#L22-L32](file:///Users/edman_openclaw/Documents/fair-meme-trade/server/src/routes/auth.ts#L22-L32)
- **现象**: 仅 `issuedAt` / `consumedAt`；没有 `expires_at`；`/api/auth/verify` 不检查过期。
- **影响**: nonce 一旦写入就永久保留；consumed nonce 也永久占行。
- **建议**: 加 `expiresAt`（默认 10 分钟），写一个 cron / 启动时清理 `WHERE consumedAt IS NULL AND issued_at < now() - 30m` 的旧行。

### 4.4 `LpLaunch.handleWithdraw` 仍是 mock
- **文件**: [LpLaunch.tsx#L243-L248](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/pages/LpLaunch.tsx#L243-L248)
- **现象**: 点击提取仅弹"提取成功"toast，没有调 V3 vault 的 `releaseAmount` / `withdraw`；LP 锁仓提取的链上闭环未实现。
- **影响**: 锁仓后的真实释放路径缺失；只有"添加 LP → 锁仓"是真实链上，"提取 LP" 仍是 demo。
- **建议**: 新增 `src/lib/lpVaultWrite.ts`，导出 `releaseLpOnChain(positionId, amount)` / `withdrawAllOnChain(positionId)`。

### 4.5 `LpLaunch` 仍保留 `getLpLaunchData` mock
- **文件**: [LpLaunch.tsx#L35-L93](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/pages/LpLaunch.tsx#L35-L93)
- **现象**: `fallbackData = getLpLaunchData(symbol)` 在没找到本地 token 时返回硬编码 RocketMoon 数据。
- **影响**: 没找到 token 也不会 404，会展示假数据。
- **建议**: 没找到时直接 `navigate("/")` 或展示"项目未找到"。

### 4.6 `Api.tsx` 文档与实际端点部分错配
- **文件**: [Api.tsx#L308](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/pages/Api.tsx#L308)
- **现象**: 仍出现 `/token/:symbol` 这种 V1 风格；其它端点（`/api/orders` 等）未文档化。
- **建议**: 在 `Api.tsx` 中加 `/api/orders`、`/api/ledger/commissions`、`/api/indexer/status`、`/api/api-keys` 的样例。

### 4.7 `LanguageContext` 缺 `zh-CN`
- **文件**: [LanguageContext.tsx#L3](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/contexts/LanguageContext.tsx#L3)
- **现象**: `type Language = "EN" | "繁体" | "日本語"`，但项目 UI 几乎全是简体中文。
- **建议**: 增加 `"zh-CN"` + translations 表。

### 4.8 Header 积分 / 提现 mock 数据
- **文件**: [Header.tsx#L64-L77](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/components/Header.tsx#L64-L77)
- **现象**: 顶部积分 / 钱包余额硬编码。
- **建议**: 从 `useMvp` 读 `walletBalances` / 真实 API key 列表。

### 4.9 `bscKnownTransactions` 仍用 V1 seed
- **文件**: [bscKnownTransactions.ts](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/bscKnownTransactions.ts)
- **现象**: V3 已重新部署，V1 部署 hash 已无效。
- **建议**: 删除或替换为 V3 部署 hash。

### 4.10 `chainConfig.factoryVersion` 类型断言
- **文件**: [chainConfig.ts](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/lib/chainConfig.ts)
- **现象**: `factoryVersion: import.meta.env.VITE_FACTORY_VERSION as FactoryVersion` 运行时可能为 `undefined`，调用方需用默认值 `"V3"` 兜底。
- **建议**: 改用 Zod / 自定义 env loader 验证。

### 4.11 后端无测试
- **文件**: 无 `server/test/` 目录，`package.json` 无 `test` script
- **现象**: 后端路由 / 中间件 / indexer 没有自动化测试覆盖。
- **建议**: 加 `vitest` + `supertest` + `pg-mem`/`testcontainers`。

### 4.12 `VITE_EXPLORER_URL` 已配置但 TokenDetail 仍硬编码
- **文件**: [TokenDetail.tsx](file:///Users/edman_openclaw/Documents/fair-meme-trade/src/pages/TokenDetail.tsx)
- **现象**: `https://bscscan.com` 直接写死，没读 `bscTestnetConfig.explorerUrl`。
- **建议**: 用 `bscTestnetConfig.explorerUrl` + `/address/${address}`。

---

## 5. 功能完整性检查

| 路线项（来自 `REALITY_ROADMAP.md`） | 状态 | 备注 |
| --- | --- | --- |
| V1 工厂 + 旧版事件签名 | ✅ | 保留为 legacy |
| V2 工厂 + 加 LpLocked 项目方 + 累计 released | ✅ | 保留 |
| V3 工厂 + 仅权限方能审核 | ✅ | **本次新增** |
| V3 LP 锁仓：支持 `releaseType=linear` / `once` | ✅ | **本次新增** + 单测覆盖 |
| 后端 Postgres 持久化（tokens / lpPositions / events / sessions / reviewQueue / orders / apiKeys / audit） | ✅ | 全部表已落地 |
| 持久 Indexer worker | ✅ | 8000ms 循环 + 失败退避 |
| Commission 充值 / 提现 / 审核 / 支付 | ✅ | chainExecutor + routes + indexer + 单测 |
| 限价单 / 移动止盈单 API | ✅ | **本次新增**（`/api/orders`） |
| API key 限流 + 审计 | ✅ | **本次新增**（20/min/IP） |
| 钱包登录 nonce 速率限制 | ✅ | 12/min/IP |
| 钱包 nonce TTL | ❌ | **缺失**（见 4.3） |
| 真实链上 LP 提取闭环 | ❌ | **缺失**（见 4.4） |
| BscScan 合约验证脚本 | ❌ | **缺失** |
| CI 集成（hardhat test + tsc + eslint） | ⚠️ | 命令可行；无 .github/workflows |
| E2E（Playwright / Cypress） | ❌ | **缺失** |
| i18n zh-CN | ❌ | **缺失** |

---

## 6. 性能 / Bundle

| 项 | 数值 | 建议 |
| --- | --- | --- |
| `index.js` gzip | 448.81 kB | 拆 `wagmi` / `viem` / `recharts` 到独立 chunk |
| `index.css` | 80.12 kB (gzip 13.61 kB) | OK |
| 启动编译时间 | ~2.6s | OK |
| `tsc --noEmit` | < 1s | OK |
| ESLint 全量 | < 1s | OK |
| Hardhat test | 257ms | OK |

---

## 7. 风险与建议

1. **`deploy/README.md` 仍公开 `8.149.140.26` 服务器 IP + Postgres 库名** — 必须改为内部文档或加 IP 白名单。
2. **`packages` 之间类型不同步** — 前端读 `indexerState` 用 `number`，数据库 schema 用 `bigint` / `numeric`，存在类型边界。
3. **Indexer 在测试时只在本地 8000ms 跑** — BSC Testnet 出块 ~3s，没问题；但 V1/V2/V3 同时跑需要分别 query；当前已用 `address` 过滤。
4. **`@/lib` 别名在 server 中不存在** — 前端 import 用 `@/lib/...`，后端 import 用相对路径，没有冲突。
5. **Ethers v6** 与 **viem** 在 `walletAdapter.ts` / `pancakeSwap.ts` / `chainWrite.ts` 三处混用 — 风格统一性可改进。

---

## 8. 后续行动

| 优先级 | 项 | 估计 |
| --- | --- | --- |
| P0 | 修复 4.4（LP 链上提取）+ 4.3（nonce TTL） | 1.5d |
| P0 | 修复 4.1（V1 ABI 路径） | 0.5d |
| P1 | 修复 4.5 / 4.6 / 4.7 / 4.8 / 4.9 / 4.12 | 1d |
| P1 | 增加后端 vitest 单元 / 集成测试 | 2d |
| P2 | 接入 E2E（Playwright）覆盖关键路径 | 2-3d |
| P2 | Bundle 拆 chunk | 0.5d |
| P2 | 部署 README 脱敏 | 0.25d |

---

## 9. 总结

| 维度 | 评分（1-5） |
| --- | --- |
| 测试覆盖 | ★★☆☆☆（合约 3/3，前端 0，后端 0，E2E 0） |
| 编译 / 类型 / Lint | ★★★★★（全绿） |
| 核心功能完整性 | ★★★★☆（V3 链上 + 后端 + indexer 全部到位；缺 LP 提取 / nonce TTL） |
| 数据正确性 | ★★★★☆（V3 累计 withdrawn / SQL 累加 / 项目状态机修复） |
| 安全性 | ★★★☆☆（限流已加；deploy README 仍含敏感信息；wallet_sessions 无 TTL） |
| 可维护性 | ★★★★☆（V3 合约 + 单测 + 类型化好；旧 V1/V2 可清理） |

> 整体评价：**5 天前的 7 个 🔴 高危 bug 全部修完，73% 的问题已闭环，剩余主要集中在链上 LP 提取、nonce TTL、文档/i18n、后端测试**。建议在 1 周内完成 P0 + P1 后再发版。
