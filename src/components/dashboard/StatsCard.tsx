import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isUp: boolean;
  };
  className?: string;
  iconColor?: string;
}

export const StatsCard = ({
  title,
  value,
  icon: Icon,
  trend,
  className,
  iconColor = "text-blue-400"
}: StatsCardProps) => {
  return (
    <div className={cn("bg-[#151921] border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all", className)}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
          
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                trend.isUp ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
              )}>
                {trend.isUp ? "+" : "-"}{trend.value}
              </span>
              <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">vs last month</span>
            </div>
          )}
        </div>
        
        <div className={cn("p-3 rounded-xl bg-slate-900/50 border border-slate-800", iconColor)}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
};