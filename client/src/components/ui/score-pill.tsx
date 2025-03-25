import { cn, getScoreColorClass } from "@/lib/utils";

interface ScorePillProps {
  score: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
  showEmpty?: boolean;
}

export function ScorePill({ 
  score, 
  className, 
  size = "md", 
  showEmpty = true 
}: ScorePillProps) {
  // Don't render if no score and showEmpty is false
  if (score === null && !showEmpty) {
    return null;
  }
  
  // Determine size classes
  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 text-lg font-bold"
  };
  
  // Get color based on score
  const colorClass = getScoreColorClass(score);
  
  return (
    <div 
      className={cn(
        "rounded-full flex items-center justify-center text-white",
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      {score !== null ? score.toFixed(1) : "—"}
    </div>
  );
}
