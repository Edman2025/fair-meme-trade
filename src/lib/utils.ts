import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 格式化代币价格：小数点后4个或更多0使用下标格式
export function formatTokenPrice(price: number): string {
  if (price >= 1) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }
  
  const priceStr = price.toString();
  const match = priceStr.match(/^0\.(0+)([1-9]\d*)/);
  
  if (match) {
    const zeros = match[1].length;
    if (zeros >= 4) {
      const significantDigits = match[2].slice(0, 4);
      const subscriptZeros = zeros.toString().split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[parseInt(d)]).join('');
      return `0.0${subscriptZeros}${significantDigits}`;
    }
  }
  
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

// 格式化数量：超过1000用K，超过100万用M
export function formatAmount(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]/g, '')) : amount;
  
  if (isNaN(num)) return amount.toString();
  
  if (num >= 1000000) {
    const formatted = (num / 1000000).toFixed(2);
    return `${formatted.replace(/\.?0+$/, '')}M`;
  }
  
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(2);
    return `${formatted.replace(/\.?0+$/, '')}K`;
  }
  
  if (num >= 1) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  return num.toFixed(3);
}
