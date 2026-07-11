import { useState, useEffect, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { Canvas as FabricCanvas, Line as FabricLine, Rect, Circle, Textbox, PencilBrush, type FabricObject } from "fabric";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMvp } from "@/contexts/MvpContext";

interface TokenChartProps {
  symbol: string;
}

const TokenChart = ({ symbol }: TokenChartProps) => {
  const { t } = useLanguage();
  const { getMarketSeries } = useMvp();
  const [timeframe, setTimeframe] = useState("1H");
  const [activeTool, setActiveTool] = useState<"select" | "line" | "hline" | "trendline" | "rect" | "text" | "pencil">("select");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tempObjectRef = useRef<FabricObject | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);

  const priceData = getMarketSeries(symbol, timeframe);

  const klineData = useMemo(() => priceData.map((point, index) => {
    const fallbackClose = point.price || 0;
    const open = point.open ?? fallbackClose;
    const high = point.high ?? fallbackClose;
    const low = point.low ?? fallbackClose;
    const close = point.close ?? fallbackClose;
    return {
      ...point,
      open,
      high,
      low,
      close,
      isUp: close >= open,
    };
  }), [priceData]);

  const latestCandle = klineData[klineData.length - 1];
  const hasKlineData = klineData.length > 0;
  const highPrice = hasKlineData ? Math.max(...klineData.map((d) => d.high)) : 0;
  const lowPrice = hasKlineData ? Math.min(...klineData.map((d) => d.low)) : 0;
  const chartHeight = 160;
  const chartPadding = { top: 10, right: 66, bottom: 18, left: 6 };
  const plotWidth = Math.max(chartWidth - chartPadding.left - chartPadding.right, 1);
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const priceRange = Math.max(highPrice - lowPrice, highPrice * 0.01, 0.00000001);
  const candleStep = klineData.length ? plotWidth / klineData.length : plotWidth;
  const candleBodyWidth = Math.max(3, Math.min(14, candleStep * 0.58));
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = highPrice - priceRange * ratio;
    const y = chartPadding.top + plotHeight * ratio;
    return { y, value };
  });
  const priceToY = (value: number) => chartPadding.top + ((highPrice - value) / priceRange) * plotHeight;
  const candleX = (index: number) => chartPadding.left + candleStep * index + candleStep / 2;

  type ChartTooltipPayload = { value: number; payload: { time: string } };
  type ChartTooltipProps = { active?: boolean; payload?: ChartTooltipPayload[] };

  const VolumeTooltip = ({ active, payload }: ChartTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-elegant">
          <p className="text-sm font-semibold text-foreground">
            ${(payload[0].value / 1000).toFixed(2)}K
          </p>
          <p className="text-xs text-muted-foreground">{payload[0].payload.time}</p>
        </div>
      );
    }
    return null;
  };

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || !chartContainerRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: chartContainerRef.current.offsetWidth,
      height: 160,
      selection: activeTool === "select",
      backgroundColor: "transparent",
    });

    fabricCanvasRef.current = canvas;

    // Cleanup
    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const syncWidth = () => {
      const width = container.offsetWidth;
      setChartWidth(width);
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.setDimensions({ width, height: chartHeight });
        fabricCanvasRef.current.renderAll();
      }
    };
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Handle tool changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === "pencil";
    canvas.selection = activeTool === "select";

    if (activeTool === "pencil") {
      const brush = new PencilBrush(canvas);
      brush.color = "hsl(var(--primary))";
      brush.width = 2;
      canvas.freeDrawingBrush = brush;
    }
  }, [activeTool]);

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (tool === "text") {
      const text = new Textbox("文本", {
        left: 100,
        top: 100,
        fontSize: 14,
        fill: "hsl(var(--primary))",
        width: 150,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      toast.success("文本已添加，可双击编辑");
    }
  };

  const handleCanvasMouseDown = (e: { e: Event }) => {
    if (activeTool === "select" || activeTool === "pencil") return;
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const pointer = canvas.getPointer(e.e);
    setStartPoint({ x: pointer.x, y: pointer.y });
    setIsDrawing(true);
  };

  const handleCanvasMouseMove = (e: { e: Event }) => {
    if (!isDrawing || !startPoint || activeTool === "select" || activeTool === "pencil") return;

    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const pointer = canvas.getPointer(e.e);
    
    // Remove temporary object if exists
    if (tempObjectRef.current) {
      canvas.remove(tempObjectRef.current);
      tempObjectRef.current = null;
    }

    let tempObject: FabricObject | null = null;

    if (activeTool === "line" || activeTool === "trendline") {
      tempObject = new FabricLine([startPoint.x, startPoint.y, pointer.x, pointer.y], {
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
        selectable: false,
      });
    } else if (activeTool === "hline") {
      tempObject = new FabricLine([0, startPoint.y, canvas.width || 0, startPoint.y], {
        stroke: "hsl(var(--primary))",
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
      });
    } else if (activeTool === "rect") {
      const width = pointer.x - startPoint.x;
      const height = pointer.y - startPoint.y;
      tempObject = new Rect({
        left: startPoint.x,
        top: startPoint.y,
        width: Math.abs(width),
        height: Math.abs(height),
        fill: "transparent",
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
        selectable: false,
      });
    }

    if (tempObject) {
      canvas.add(tempObject);
      tempObjectRef.current = tempObject;
      canvas.renderAll();
    }
  };

  const handleCanvasMouseUp = (e: { e: Event }) => {
    if (!isDrawing || !startPoint || activeTool === "select" || activeTool === "pencil") return;

    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const pointer = canvas.getPointer(e.e);

    // Remove temporary object
    if (tempObjectRef.current) {
      canvas.remove(tempObjectRef.current);
      tempObjectRef.current = null;
    }

    let finalObject: FabricObject | null = null;

    if (activeTool === "line" || activeTool === "trendline") {
      finalObject = new FabricLine([startPoint.x, startPoint.y, pointer.x, pointer.y], {
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
      });
    } else if (activeTool === "hline") {
      finalObject = new FabricLine([0, startPoint.y, canvas.width || 0, startPoint.y], {
        stroke: "hsl(var(--primary))",
        strokeWidth: 1,
        strokeDashArray: [5, 5],
      });
    } else if (activeTool === "rect") {
      const width = pointer.x - startPoint.x;
      const height = pointer.y - startPoint.y;
      finalObject = new Rect({
        left: startPoint.x,
        top: startPoint.y,
        width: Math.abs(width),
        height: Math.abs(height),
        fill: "transparent",
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
      });
    }

    if (finalObject) {
      canvas.add(finalObject);
      canvas.renderAll();
      toast.success("已添加绘图");
    }

    setIsDrawing(false);
    setStartPoint(null);
  };

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.on("mouse:down", handleCanvasMouseDown);
    canvas.on("mouse:move", handleCanvasMouseMove);
    canvas.on("mouse:up", handleCanvasMouseUp);

    return () => {
      canvas.off("mouse:down", handleCanvasMouseDown);
      canvas.off("mouse:move", handleCanvasMouseMove);
      canvas.off("mouse:up", handleCanvasMouseUp);
    };
  }, [activeTool, isDrawing, startPoint]);

  const handleClearDrawings = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    canvas.clear();
    canvas.backgroundColor = "transparent";
    canvas.renderAll();
    toast.success("已清除所有绘图");
  };

  return (
    <Card className="border-border/50 bg-card/95 backdrop-blur-sm overflow-hidden">
      <div className="p-4">
        {/* Toolbar and Controls */}
        <div className="flex items-center justify-between mb-4 gap-4">
          {/* Timeframe selector */}
          <div className="flex gap-1">
            {["1分", "5分", "15分", "1小时", "4小时", "天"].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  timeframe === tf
                    ? "bg-primary/20 text-primary"
                    : "bg-transparent text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Chart tools */}
          <div className="flex items-center gap-2">
            <button className="p-2 rounded hover:bg-muted/50 transition-colors">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
            <button className="p-2 rounded hover:bg-muted/50 transition-colors">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
            <button className="px-3 py-1.5 rounded bg-muted/50 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              BNB
            </button>
            <button className="p-2 rounded hover:bg-muted/50 transition-colors">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <button className="p-2 rounded hover:bg-muted/50 transition-colors">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
            <button className="p-2 rounded hover:bg-muted/50 transition-colors">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chart area with left toolbar */}
        <div className="flex gap-2">
          {/* Left toolbar */}
          <div className="flex flex-col gap-2 py-2">
            <button 
              onClick={() => handleToolClick("select")}
              className={`p-2 rounded transition-colors group ${
                activeTool === "select" ? "bg-primary/20" : "hover:bg-muted/50"
              }`}
              title="选择工具"
            >
              <svg className={`w-5 h-5 ${activeTool === "select" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </button>
            <button 
              onClick={() => handleToolClick("trendline")}
              className={`p-2 rounded transition-colors group ${
                activeTool === "trendline" ? "bg-primary/20" : "hover:bg-muted/50"
              }`}
              title="趋势线"
            >
              <svg className={`w-5 h-5 ${activeTool === "trendline" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21l18-18" />
              </svg>
            </button>
            <button 
              onClick={() => handleToolClick("hline")}
              className={`p-2 rounded transition-colors group ${
                activeTool === "hline" ? "bg-primary/20" : "hover:bg-muted/50"
              }`}
              title="水平线"
            >
              <svg className={`w-5 h-5 ${activeTool === "hline" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
              </svg>
            </button>
            <button 
              onClick={() => handleToolClick("line")}
              className={`p-2 rounded transition-colors group ${
                activeTool === "line" ? "bg-primary/20" : "hover:bg-muted/50"
              }`}
              title="直线"
            >
              <svg className={`w-5 h-5 ${activeTool === "line" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </button>
            <button 
              onClick={() => handleToolClick("rect")}
              className={`p-2 rounded transition-colors group ${
                activeTool === "rect" ? "bg-primary/20" : "hover:bg-muted/50"
              }`}
              title="矩形"
            >
              <svg className={`w-5 h-5 ${activeTool === "rect" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              </svg>
            </button>
            <button 
              onClick={() => handleToolClick("text")}
              className={`p-2 rounded transition-colors group ${
                activeTool === "text" ? "bg-primary/20" : "hover:bg-muted/50"
              }`}
              title="文本"
            >
              <svg className={`w-5 h-5 ${activeTool === "text" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button 
              onClick={() => handleToolClick("pencil")}
              className={`p-2 rounded transition-colors group ${
                activeTool === "pencil" ? "bg-primary/20" : "hover:bg-muted/50"
              }`}
              title="自由绘制"
            >
              <svg className={`w-5 h-5 ${activeTool === "pencil" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button 
              onClick={handleClearDrawings}
              className="p-2 rounded hover:bg-destructive/20 transition-colors group"
              title="清除绘图"
            >
              <svg className="w-5 h-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Main chart */}
          <div className="flex-1" ref={chartContainerRef}>
            {/* OHLC Data Display */}
            <div className="flex items-center gap-4 mb-2 text-sm">
              <span className="text-muted-foreground">K线</span>
              <span className="text-foreground font-medium">开={latestCandle?.open.toFixed(8) || "等待成交"}</span>
              <span className="text-destructive font-medium">高={latestCandle?.high.toFixed(8) || "等待成交"}</span>
              <span className="text-success font-medium">低={latestCandle?.low.toFixed(8) || "等待成交"}</span>
              <span className={latestCandle?.isUp ? "text-success font-medium" : "text-destructive font-medium"}>收={latestCandle?.close.toFixed(8) || "等待成交"}</span>
              <span className="text-foreground font-medium ml-auto">
                {latestCandle?.close.toFixed(8) || "真实 K 线等待链上 swap 记录"}
              </span>
            </div>

            <div
              className="relative"
              onMouseLeave={() => setHoveredCandle(null)}
              onMouseMove={(event) => {
                if (!klineData.length) return;
                const rect = event.currentTarget.getBoundingClientRect();
                const x = event.clientX - rect.left - chartPadding.left;
                const index = Math.max(0, Math.min(klineData.length - 1, Math.floor(x / candleStep)));
                setHoveredCandle(index);
              }}
            >
              {/* Price K-line Chart */}
              <svg
                width="100%"
                height={chartHeight}
                viewBox={`0 0 ${Math.max(chartWidth, 1)} ${chartHeight}`}
                className="block rounded bg-background/20"
              >
                {hasKlineData ? gridLines.map((line) => (
                  <g key={line.y}>
                    <line
                      x1={chartPadding.left}
                      x2={Math.max(chartWidth - chartPadding.right, chartPadding.left)}
                      y1={line.y}
                      y2={line.y}
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      opacity="0.28"
                    />
                    <text
                      x={Math.max(chartWidth - chartPadding.right + 8, chartPadding.left + 8)}
                      y={line.y + 4}
                      fill="hsl(var(--muted-foreground))"
                      fontSize="10"
                    >
                      {line.value.toFixed(7)}
                    </text>
                  </g>
                )) : (
                  <text
                    x={Math.max(chartWidth / 2, 120)}
                    y={chartHeight / 2}
                    textAnchor="middle"
                    fill="hsl(var(--muted-foreground))"
                    fontSize="13"
                  >
                    暂无真实成交 K 线，等待 PancakeSwap 交易记录同步
                  </text>
                )}

                {klineData.map((candle, index) => {
                  const x = candleX(index);
                  const openY = priceToY(candle.open);
                  const closeY = priceToY(candle.close);
                  const highY = priceToY(candle.high);
                  const lowY = priceToY(candle.low);
                  const bodyTop = Math.min(openY, closeY);
                  const bodyHeight = Math.max(1, Math.abs(closeY - openY));
                  const color = candle.isUp ? "hsl(var(--success))" : "hsl(var(--destructive))";
                  return (
                    <g key={`${candle.time}-${index}`}>
                      <line
                        x1={x}
                        x2={x}
                        y1={highY}
                        y2={lowY}
                        stroke={color}
                        strokeWidth="1"
                      />
                      <rect
                        x={x - candleBodyWidth / 2}
                        y={bodyTop}
                        width={candleBodyWidth}
                        height={bodyHeight}
                        rx="1"
                        fill={candle.isUp ? "transparent" : color}
                        stroke={color}
                        strokeWidth="1"
                      />
                    </g>
                  );
                })}

                {hoveredCandle !== null && klineData[hoveredCandle] && (
                  <g>
                    <line
                      x1={candleX(hoveredCandle)}
                      x2={candleX(hoveredCandle)}
                      y1={chartPadding.top}
                      y2={chartHeight - chartPadding.bottom}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      opacity="0.45"
                    />
                    <line
                      x1={chartPadding.left}
                      x2={Math.max(chartWidth - chartPadding.right, chartPadding.left)}
                      y1={priceToY(klineData[hoveredCandle].close)}
                      y2={priceToY(klineData[hoveredCandle].close)}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      opacity="0.45"
                    />
                  </g>
                )}
              </svg>

              {hoveredCandle !== null && klineData[hoveredCandle] && (
                <div className="pointer-events-none absolute left-3 top-3 rounded border border-border/60 bg-card/95 p-3 text-xs shadow-elegant backdrop-blur-sm">
                  <div className="mb-1 font-medium text-foreground">{klineData[hoveredCandle].time}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <span className="text-muted-foreground">开</span>
                    <span className="text-right text-foreground">{klineData[hoveredCandle].open.toFixed(8)}</span>
                    <span className="text-muted-foreground">高</span>
                    <span className="text-right text-destructive">{klineData[hoveredCandle].high.toFixed(8)}</span>
                    <span className="text-muted-foreground">低</span>
                    <span className="text-right text-success">{klineData[hoveredCandle].low.toFixed(8)}</span>
                    <span className="text-muted-foreground">收</span>
                    <span className={`text-right ${klineData[hoveredCandle].isUp ? "text-success" : "text-destructive"}`}>
                      {klineData[hoveredCandle].close.toFixed(8)}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Drawing Canvas Overlay */}
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 pointer-events-auto"
                style={{ 
                  cursor: activeTool === "select" ? "default" : "crosshair"
                }}
              />
            </div>

            {/* Volume Chart */}
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={priceData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="hsl(var(--border))" 
                    opacity={0.1}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: "11px" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    orientation="right"
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: "10px" }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<VolumeTooltip />} />
                  <Bar
                    dataKey="volume"
                    fill="hsl(var(--primary))"
                    opacity={0.6}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TokenChart;
