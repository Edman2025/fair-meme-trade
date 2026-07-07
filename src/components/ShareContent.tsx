import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Share2, TrendingUp, Users, Wallet, Download, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useMvp } from "@/contexts/MvpContext";
import { apiRequest } from "@/lib/backendApi";
import { getExplorerTxUrl } from "@/lib/chainConfig";

// 用户级别配置（普通用户分享 - 粉丝团）
const USER_LEVELS = [
  { level: "V0", fanVolume: 60, commission: 20 },
  { level: "V1", fanVolume: 1000, commission: 25 },
  { level: "V3", fanVolume: 999999, commission: 35 },
];

type CommissionRow = {
  amount: string;
  tokenAddress: string;
  status: string;
};
type CommissionLedgerTotal = {
  deposited: number;
  available: number;
  pending: number;
  paid: number;
  rejected: number;
};
type CommissionLedgerResponse = {
  rows: CommissionRow[];
  totals: Record<string, CommissionLedgerTotal>;
};

const ShareContent = () => {
  const { toast } = useToast();
  const { walletAddress, withdrawalRecords, requestCommissionWithdrawal, isConnected, connectWallet, connectInjectedWallet } = useMvp();
  const shortWallet = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  const shareLink = useMemo(() => `https://english.xunlian.co/ref/${shortWallet}`, [shortWallet]);

  const [userLevel] = useState("V1");
  const [totalCommission, setTotalCommission] = useState(0);
  const [availableCommission, setAvailableCommission] = useState(0);
  const [primaryCommissionToken, setPrimaryCommissionToken] = useState("");
  const [primaryCommissionAvailable, setPrimaryCommissionAvailable] = useState(0);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [inviteCurrentPage, setInviteCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const inviteList: Array<{ address: string; volume: number; fee: number; reward: number; level: string; time: string }> = [];

  const withdrawalHistory = withdrawalRecords;

  // 计算提现记录分页
  const totalPages = Math.ceil(withdrawalHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentWithdrawals = withdrawalHistory.slice(startIndex, endIndex);

  // 计算邀请列表分页
  const inviteTotalPages = Math.ceil(inviteList.length / itemsPerPage);
  const inviteStartIndex = (inviteCurrentPage - 1) * itemsPerPage;
  const inviteEndIndex = inviteStartIndex + itemsPerPage;
  const currentInvites = inviteList.slice(inviteStartIndex, inviteEndIndex);

  useEffect(() => {
    let cancelled = false;
    const loadCommissions = async () => {
      try {
        const ledger = await apiRequest<CommissionLedgerResponse>(`/api/ledger/commissions?wallet=${walletAddress}`);
        if (cancelled) return;
        const totals = ledger.totals || {};
        const total = Object.values(totals).reduce((sum, item) => sum + Number(item.deposited || 0), 0);
        const available = Object.values(totals).reduce((sum, item) => sum + Number(item.available || 0), 0);
        const [firstToken, firstAvailable] = Object.entries(totals)
          .map(([token, item]) => [token, Number(item.available || 0)] as const)
          .sort((left, right) => right[1] - left[1])[0] || ["", 0];
        setTotalCommission(total);
        setAvailableCommission(available);
        setPrimaryCommissionToken(firstToken);
        setPrimaryCommissionAvailable(firstAvailable);
      } catch {
        setTotalCommission(0);
        setAvailableCommission(0);
        setPrimaryCommissionToken("");
        setPrimaryCommissionAvailable(0);
      }
    };
    loadCommissions();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success">已完成</Badge>;
      case "processing":
        return <Badge className="bg-warning">处理中</Badge>;
      case "failed":
        return <Badge className="bg-destructive">失败</Badge>;
      default:
        return <Badge>未知</Badge>;
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleInvitePageChange = (page: number) => {
    setInviteCurrentPage(page);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    toast({
      title: "复制成功",
      description: "分享链接已复制到剪贴板",
    });
  };

  const handleWithdraw = async () => {
    if (!isConnected) {
      try {
        await connectInjectedWallet();
      } catch (error) {
        try {
          connectWallet();
        } catch {
          toast({
            title: "钱包连接失败",
            description: error instanceof Error ? error.message : "请安装或解锁钱包后重试。",
            variant: "destructive",
          });
          return;
        }
      }
    }
    if (!primaryCommissionToken) {
      toast({
        title: "暂无可提现 Token",
        description: "请等待 CommissionVault 事件进入后端佣金账本后再提现。",
        variant: "destructive",
      });
      return;
    }
    const amount = Math.min(primaryCommissionAvailable, 1000);
    if (amount <= 0) {
      toast({
        title: "暂无可提现佣金",
        description: "佣金余额以服务端真实账本和 token 地址为准。",
        variant: "destructive",
      });
      return;
    }
    try {
      await requestCommissionWithdrawal(amount, primaryCommissionToken);
      setAvailableCommission((current) => Math.max(0, current - amount));
      setPrimaryCommissionAvailable((current) => Math.max(0, current - amount));
      toast({
        title: "链上提现已提交",
        description: `${amount.toFixed(6)} 已提交 CommissionVault，等待 indexer 回写审核队列。`,
      });
    } catch (error) {
      toast({
        title: "提现申请失败",
        description: error instanceof Error ? error.message : "请确认钱包签名和可提现余额。",
        variant: "destructive",
      });
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case "V0":
        return "bg-gray-500";
      case "V1":
        return "bg-blue-500";
      case "V3":
        return "bg-amber-500";
      default:
        return "bg-gray-500";
    }
  };

  const getCurrentLevelInfo = () => {
    const currentIndex = USER_LEVELS.findIndex(l => l.level === userLevel);
    const current = USER_LEVELS[currentIndex];
    const next = USER_LEVELS[currentIndex + 1];
    return { current, next };
  };

  const { current: currentLevel, next: nextLevel } = getCurrentLevelInfo();

  return (
    <div className="w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">分享中心</h1>
          <p className="text-muted-foreground">邀请好友，共享收益</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">返佣比例</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-success">
                  {currentLevel.commission}%
                </span>
                <Badge className={`${getLevelBadgeColor(userLevel)} px-2 py-0.5`}>
                  {userLevel}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">总返佣</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                <span className="text-2xl font-bold">{totalCommission.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">USDT</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">可提现佣金</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{availableCommission.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">USDT</span>
              </div>
              <Button 
                onClick={handleWithdraw} 
                className="w-full bg-gradient-primary hover:shadow-glow"
              >
                <Download className="mr-2 h-4 w-4" />
                提现佣金
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">邀请人数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-info" />
                <span className="text-2xl font-bold">{inviteList.length}</span>
                <span className="text-sm text-muted-foreground">人</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 分享链接 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              我的分享链接
            </CardTitle>
            <CardDescription>分享此链接邀请好友，享受返佣奖励</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={shareLink} readOnly className="font-mono" />
              <Button onClick={handleCopy} size="icon" className="shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>



        {/* 升级方案和邀请列表 */}
        <Tabs defaultValue="invites" className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invites">我的邀请</TabsTrigger>
            <TabsTrigger value="withdrawal">提现记录</TabsTrigger>
          </TabsList>

          <TabsContent value="invites">
            <Card>
              <CardHeader>
                <CardTitle>邀请列表</CardTitle>
                <CardDescription>
                  查看您的下级用户交易情况和返佣明细 (共 {inviteList.length} 人)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>钱包地址</TableHead>
                        <TableHead>级别</TableHead>
                        <TableHead>邀请时间</TableHead>
                        <TableHead className="text-right">总交易量(万油)</TableHead>
                        <TableHead className="text-right">总手续费(%)</TableHead>
                        <TableHead className="text-right">总奖励(USDT)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentInvites.length > 0 ? currentInvites.map((invite, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{invite.address}</TableCell>
                          <TableCell>
                            <Badge className={getLevelBadgeColor(invite.level)}>
                              {invite.level}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {invite.time}
                          </TableCell>
                          <TableCell className="text-right">{invite.volume.toFixed(1)}</TableCell>
                          <TableCell className="text-right">{invite.fee.toFixed(3)}</TableCell>
                          <TableCell className="text-right font-semibold text-success">
                            {invite.reward.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            暂无真实邀请记录
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页控件 */}
                {inviteTotalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      显示 {inviteStartIndex + 1}-{Math.min(inviteEndIndex, inviteList.length)} 条，共 {inviteList.length} 条
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => inviteCurrentPage > 1 && handleInvitePageChange(inviteCurrentPage - 1)}
                            className={inviteCurrentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: inviteTotalPages }, (_, i) => i + 1).map((page) => {
                          if (
                            page === 1 ||
                            page === inviteTotalPages ||
                            (page >= inviteCurrentPage - 1 && page <= inviteCurrentPage + 1)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => handleInvitePageChange(page)}
                                  isActive={inviteCurrentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          } else if (page === inviteCurrentPage - 2 || page === inviteCurrentPage + 2) {
                            return (
                              <PaginationItem key={page}>
                                <span className="px-4">...</span>
                              </PaginationItem>
                            );
                          }
                          return null;
                        })}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => inviteCurrentPage < inviteTotalPages && handleInvitePageChange(inviteCurrentPage + 1)}
                            className={inviteCurrentPage === inviteTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawal">
            <Card>
              <CardHeader>
                <CardTitle>提现记录</CardTitle>
                <CardDescription>
                  查看您的历史提现记录和状态 (共 {withdrawalHistory.length} 条记录)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>提现时间</TableHead>
                        <TableHead className="text-right">提现金额(USDT)</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>交易哈希</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentWithdrawals.length > 0 ? currentWithdrawals.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono text-sm">
                            {record.time}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {record.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(record.status)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {record.txHash ? (
                              <a 
                                href={getExplorerTxUrl(record.txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {record.txHash}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            暂无真实提现记录
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页控件 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      显示 {startIndex + 1}-{Math.min(endIndex, withdrawalHistory.length)} 条，共 {withdrawalHistory.length} 条
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // 显示当前页、第一页、最后一页，以及当前页前后各一页
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => handlePageChange(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <PaginationItem key={page}>
                                <span className="px-4">...</span>
                              </PaginationItem>
                            );
                          }
                          return null;
                        })}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
};

export default ShareContent;
