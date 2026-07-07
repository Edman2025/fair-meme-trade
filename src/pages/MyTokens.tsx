import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Settings,
  Plus,
  Edit
} from "lucide-react";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Label } from "@/components/ui/label";
import { useMvp } from "@/contexts/MvpContext";

const MyTokens = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tokens, walletAddress } = useMvp();
  const [priorityBuy, setPriorityBuy] = useState("");

  const myTokens = tokens
    .filter((token) => token.creatorWallet.toLowerCase() === walletAddress.toLowerCase())
    .map((token) => ({
      id: token.symbol,
      name: token.name,
      symbol: token.symbol,
      totalSupply: token.totalSupply,
      lpStatus: token.status === "building" ? "进行中" : "已结束",
      launchStatus: token.status === "launched" ? "已开盘" : token.status === "pending" ? "待开盘" : "未开盘",
      website: token.website || "",
      twitter: token.twitter || "",
      telegram: token.telegram || "",
      description: token.description,
    }));

  const handleSetPriorityBuy = () => {
    toast({
      title: "优先购买设置成功",
      description: `优先购买金额：${priorityBuy} USDT`,
    });
    setPriorityBuy("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          
          <h1 className="text-3xl font-bold mb-2">我创建的代币</h1>
          <p className="text-muted-foreground">
            管理您创建的代币，设置开盘时间、激活码、白名单等
          </p>
        </div>

        {/* 代币列表 */}
        <div className="bg-card rounded-lg border overflow-hidden mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>代币名称</TableHead>
                <TableHead>符号</TableHead>
                <TableHead>总供应量</TableHead>
                <TableHead>LP状态</TableHead>
                <TableHead>开盘状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myTokens.map((token) => (
                <TableRow key={token.id}>
                  <TableCell className="font-medium">{token.name}</TableCell>
                  <TableCell>{token.symbol}</TableCell>
                  <TableCell>{token.totalSupply}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs",
                      token.lpStatus === "进行中" ? "bg-primary/10 text-primary" : "bg-muted"
                    )}>
                      {token.lpStatus}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs",
                      token.launchStatus === "已开盘" ? "bg-success/10 text-success" : "bg-muted"
                    )}>
                      {token.launchStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4 mr-1" />
                          管理
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>管理代币：{token.name} ({token.symbol})</DialogTitle>
                          <DialogDescription>
                            设置开盘时间、激活码、白名单等功能
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6 py-4">

                          {/* 优先购买 */}
                          <div className="space-y-3 border-t pt-4">
                            <h3 className="font-semibold">优先购买金额（限设置一次）</h3>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                placeholder="优先购买金额"
                                value={priorityBuy}
                                onChange={(e) => setPriorityBuy(e.target.value)}
                              />
                              <Select defaultValue="USDT">
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="USDT">USDT</SelectItem>
                                  <SelectItem value="BNB">BNB</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button onClick={handleSetPriorityBuy}>
                                设置
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              最低10 USDT或0.01 BNB
                            </p>
                          </div>

                          {/* 编辑媒体信息 */}
                          <div className="space-y-3 border-t pt-4">
                            <h3 className="font-semibold flex items-center gap-2">
                              <Edit className="h-4 w-4" />
                              编辑媒体信息
                            </h3>
                            <div className="space-y-3">
                              <div>
                                <Label>官方网站</Label>
                                <Input placeholder="https://..." className="mt-2" defaultValue={token.website} />
                              </div>
                              <div>
                                <Label>推特</Label>
                                <Input placeholder="@username" className="mt-2" defaultValue={token.twitter} />
                              </div>
                              <div>
                                <Label>电报</Label>
                                <Input placeholder="t.me/group" className="mt-2" defaultValue={token.telegram} />
                              </div>
                              <div>
                                <Label>项目介绍</Label>
                                <Textarea rows={3} className="mt-2" defaultValue={token.description} />
                              </div>
                              <Button>保存更新</Button>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {myTokens.length === 0 && (
          <div className="text-center py-12 bg-card rounded-lg border">
            <p className="text-muted-foreground mb-4">您还没有创建任何代币</p>
            <Button onClick={() => navigate("/create")}>
              <Plus className="mr-2 h-4 w-4" />
              创建第一个代币
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MyTokens;
