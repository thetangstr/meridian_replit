import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  TaskEvaluation, 
  CategoryEvaluation, 
  scoringScaleDescriptions 
} from "@shared/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Function to get the score color class based on the score value (1-4)
export function getScoreColorClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-gray-300";
  
  switch (Math.round(score)) {
    case 1:
      return "bg-score-poor"; // Very poor - Red
    case 2:
      return "bg-score-fair"; // Fair/Somewhat poor - Yellow/Orange
    case 3:
      return "bg-score-good"; // Good - Light Green
    case 4:
      return "bg-score-excellent"; // Excellent - Dark Green
    default:
      return "bg-gray-300"; // Default for invalid scores
  }
}

// Get the score color text class
export function getScoreTextColorClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-gray-500";
  
  switch (Math.round(score)) {
    case 1:
      return "text-score-poor"; // Very poor - Red
    case 2:
      return "text-score-fair"; // Fair - Yellow/Orange
    case 3:
      return "text-score-good"; // Good - Light Green
    case 4:
      return "text-score-excellent"; // Excellent - Dark Green
    default:
      return "text-gray-500"; // Default for invalid scores
  }
}

// Format date range for display
export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  const end = new Date(endDate);
  
  // Now just show "Due Mar 30, 2025" instead of date range
  return `Due ${formatShortDate(end)}`;
}

// Format short date
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getMonth() === new Date().getMonth() ? undefined : 'numeric',
  }).format(date);
}

// Format date with time
export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

// Convert numerical score to label (for internal display)
export function getScoreLabel(score: number | null | undefined, type: keyof typeof scoringScaleDescriptions): string {
  if (score === null || score === undefined) return "Not rated";
  
  const roundedScore = Math.round(score) as 1 | 2 | 3 | 4;
  return scoringScaleDescriptions[type]?.[roundedScore]?.label || "Invalid score";
}

// Convert numerical score to description
export function getScoreDescription(score: number | null | undefined, type: keyof typeof scoringScaleDescriptions): string {
  if (score === null || score === undefined) return "";
  
  const roundedScore = Math.round(score) as 1 | 2 | 3 | 4;
  return scoringScaleDescriptions[type]?.[roundedScore]?.description || "";
}

// Calculate task evaluation score based on weights
export function calculateTaskScore(
  evaluation: Partial<TaskEvaluation> | null,
  weights: { doable: number, usability: number, visuals: number }
): number | null {
  if (!evaluation) return null;
  
  // Normalize weights to ensure they sum to 100%
  const totalWeight = weights.doable + weights.usability + weights.visuals;
  const normalizedWeights = {
    doable: weights.doable / totalWeight,
    usability: weights.usability / totalWeight,
    visuals: weights.visuals / totalWeight
  };
  
  let score = 0;
  let weightSum = 0;
  
  // Doable is binary - full score or zero
  if (evaluation.doable !== undefined && evaluation.doable !== null) {
    score += (evaluation.doable ? 1 : 0) * normalizedWeights.doable * 4; // Scale to 0-4
    weightSum += normalizedWeights.doable;
  }
  
  if (evaluation.usabilityScore !== undefined && evaluation.usabilityScore !== null) {
    score += evaluation.usabilityScore * normalizedWeights.usability;
    weightSum += normalizedWeights.usability;
  }
  
  if (evaluation.visualsScore !== undefined && evaluation.visualsScore !== null) {
    score += evaluation.visualsScore * normalizedWeights.visuals;
    weightSum += normalizedWeights.visuals;
  }
  
  // If no scores were provided, return null
  if (weightSum === 0) return null;
  
  // Normalize based on weights that were actually used
  return score / weightSum;
}

// Calculate category evaluation score based on weights
export function calculateCategoryScore(
  taskAvgScore: number | null,
  categoryEval: Partial<CategoryEvaluation> | null,
  weights: { 
    tasks: number, 
    responsiveness: number, 
    writing: number, 
    emotional: number 
  }
): number | null {
  if (!categoryEval && taskAvgScore === null) return null;
  
  // Normalize weights to ensure they sum to 100% (excluding emotional bonus)
  const baseWeightSum = weights.tasks + weights.responsiveness + weights.writing;
  const normalizedWeights = {
    tasks: weights.tasks / baseWeightSum,
    responsiveness: weights.responsiveness / baseWeightSum,
    writing: weights.writing / baseWeightSum,
    // Emotional is a bonus - not normalized
    emotional: weights.emotional / 100
  };
  
  let score = 0;
  let weightSum = 0;
  
  // Task average
  if (taskAvgScore !== null) {
    score += taskAvgScore * normalizedWeights.tasks;
    weightSum += normalizedWeights.tasks;
  }
  
  // Responsiveness
  if (categoryEval?.responsivenessScore !== undefined && categoryEval.responsivenessScore !== null) {
    score += categoryEval.responsivenessScore * normalizedWeights.responsiveness;
    weightSum += normalizedWeights.responsiveness;
  }
  
  // Writing
  if (categoryEval?.writingScore !== undefined && categoryEval.writingScore !== null) {
    score += categoryEval.writingScore * normalizedWeights.writing;
    weightSum += normalizedWeights.writing;
  }
  
  // If no scores were provided, return null
  if (weightSum === 0) return null;
  
  // Calculate base score normalized by weights used
  const baseScore = score / weightSum;
  
  // Apply emotional bonus (never decreases score)
  if (categoryEval?.emotionalScore !== undefined && categoryEval.emotionalScore !== null) {
    const emotionalBonus = (categoryEval.emotionalScore / 4) * normalizedWeights.emotional * 4;
    return baseScore + emotionalBonus;
  }
  
  return baseScore;
}

// Format a score as a fixed decimal
export function formatScore(score: number | null | undefined, decimalPlaces: number = 1): string {
  if (score === null || score === undefined) return "N/A";
  return score.toFixed(decimalPlaces);
}

// Get user initials from name
export function getUserInitials(name: string): string {
  if (!name) return "?";
  
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}
