import { createContext, useContext, useState, ReactNode } from "react";

type Language = "EN" | "zh-CN" | "繁体" | "日本語";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  EN: {
    // Header
    market: "Market",
    charts: "Charts",
    createToken: "Create Token",
    share: "Share",
    node: "Nodes",
    goldenDogRanking: "Golden Dog Ranking",
    api: "API",
    connect: "Connect",
    connected: "Connected",
    
    // Market Tabs
    launched: "Launched",
    pending: "Pending",
    lpBuilding: "LP Building",
    myLp: "My LP",
    dividends: "US Stocks",
    following: "Following",
    smartMoney: "Smart Money",
    
    back: "Back",
    transactions: "Transactions",
    info: "Info",
    
    // Filter Panel
    filters: "Filters",
    dividendToken: "Dividend Token",
    burnToken: "Burn Token",
    marketingToken: "Marketing Token",
    devCleared: "DEV Cleared",
    hasMedia: "Has Media",
    poolAmount: "Pool Amount",
    marketCap: "Market Cap",
    holders: "Holders",
    lpCount: "LP Count",
    volume24h: "24h Volume",
    reset: "Reset",
    
    // Token Card
    supply: "Supply",
    change24h: "24h Change",
    pool: "Pool",
    dividend: "Dividend",
    burn: "Burn",
    marketing: "Marketing",
    viewDetails: "View Details",
    
    // Platform Stats
    totalTokens: "Total Tokens",
    activeUsers: "Active Users",
    totalLp: "Total LP",
    
    // Announcement Bar
    announcement: "Welcome to MemeLaunch! Fair launch platform with zero pre-mine. Create your MEME token in minutes!",
    
    // Footer
    resources: "Resources",
    documentation: "Documentation",
    whitepaper: "Whitepaper",
    tutorial: "Tutorial",
    community: "Community",
    discord: "Discord",
    telegram: "Telegram",
    twitter: "Twitter",
    allRights: "All rights reserved",
    
    // Index Page
    searchPlaceholder: "Search by token name, symbol, or contract address...",
    howToCreate: "How to Create Token",
    tutorial1: "Step 1: Connect Wallet",
    tutorial2: "Step 2: Fill Token Info",
    tutorial3: "Step 3: Deploy & Launch",
    loadMore: "Load More Tokens",
    
    // Scrolling Banner
    banner1: "🚀 New Token: $ROCKET launched with 500 BNB pool!",
    banner2: "⭐ $STAR activated LP with points - Trade now!",
    banner3: "🔥 $FIRE latest transaction: 50 BNB buy!",
    banner4: "💎 $DIAMOND reached 1000 holders milestone!",
    banner5: "🌙 $MOON LP building phase ending in 2 hours!",
    
    // Trading
    priceChart: "Price Chart",
    price: "Price",
    volume: "Volume",
    buy: "Buy",
    sell: "Sell",
    amount: "Amount",
    youGet: "You Get",
    slippage: "Slippage",
    slippageTolerance: "Slippage Tolerance",
    balance: "Balance",
    orderBook: "Order Book",
    total: "Total",
    error: "Error",
    success: "Success",
    copied: "Copied",
    copiedToClipboard: "Copied to clipboard",
    
    // API page
    apiInterface: "API",
    apiSubtitle: "Automate trading and integrations through real API endpoints",
    apiKeyManagement: "API Key Management",
    apiDocs: "API Docs",
    apiKeyNameRequired: "Please enter an API key name",
    apiKeyGenerated: "API key generated",
    apiKeyDeleted: "API key deleted",
    generateNewApiKey: "Generate New API Key",
    createApiKeyDescription: "Create an API key to access trading endpoints",
    keyName: "Key Name",
    apiKeyNamePlaceholder: "Example: Production key",
    generateKey: "Generate Key",
    apiKeyWarning: "Keep your API key private. Leaked keys may cause loss of funds.",
    myApiKeys: "My API Keys",
    manageApiKeys: "Manage your API keys",
    noApiKeys: "No API keys yet. Generate one first.",
    createdAt: "Created At",
    apiDocumentation: "API Documentation",
    apiDocumentationDescription: "Complete API usage instructions and examples",
    authentication: "Authentication",
    baseUrl: "Base URL",
    tradeApis: "Trading APIs",
    submitChainTransactionDocs: "Submit a real on-chain transaction record",
    requestParams: "Request Parameters",
    responseExample: "Response Example",
    createManagedOrderDocs: "Create backend-managed limit or risk orders",
    queryTokenInfo: "Query token information",
    queryCommissionLedger: "Query commission ledger and withdrawable balance",
    queryIndexerStatus: "Query current V3 contract indexer lag and error state",
    codeExamples: "Code Examples",
    errorCodes: "Error Codes",
    badRequest: "Invalid request parameters",
    unauthorizedApi: "Unauthorized, API key scope is insufficient or wallet signature is invalid",
    tooManyRequests: "Too many requests",
    serverError: "Server error",
    notes: "Notes",
    rateLimitNote: "Rate limit: at most 10 requests per second",
    writeAuthNote: "Write endpoints verify API key scope or wallet JWT ownership of walletAddress",
    gasNote: "All on-chain transactions require sufficient balance and gas",
    testnetNote: "Test on testnet before production use",
    keepApiKeySafe: "Keep API keys safe and avoid leaks",
  },
  "zh-CN": {
    // Header
    market: "市场",
    charts: "图表",
    createToken: "创建代币",
    share: "分享",
    node: "节点",
    goldenDogRanking: "金狗排行榜",
    api: "API",
    connect: "连接",
    connected: "已连接",
    
    // Market Tabs
    launched: "已上线",
    pending: "待处理",
    lpBuilding: "LP 建设中",
    myLp: "我的 LP",
    dividends: "美股",
    following: "关注中",
    smartMoney: "聪明钱",
    
    back: "返回",
    transactions: "交易记录",
    info: "信息",
    
    // Filter Panel
    filters: "筛选器",
    dividendToken: "分红代币",
    burnToken: "燃烧代币",
    marketingToken: "营销代币",
    devCleared: "开发者已清仓",
    hasMedia: "有媒体",
    poolAmount: "池子金额",
    marketCap: "市值",
    holders: "持有人",
    lpCount: "LP 数量",
    volume24h: "24小时成交量",
    reset: "重置",
    
    // Token Card
    supply: "供应量",
    change24h: "24小时涨跌",
    pool: "池子",
    dividend: "分红",
    burn: "燃烧",
    marketing: "营销",
    viewDetails: "查看详情",
    
    // Platform Stats
    totalTokens: "代币总数",
    activeUsers: "活跃用户",
    totalLp: "LP 总量",
    
    // Announcement Bar
    announcement: "欢迎来到 MemeLaunch！零预挖公平发射平台，几分钟内创建您的 MEME 代币。",
    
    // Footer
    resources: "资源",
    documentation: "文档",
    whitepaper: "白皮书",
    tutorial: "教程",
    community: "社区",
    discord: "Discord",
    telegram: "Telegram",
    twitter: "Twitter",
    allRights: "版权所有",
    
    // Index Page
    searchPlaceholder: "按代币名称、符号或合约地址搜索...",
    howToCreate: "如何创建代币",
    tutorial1: "步骤 1：连接钱包",
    tutorial2: "步骤 2：填写代币信息",
    tutorial3: "步骤 3：部署并上线",
    loadMore: "加载更多代币",
    
    // Scrolling Banner
    banner1: "🚀 新代币：$ROCKET 已上线，500 BNB 池子！",
    banner2: "⭐ $STAR 已激活 LP 奖励 - 立即交易！",
    banner3: "🔥 $FIRE 最新交易：50 BNB 买入！",
    banner4: "💎 $DIAMOND 达到 1000 持有人里程碑！",
    banner5: "🌙 $MOON LP 建设阶段将在 2 小时后结束！",
    
    // Trading
    priceChart: "价格图表",
    price: "价格",
    volume: "成交量",
    buy: "买入",
    sell: "卖出",
    amount: "数量",
    youGet: "您将获得",
    slippage: "滑点",
    slippageTolerance: "滑点容差",
    balance: "余额",
    orderBook: "订单簿",
    total: "总计",
    error: "错误",
    success: "成功",
    copied: "已复制",
    copiedToClipboard: "已复制到剪贴板",
    
    // API page
    apiInterface: "API 接口",
    apiSubtitle: "通过真实 API 端点实现自动化交易和集成",
    apiKeyManagement: "API 密钥管理",
    apiDocs: "接口文档",
    apiKeyNameRequired: "请输入 API 密钥名称",
    apiKeyGenerated: "API 密钥已生成",
    apiKeyDeleted: "API 密钥已删除",
    generateNewApiKey: "生成新的 API 密钥",
    createApiKeyDescription: "创建 API 密钥以访问交易接口",
    keyName: "密钥名称",
    apiKeyNamePlaceholder: "例如：生产环境密钥",
    generateKey: "生成密钥",
    apiKeyWarning: "请妥善保管您的 API 密钥，不要与他人分享。密钥泄露可能导致资金损失。",
    myApiKeys: "我的 API 密钥",
    manageApiKeys: "管理您的 API 密钥",
    noApiKeys: "暂无 API 密钥，请先生成",
    createdAt: "创建时间",
    apiDocumentation: "API 接口文档",
    apiDocumentationDescription: "完整的 API 接口使用说明和示例",
    authentication: "认证方式",
    baseUrl: "基础 URL",
    tradeApis: "交易接口",
    submitChainTransactionDocs: "提交真实链上交易记录",
    requestParams: "请求参数",
    responseExample: "响应示例",
    createManagedOrderDocs: "创建后端托管限价或风控订单",
    queryTokenInfo: "查询代币信息",
    queryCommissionLedger: "查询佣金账本和可提现余额",
    queryIndexerStatus: "查询当前 V3 合约 indexer 延迟和错误状态",
    codeExamples: "代码示例",
    errorCodes: "错误代码",
    badRequest: "请求参数错误",
    unauthorizedApi: "未授权，API key scope 不足或钱包签名无效",
    tooManyRequests: "请求过于频繁",
    serverError: "服务器错误",
    notes: "注意事项",
    rateLimitNote: "请求频率限制：每秒最多 10 次请求",
    writeAuthNote: "写入接口会校验 API key scope，或校验钱包 JWT 与 walletAddress 是否一致",
    gasNote: "所有链上交易都需要足够的余额和 gas 费用",
    testnetNote: "建议在测试网环境先进行测试",
    keepApiKeySafe: "请妥善保管 API 密钥，避免泄露",
  },
  繁体: {
    // Header
    market: "市場",
    charts: "行情",
    createToken: "創建代幣",
    share: "分享",
    node: "節點",
    goldenDogRanking: "金狗排行榜",
    api: "API 接口",
    connect: "連接",
    connected: "已連接",
    
    // Market Tabs
    launched: "已發射",
    pending: "待發射",
    lpBuilding: "LP 建設中",
    myLp: "我的 LP",
    dividends: "美股",
    following: "關注",
    smartMoney: "聰明錢",
    
    back: "返回",
    transactions: "交易記錄",
    info: "信息",
    
    // Filter Panel
    filters: "篩選器",
    dividendToken: "分紅代幣",
    burnToken: "燃燒代幣",
    marketingToken: "營銷代幣",
    devCleared: "開發者已清理",
    hasMedia: "有媒體",
    poolAmount: "池子金額",
    marketCap: "市值",
    holders: "持幣地址",
    lpCount: "LP 數量",
    volume24h: "24小時成交量",
    reset: "重置",
    
    // Token Card
    supply: "供應量",
    change24h: "24h 漲跌",
    pool: "池子",
    dividend: "分紅",
    burn: "燃燒",
    marketing: "營銷",
    viewDetails: "查看詳情",
    
    // Platform Stats
    totalTokens: "代幣總數",
    activeUsers: "活躍用戶",
    totalLp: "LP 總量",
    
    // Announcement Bar
    announcement: "🎉 歡迎來到 MemeLaunch！零預挖的公平發射平台。幾分鐘內創建您的 MEME 代幣！",
    
    // Footer
    resources: "資源",
    documentation: "文檔",
    whitepaper: "白皮書",
    tutorial: "教程",
    community: "社區",
    discord: "Discord",
    telegram: "Telegram",
    twitter: "Twitter",
    allRights: "版權所有",
    
    // Index Page
    searchPlaceholder: "搜索代幣名稱、符號或合約地址...",
    howToCreate: "如何創建代幣",
    tutorial1: "步驟 1：連接錢包",
    tutorial2: "步驟 2：填寫代幣信息",
    tutorial3: "步驟 3：部署和發射",
    loadMore: "加載更多代幣",
    
    // Scrolling Banner
    banner1: "🚀 新代幣：$ROCKET 已發射，500 BNB 池子！",
    banner2: "⭐ $STAR 已激活 LP 積分 - 立即交易！",
    banner3: "🔥 $FIRE 最新交易：50 BNB 買入！",
    banner4: "💎 $DIAMOND 達到 1000 個持有者里程碑！",
    banner5: "🌙 $MOON LP 建設階段將在 2 小時後結束！",
    
    // Trading
    priceChart: "價格走勢",
    price: "價格",
    volume: "交易量",
    buy: "買入",
    sell: "賣出",
    amount: "數量",
    youGet: "您將獲得",
    slippage: "滑點",
    slippageTolerance: "滑點容差",
    balance: "餘額",
    orderBook: "訂單簿",
    total: "總額",
    error: "錯誤",
    success: "成功",
    copied: "已複製",
    copiedToClipboard: "已複製到剪貼板",
    
    // API page
    apiInterface: "API 接口",
    apiSubtitle: "透過真實 API 端點實現自動化交易和整合",
    apiKeyManagement: "API 密鑰管理",
    apiDocs: "接口文檔",
    apiKeyNameRequired: "請輸入 API 密鑰名稱",
    apiKeyGenerated: "API 密鑰已生成",
    apiKeyDeleted: "API 密鑰已刪除",
    generateNewApiKey: "生成新的 API 密鑰",
    createApiKeyDescription: "創建 API 密鑰以訪問交易接口",
    keyName: "密鑰名稱",
    apiKeyNamePlaceholder: "例如：生產環境密鑰",
    generateKey: "生成密鑰",
    apiKeyWarning: "請妥善保管您的 API 密鑰，不要與他人分享。密鑰洩露可能導致資金損失。",
    myApiKeys: "我的 API 密鑰",
    manageApiKeys: "管理您的 API 密鑰",
    noApiKeys: "暫無 API 密鑰，請先生成",
    createdAt: "創建時間",
    apiDocumentation: "API 接口文檔",
    apiDocumentationDescription: "完整的 API 接口使用說明和示例",
    authentication: "認證方式",
    baseUrl: "基礎 URL",
    tradeApis: "交易接口",
    submitChainTransactionDocs: "提交真實鏈上交易記錄",
    requestParams: "請求參數",
    responseExample: "響應示例",
    createManagedOrderDocs: "創建後端託管限價或風控訂單",
    queryTokenInfo: "查詢代幣信息",
    queryCommissionLedger: "查詢佣金賬本和可提現餘額",
    queryIndexerStatus: "查詢當前 V3 合約 indexer 延遲和錯誤狀態",
    codeExamples: "代碼示例",
    errorCodes: "錯誤代碼",
    badRequest: "請求參數錯誤",
    unauthorizedApi: "未授權，API key scope 不足或錢包簽名無效",
    tooManyRequests: "請求過於頻繁",
    serverError: "服務器錯誤",
    notes: "注意事項",
    rateLimitNote: "請求頻率限制：每秒最多 10 次請求",
    writeAuthNote: "寫入接口會校驗 API key scope，或校驗錢包 JWT 與 walletAddress 是否一致",
    gasNote: "所有鏈上交易都需要足夠的餘額和 gas 費用",
    testnetNote: "建議在測試網環境先進行測試",
    keepApiKeySafe: "請妥善保管 API 密鑰，避免洩露",
  },
  日本語: {
    // Header
    market: "マーケット",
    charts: "チャート",
    createToken: "トークン作成",
    share: "共有",
    node: "ノード",
    goldenDogRanking: "ゴールデンドッグランキング",
    api: "API",
    connect: "接続",
    connected: "接続済み",
    
    // Market Tabs
    launched: "ローンチ済み",
    pending: "保留中",
    lpBuilding: "LP 構築中",
    myLp: "マイ LP",
    dividends: "米国株",
    following: "フォロー中",
    smartMoney: "スマートマネー",
    
    back: "戻る",
    transactions: "取引履歴",
    info: "情報",
    
    // Filter Panel
    filters: "フィルター",
    dividendToken: "配当トークン",
    burnToken: "バーントークン",
    marketingToken: "マーケティングトークン",
    devCleared: "開発者クリア済み",
    hasMedia: "メディアあり",
    poolAmount: "プール額",
    marketCap: "時価総額",
    holders: "ホルダー数",
    lpCount: "LP 数",
    volume24h: "24時間取引高",
    reset: "リセット",
    
    // Token Card
    supply: "供給量",
    change24h: "24時間変動",
    pool: "プール",
    dividend: "配当",
    burn: "バーン",
    marketing: "マーケティング",
    viewDetails: "詳細を見る",
    
    // Platform Stats
    totalTokens: "総トークン数",
    activeUsers: "アクティブユーザー",
    totalLp: "総 LP",
    
    // Announcement Bar
    announcement: "🎉 MemeLaunch へようこそ！ゼロプレマインの公平なローンチプラットフォーム。数分で MEME トークンを作成！",
    
    // Footer
    resources: "リソース",
    documentation: "ドキュメント",
    whitepaper: "ホワイトペーパー",
    tutorial: "チュートリアル",
    community: "コミュニティ",
    discord: "Discord",
    telegram: "Telegram",
    twitter: "Twitter",
    allRights: "全著作権所有",
    
    // Index Page
    searchPlaceholder: "トークン名、シンボル、またはコントラクトアドレスで検索...",
    howToCreate: "トークンの作成方法",
    tutorial1: "ステップ 1：ウォレット接続",
    tutorial2: "ステップ 2：トークン情報入力",
    tutorial3: "ステップ 3：デプロイとローンチ",
    loadMore: "さらにトークンを読み込む",
    
    // Scrolling Banner
    banner1: "🚀 新トークン：$ROCKET が 500 BNB プールでローンチ！",
    banner2: "⭐ $STAR が LP をポイントで有効化 - 今すぐ取引！",
    banner3: "🔥 $FIRE の最新取引：50 BNB の買い！",
    banner4: "💎 $DIAMOND が 1000 ホルダーのマイルストーン達成！",
    banner5: "🌙 $MOON の LP 構築フェーズが 2 時間後に終了！",
    
    // Trading
    priceChart: "価格チャート",
    price: "価格",
    volume: "出来高",
    buy: "購入",
    sell: "売却",
    amount: "数量",
    youGet: "受取額",
    slippage: "スリッページ",
    slippageTolerance: "スリッページ許容値",
    balance: "残高",
    orderBook: "オーダーブック",
    total: "合計",
    error: "エラー",
    success: "成功",
    copied: "コピーしました",
    copiedToClipboard: "クリップボードにコピーしました",
    
    // API page
    apiInterface: "API",
    apiSubtitle: "実際の API エンドポイントで取引と連携を自動化します",
    apiKeyManagement: "API キー管理",
    apiDocs: "API ドキュメント",
    apiKeyNameRequired: "API キー名を入力してください",
    apiKeyGenerated: "API キーを生成しました",
    apiKeyDeleted: "API キーを削除しました",
    generateNewApiKey: "新しい API キーを生成",
    createApiKeyDescription: "取引エンドポイントにアクセスする API キーを作成します",
    keyName: "キー名",
    apiKeyNamePlaceholder: "例：本番環境キー",
    generateKey: "キーを生成",
    apiKeyWarning: "API キーは安全に保管してください。漏洩すると資金損失につながる可能性があります。",
    myApiKeys: "自分の API キー",
    manageApiKeys: "API キーを管理",
    noApiKeys: "API キーはまだありません。先に生成してください。",
    createdAt: "作成日時",
    apiDocumentation: "API ドキュメント",
    apiDocumentationDescription: "API の使い方とサンプル",
    authentication: "認証方式",
    baseUrl: "ベース URL",
    tradeApis: "取引 API",
    submitChainTransactionDocs: "実際のオンチェーン取引記録を送信します",
    requestParams: "リクエストパラメータ",
    responseExample: "レスポンス例",
    createManagedOrderDocs: "バックエンド管理の指値またはリスク注文を作成します",
    queryTokenInfo: "トークン情報を照会",
    queryCommissionLedger: "コミッション台帳と出金可能残高を照会",
    queryIndexerStatus: "現在の V3 コントラクト indexer の遅延とエラー状態を照会",
    codeExamples: "コード例",
    errorCodes: "エラーコード",
    badRequest: "リクエストパラメータが不正です",
    unauthorizedApi: "未認証、API key scope 不足またはウォレット署名が無効です",
    tooManyRequests: "リクエストが多すぎます",
    serverError: "サーバーエラー",
    notes: "注意事項",
    rateLimitNote: "レート制限：1 秒あたり最大 10 リクエスト",
    writeAuthNote: "書き込み API は API key scope、または walletAddress と一致するウォレット JWT を検証します",
    gasNote: "すべてのオンチェーン取引には十分な残高と gas が必要です",
    testnetNote: "本番利用前にテストネットで検証してください",
    keepApiKeySafe: "API キーを安全に保管し、漏洩を避けてください",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("EN");

  const t = (key: string): string => {
    const dictionary = translations[language] as Record<string, string>;
    const fallback = translations.EN as Record<string, string>;
    return dictionary[key] || fallback[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
