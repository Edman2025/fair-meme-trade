import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Eye, EyeOff, Key, Trash2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMvp } from "@/contexts/MvpContext";

const Api = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { apiKeys, generateApiKey: createApiKey, deleteApiKey: removeApiKey } = useMvp();
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [newKeyName, setNewKeyName] = useState("");

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: t("error"),
        description: t("apiKeyNameRequired"),
        variant: "destructive",
      });
      return;
    }

    try {
      await createApiKey(newKeyName.trim());
      setNewKeyName("");
      toast({
        title: t("success"),
        description: t("apiKeyGenerated"),
      });
    } catch (error) {
      toast({
        title: "API 密钥创建失败",
        description: error instanceof Error ? error.message : "请先连接并签名钱包。",
        variant: "destructive",
      });
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      await removeApiKey(id);
      toast({
        title: t("success"),
        description: t("apiKeyDeleted"),
      });
    } catch (error) {
      toast({
        title: "API 密钥删除失败",
        description: error instanceof Error ? error.message : "请重新完成钱包登录后再试。",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t("success"),
      description: t("copiedToClipboard"),
    });
  };

  const toggleKeyVisibility = (id: string) => {
    setShowKeys({ ...showKeys, [id]: !showKeys[id] });
  };

  const maskKey = (key: string) => {
    return `${key.substring(0, 8)}${"*".repeat(20)}${key.substring(key.length - 4)}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-secondary/20">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 mt-16">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t("apiInterface")}</h1>
            <p className="text-muted-foreground">
              {t("apiSubtitle")}
            </p>
          </div>

          <Tabs defaultValue="keys" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="keys">{t("apiKeyManagement")}</TabsTrigger>
              <TabsTrigger value="docs">{t("apiDocs")}</TabsTrigger>
            </TabsList>

            <TabsContent value="keys" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    {t("generateNewApiKey")}
                  </CardTitle>
                  <CardDescription>
                    {t("createApiKeyDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="keyName">{t("keyName")}</Label>
                      <Input
                        id="keyName"
                        placeholder={t("apiKeyNamePlaceholder")}
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={generateApiKey}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t("generateKey")}
                      </Button>
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription>
                      {t("apiKeyWarning")}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("myApiKeys")}</CardTitle>
                  <CardDescription>
                    {t("manageApiKeys")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {apiKeys.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      {t("noApiKeys")}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {apiKeys.map((apiKey) => (
                        <div
                          key={apiKey.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{apiKey.name}</h3>
                              <Badge variant="secondary">Active</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-sm bg-muted px-2 py-1 rounded">
                                {showKeys[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleKeyVisibility(apiKey.id)}
                              >
                                {showKeys[apiKey.id] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyToClipboard(apiKey.key)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {t("createdAt")}: {apiKey.createdAt}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteApiKey(apiKey.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="docs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("apiDocumentation")}</CardTitle>
                  <CardDescription>
                    {t("apiDocumentationDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t("authentication")}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      公开读取接口可直接访问；用户写入接口需要钱包登录 JWT，自动由前端携带；外部集成写入接口需要带有对应 scope 的 API key。
                    </p>
                    <div className="bg-muted p-4 rounded-lg">
                      <code className="text-sm">
                        Authorization: Bearer fmt_your_api_key
                      </code>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t("baseUrl")}</h3>
                    <div className="bg-muted p-4 rounded-lg">
                      <code className="text-sm">
                        https://english.xunlian.co/api
                      </code>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">{t("tradeApis")}</h3>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-green-500">POST</Badge>
                          <code className="text-sm">/chain-transactions</code>
                          <Badge variant="outline">trade scope</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t("submitChainTransactionDocs")}
                        </p>
                        
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">{t("requestParams")}</h4>
                            <div className="bg-muted p-4 rounded-lg">
                              <pre className="text-sm">
{`{
  "txHash": "0x1234...",
  "action": "swapBuy",
  "tokenAddress": "0xToken...",
  "walletAddress": "0xWallet...",
  "status": "submitted",
  "payload": { "amount": "1000", "slippage": "0.5" }
}`}
                              </pre>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">{t("responseExample")}</h4>
                            <div className="bg-muted p-4 rounded-lg">
                              <pre className="text-sm">
{`{
  "txHash": "0x1234...5678",
  "action": "swapBuy",
  "status": "submitted",
  "createdAt": "2026-06-04T12:00:00.000Z"
}`}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-red-500">POST</Badge>
                          <code className="text-sm">/orders</code>
                          <Badge variant="outline">trade scope 或钱包 JWT</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t("createManagedOrderDocs")}
                        </p>
                        
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">{t("requestParams")}</h4>
                            <div className="bg-muted p-4 rounded-lg">
                              <pre className="text-sm">
{`{
  "walletAddress": "0xWallet...",
  "tokenAddress": "0xToken...",
  "orderType": "limit",
  "side": "buy",
  "amount": "1000",
  "triggerPrice": "0.000123"
}`}
                              </pre>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">{t("responseExample")}</h4>
                            <div className="bg-muted p-4 rounded-lg">
                              <pre className="text-sm">
{`{
  "id": 12,
  "orderType": "limit",
  "side": "buy",
  "amount": "1000",
  "status": "pending"
}`}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>GET</Badge>
                          <code className="text-sm">/tokens/:symbol</code>
                          <Badge variant="outline">public / read scope</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t("queryTokenInfo")}
                        </p>
                        
                        <div>
                          <h4 className="font-medium mb-2">{t("responseExample")}</h4>
                          <div className="bg-muted p-4 rounded-lg">
                            <pre className="text-sm">
{`{
  "symbol": "TOKEN",
  "name": "Token Name",
  "tokenAddress": "0xToken...",
  "projectId": 1,
  "status": "launched"
}`}
                            </pre>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>GET</Badge>
                          <code className="text-sm">/ledger/commissions?wallet=0xWallet</code>
                          <Badge variant="outline">public read</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t("queryCommissionLedger")}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>GET</Badge>
                          <code className="text-sm">/indexer/status</code>
                          <Badge variant="outline">public read</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t("queryIndexerStatus")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">{t("codeExamples")}</h3>
                    
                    <Tabs defaultValue="javascript">
                      <TabsList>
                        <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                        <TabsTrigger value="python">Python</TabsTrigger>
                        <TabsTrigger value="curl">cURL</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="javascript">
                        <div className="bg-muted p-4 rounded-lg">
                          <pre className="text-sm">
{`const axios = require('axios');

const buyToken = async () => {
  try {
    const response = await axios.post(
      'https://english.xunlian.co/api/chain-transactions',
      {
        txHash: '0x1234...',
        action: 'swapBuy',
        tokenAddress: '0xToken...',
        walletAddress: '0xWallet...',
        status: 'submitted'
      },
      {
        headers: {
          'Authorization': 'Bearer fmt_your_api_key',
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
};

buyToken();`}
                          </pre>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="python">
                        <div className="bg-muted p-4 rounded-lg">
                          <pre className="text-sm">
{`import requests

def buy_token():
    url = 'https://english.xunlian.co/api/chain-transactions'
    headers = {
        'Authorization': 'Bearer fmt_your_api_key',
        'Content-Type': 'application/json'
    }
    data = {
        'txHash': '0x1234...',
        'action': 'swapBuy',
        'tokenAddress': '0xToken...',
        'walletAddress': '0xWallet...',
        'status': 'submitted'
    }
    
    response = requests.post(url, json=data, headers=headers)
    print(response.json())

buy_token()`}
                          </pre>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="curl">
                        <div className="bg-muted p-4 rounded-lg">
                          <pre className="text-sm">
{`curl -X POST https://english.xunlian.co/api/chain-transactions \\
  -H "Authorization: Bearer fmt_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "txHash": "0x1234...",
    "action": "swapBuy",
    "tokenAddress": "0xToken...",
    "walletAddress": "0xWallet...",
    "status": "submitted"
  }'`}
                          </pre>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t("errorCodes")}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-4 p-2 bg-muted rounded">
                        <code className="font-mono">400</code>
                        <span className="text-sm">{t("badRequest")}</span>
                      </div>
                      <div className="flex items-center gap-4 p-2 bg-muted rounded">
                        <code className="font-mono">401</code>
                        <span className="text-sm">{t("unauthorizedApi")}</span>
                      </div>
                      <div className="flex items-center gap-4 p-2 bg-muted rounded">
                        <code className="font-mono">429</code>
                        <span className="text-sm">{t("tooManyRequests")}</span>
                      </div>
                      <div className="flex items-center gap-4 p-2 bg-muted rounded">
                        <code className="font-mono">500</code>
                        <span className="text-sm">{t("serverError")}</span>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription>
                      <strong>{t("notes")}:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        <li>{t("rateLimitNote")}</li>
                        <li>{t("writeAuthNote")}</li>
                        <li>{t("gasNote")}</li>
                        <li>{t("testnetNote")}</li>
                        <li>{t("keepApiKeySafe")}</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Api;
