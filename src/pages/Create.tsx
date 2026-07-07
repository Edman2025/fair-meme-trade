import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2, Upload, ArrowLeft, CalendarIcon, Plus, X, ExternalLink, FileText, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useMvp } from "@/contexts/MvpContext";
import { createTokenOnChain } from "@/lib/chainWrite";
import { enableDemoFallback } from "@/lib/runtimeFlags";

const TOTAL_SUPPLY = 1_000_000_000;

const formSchema = z.object({
  // A. 基本信息
  name: z.string().min(2, "代币名称至少2个字符"),
  symbol: z.string().min(2, "代币符号至少2个字符").max(10),
  logo: z.string().optional(),
  website: z.string().url("请输入有效网址").optional().or(z.literal("")),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  description: z.string().min(10, "项目描述至少10个字符"),

  // a. 初始市值与LP份额
  initialMarketCap: z.string().min(1, "请输入初始总市值"),
  totalLpShares: z.string().min(1, "请输入LP总份额"),

  // b. 初始流动性设置
  lpCurrency: z.enum(["USDT", "BNB"]),
  teamLpShares: z.string().min(1, "请输入项目方LP份额"),
  lpStartTime: z.date({ required_error: "请选择开始时间" }),
  lpEndTime: z.date({ required_error: "请选择结束时间" }),
  lpReleaseType: z.enum(["oneTime", "linear"]),
  lpLinearDays: z.string().optional(),

  // d. 营销
  hasMarketing: z.boolean().default(false),

  // e. 开盘购买金额
  openingBuyAmount: z.string().optional(),
  openingBuyCurrency: z.enum(["USDT", "BNB"]).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const DateTimePicker = ({ value, onChange, placeholder }: { value?: Date; onChange: (d: Date) => void; placeholder: string }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn("w-full pl-3 text-left font-normal", !value && "text-muted-foreground")}
      >
        {value ? format(value, "yyyy-MM-dd HH:mm") : <span>{placeholder}</span>}
        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={value}
        onSelect={(date) => {
          if (date) {
            const cur = value || new Date();
            date.setHours(cur.getHours());
            date.setMinutes(cur.getMinutes());
            onChange(date);
          }
        }}
        initialFocus
        className="p-3 pointer-events-auto"
      />
      <div className="p-3 border-t flex gap-2">
        <div className="flex-1">
          <label className="text-sm text-muted-foreground mb-1 block">小时</label>
          <Input
            type="number" min="0" max="23"
            value={value ? value.getHours() : 0}
            onChange={(e) => {
              const d = value || new Date();
              d.setHours(parseInt(e.target.value) || 0);
              onChange(new Date(d));
            }}
          />
        </div>
        <div className="flex-1">
          <label className="text-sm text-muted-foreground mb-1 block">分钟</label>
          <Input
            type="number" min="0" max="59"
            value={value ? value.getMinutes() : 0}
            onChange={(e) => {
              const d = value || new Date();
              d.setMinutes(parseInt(e.target.value) || 0);
              onChange(new Date(d));
            }}
          />
        </div>
      </div>
    </PopoverContent>
  </Popover>
);

const Create = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { createToken, isConnected, connectWallet, connectInjectedWallet } = useMvp();
  const [isCreating, setIsCreating] = useState(false);
  const [marketingAddresses, setMarketingAddresses] = useState<{ address: string; percentage: string }[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      symbol: "",
      logo: "",
      website: "",
      twitter: "",
      telegram: "",
      description: "",
      initialMarketCap: "",
      totalLpShares: "",
      lpCurrency: "USDT",
      teamLpShares: "",
      lpReleaseType: "oneTime",
      hasMarketing: false,
      openingBuyAmount: "",
      openingBuyCurrency: "USDT",
    },
  });

  const hasMarketing = form.watch("hasMarketing");
  const lpReleaseType = form.watch("lpReleaseType");
  const lpEndTime = form.watch("lpEndTime");
  const initialMarketCap = form.watch("initialMarketCap");
  const totalLpShares = form.watch("totalLpShares");
  const teamLpShares = form.watch("teamLpShares");
  const lpCurrency = form.watch("lpCurrency");

  const perSharePrice = useMemo(() => {
    const cap = parseFloat(initialMarketCap || "0");
    const shares = parseFloat(totalLpShares || "0");
    if (cap > 0 && shares > 0) return cap / shares;
    return 0;
  }, [initialMarketCap, totalLpShares]);

  const teamLpValue = useMemo(() => {
    const t = parseFloat(teamLpShares || "0");
    return t > 0 && perSharePrice > 0 ? t * perSharePrice : 0;
  }, [teamLpShares, perSharePrice]);

  const calculatedLaunchTime = lpEndTime ? new Date(lpEndTime.getTime() + 10 * 60 * 1000) : null;

  const addMarketingAddress = () => {
    if (marketingAddresses.length < 5) {
      setMarketingAddresses([...marketingAddresses, { address: "", percentage: "" }]);
    }
  };
  const removeMarketingAddress = (index: number) => {
    setMarketingAddresses(marketingAddresses.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: FormValues) => {
    if (!isConnected) {
      try {
        const signature = await connectInjectedWallet();
        toast({
          title: signature.mode === "wallet" ? "真实钱包已签名" : "已连接演示钱包",
          description: signature.mode === "wallet" ? "创建代币将记录到当前钱包地址。" : "已启用开发演示钱包。",
        });
      } catch (error) {
        toast({
          title: "真实钱包连接失败",
          description: error instanceof Error ? error.message : "请安装或解锁钱包后重试。",
          variant: "destructive",
        });
        return;
      }
    }
    setIsCreating(true);
    try {
      let tx: Awaited<ReturnType<typeof createTokenOnChain>> | null = null;
      try {
        tx = await createTokenOnChain({
          name: values.name,
          symbol: values.symbol,
          totalSupply: String(TOTAL_SUPPLY),
          metadataURI: JSON.stringify({
            description: values.description,
            website: values.website,
            twitter: values.twitter,
            telegram: values.telegram,
            hasMarketing: values.hasMarketing,
          }),
          lpDeadline: values.lpEndTime,
        });
      } catch (error) {
        if (!enableDemoFallback) {
          toast({
            title: "链上创建失败",
            description: error instanceof Error ? error.message : "请检查钱包网络、余额和签名状态。",
            variant: "destructive",
          });
          setIsCreating(false);
          return;
        }
        toast({
          title: "链上创建不可用，已使用开发演示创建",
          description: error instanceof Error ? error.message : "请检查钱包网络、余额和签名状态。",
        });
      }
      if (enableDemoFallback || !tx) {
        createToken({
          name: values.name,
          symbol: values.symbol,
          logo: values.logo,
          description: values.description,
          website: values.website,
          twitter: values.twitter,
          telegram: values.telegram,
          initialMarketCap: values.initialMarketCap,
          totalLpShares: values.totalLpShares,
          lpCurrency: values.lpCurrency,
          teamLpShares: values.teamLpShares,
          lpEndTime: values.lpEndTime,
          hasMarketing: values.hasMarketing,
          releaseType: values.lpReleaseType,
          releaseLinearDays: values.lpLinearDays,
        });
      }
      toast({
        title: tx ? "链上创建交易已提交" : "开发演示代币已创建",
        description: tx ? `${values.name} (${values.symbol}) tx: ${tx.txHash.slice(0, 10)}...` : `${values.name} (${values.symbol}) 已进入开发演示流程。`,
      });
      setIsCreating(false);
      navigate(`/lp-launch/${values.symbol.toUpperCase()}`);
    } catch (error) {
      setIsCreating(false);
      toast({
        title: "链上创建失败",
        description: error instanceof Error ? error.message : "请检查钱包网络、余额和签名状态。",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h1 className="text-3xl font-bold">创建代币</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  中文创建教程
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  English Tutorial
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            代币初始发行总量固定 <span className="text-foreground font-semibold">1,000,000,000</span> 枚 · LP 锁仓 30 天 · LP 分红 0.3% · 开盘自动 = LP 结束后 10 分钟
          </p>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* A. 基本信息 */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold border-b pb-2">A. 基本信息</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>代币名称 *</FormLabel>
                      <FormControl><Input placeholder="例如：FairLaunch Token" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="symbol" render={({ field }) => (
                    <FormItem>
                      <FormLabel>代币符号 *</FormLabel>
                      <FormControl><Input placeholder="例如：ROCKET" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="logo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>代币 LOGO（支持图片 / 动图 / 视频）</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input placeholder="上传或输入 URL" {...field} />
                        <Button type="button" variant="outline" size="icon"><Upload className="h-4 w-4" /></Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="website" render={({ field }) => (
                    <FormItem><FormLabel>官方网站</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="twitter" render={({ field }) => (
                    <FormItem><FormLabel>推特链接</FormLabel><FormControl><Input placeholder="@username" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="telegram" render={({ field }) => (
                    <FormItem><FormLabel>电报链接</FormLabel><FormControl><Input placeholder="t.me/group" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>项目描述 *</FormLabel>
                    <FormControl><Textarea rows={4} placeholder="描述您的项目..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* a. 初始市值与LP份额 */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold border-b pb-2">a. 初始发行参数</h2>

                <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm">
                  <Info className="h-4 w-4 text-primary" />
                  <span>代币初始发行总量：<span className="font-semibold text-foreground">1,000,000,000</span> 枚（固定）</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="initialMarketCap" render={({ field }) => (
                    <FormItem>
                      <FormLabel>代币初始发行总市值 *</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <Input type="number" placeholder="例如：100000" {...field} />
                          <span className="ml-2 self-center text-sm text-muted-foreground">{lpCurrency}</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="totalLpShares" render={({ field }) => (
                    <FormItem>
                      <FormLabel>代币初始 LP 总份额 *</FormLabel>
                      <FormControl><Input type="number" placeholder="例如：1000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-sm">
                  每份 LP 金额：<span className="font-semibold text-primary">
                    {perSharePrice > 0 ? `${perSharePrice.toFixed(4)} ${lpCurrency}` : "—"}
                  </span>
                </div>
              </div>

              {/* b. 初始流动性 */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold border-b pb-2">b. 初始流动性设置</h2>

                <FormField control={form.control} name="lpCurrency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>添加 LP 价值币 *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="BNB">BNB</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="teamLpShares" render={({ field }) => (
                  <FormItem>
                    <FormLabel>项目方添加 LP 份额数量 *</FormLabel>
                    <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                    <FormDescription>
                      所需总金额：<span className="font-semibold text-primary">
                        {teamLpValue > 0 ? `${teamLpValue.toFixed(4)} ${lpCurrency}` : "—"}
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="lpStartTime" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>添加 LP 开始时间 *</FormLabel>
                      <DateTimePicker value={field.value} onChange={field.onChange} placeholder="选择日期时间" />
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lpEndTime" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>添加 LP 结束时间 *</FormLabel>
                      <DateTimePicker value={field.value} onChange={field.onChange} placeholder="选择日期时间" />
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-2">
                  <FormLabel>LP 锁仓时长</FormLabel>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm">
                    <span className="font-medium">固定锁仓：30 天</span>
                  </div>
                </div>

                <FormField control={form.control} name="lpReleaseType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>LP 锁仓到期后释放规则 *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="oneTime">一次性释放</SelectItem>
                        <SelectItem value="linear">自定义线性释放</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {lpReleaseType === "linear" && (
                  <FormField control={form.control} name="lpLinearDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>线性释放天数 *</FormLabel>
                      <FormControl><Input type="number" placeholder="例如：180" {...field} /></FormControl>
                      <FormDescription>分多少天线性释放</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              {/* c. LP 分红 */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold border-b pb-2">c. LP 分红</h2>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm">
                  <Info className="h-4 w-4 text-primary" />
                  <span>LP 分红百分比：<span className="font-semibold text-foreground">0.3%</span>（固定）</span>
                </div>
              </div>

              {/* d. 营销费用 */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold border-b pb-2">d. 营销费用（选填）</h2>

                <FormField control={form.control} name="hasMarketing" render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <FormLabel>启用营销费用</FormLabel>
                      <FormDescription>设置营销费用后，代币自动归属营销币种类</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                {hasMarketing && (
                  <div className="space-y-3">
                    {marketingAddresses.map((addr, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="营销钱包地址"
                          value={addr.address}
                          onChange={(e) => {
                            const a = [...marketingAddresses];
                            a[index].address = e.target.value;
                            setMarketingAddresses(a);
                          }}
                        />
                        <Input
                          type="number"
                          placeholder="费用%"
                          className="w-28"
                          value={addr.percentage}
                          onChange={(e) => {
                            const a = [...marketingAddresses];
                            a[index].percentage = e.target.value;
                            setMarketingAddresses(a);
                          }}
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeMarketingAddress(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {marketingAddresses.length < 5 && (
                      <Button type="button" variant="outline" onClick={addMarketingAddress} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        添加营销地址（最多 5 个）
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* e. 开盘设置 */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold border-b pb-2">e. 开盘设置</h2>

                <div className="space-y-2">
                  <FormLabel>开盘时间</FormLabel>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm">
                    <span className="font-medium">
                      {calculatedLaunchTime
                        ? `自动开盘：${format(calculatedLaunchTime, "yyyy-MM-dd HH:mm")}`
                        : "添加 LP 结束后 10 分钟自动开盘"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="openingBuyAmount" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>开盘购买金额（选填）</FormLabel>
                      <FormControl><Input type="number" placeholder="最低 10 USDT 或 0.01 BNB" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="openingBuyCurrency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>币种</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="USDT">USDT</SelectItem>
                          <SelectItem value="BNB">BNB</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* B / C 规则说明 */}
              <Alert>
                <AlertDescription className="space-y-2">
                  <p className="font-semibold">认领 & 锁仓规则：</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>代币创建者可认领多份 LP</li>
                    <li>普通用户一个钱包地址只可认领 1 份 LP</li>
                    <li>LP 添加时间到期后，未添加 LP 部分代币一次性转入黑洞地址销毁</li>
                    <li>所有用户添加的 LP 锁仓时间从每个钱包添加时间开始单独计算，到期后按照释放规则一次性释放或分期释放</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/")} disabled={isCreating}>
                  取消
                </Button>
                <Button type="submit" className="flex-1 bg-gradient-primary hover:shadow-glow" disabled={isCreating}>
                  {isCreating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />创建中...</>
                  ) : "创建代币"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Create;
