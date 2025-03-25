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

// Function to get the score color class based on the score value (0-100)
export function getScoreColorClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-gray-300";
  
  // New score threshold system (0-100 scale)
  if (score >= 85) {
    return "bg-score-excellent"; // Excellent - Dark Green
  } else if (score >= 75) {
    return "bg-score-good"; // Good - Light Green
  } else if (score >= 65) {
    return "bg-score-fair"; // Fair/Somewhat poor - Yellow/Orange
  } else {
    return "bg-score-poor"; // Very poor - Red
  }
}

// Get the score color text class
export function getScoreTextColorClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-gray-500";
  
  // New score threshold system (0-100 scale)
  if (score >= 85) {
    return "text-score-excellent"; // Excellent - Dark Green
  } else if (score >= 75) {
    return "text-score-good"; // Good - Light Green
  } else if (score >= 65) {
    return "text-score-fair"; // Fair - Yellow/Orange
  } else {
    return "text-score-poor"; // Very poor - Red
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
  weights?: { doable: number, usability: number, visuals: number }
): number | null {
  if (!evaluation) return null;
  
  // Default weights based on requirements (as percentages)
  // Doable: 43.75%, Usability: 37.5%, Visuals: 18.75%
  const defaultWeights = {
    doable: 43.75,
    usability: 37.5,
    visuals: 18.75
  };
  
  // Use provided weights or defaults
  const useWeights = weights || defaultWeights;
  
  // Ensure we have values to calculate with
  if (evaluation.doable === undefined || evaluation.doable === null) {
    return null;
  }
  
  let score = 0;
  let maxPossibleScore = 100; // Scale to percentage (0-100)
  
  // Doable is binary - full score (43.75%) or zero
  // Yes = 43.75%/43.75% of task score, No = 0%/43.75% of task score
  score += (evaluation.doable ? useWeights.doable : 0);
  
  // Usability & Interaction: 37.5% of task score, scaled between 1-4
  if (evaluation.usabilityScore !== undefined && evaluation.usabilityScore !== null) {
    // Convert 1-4 scale to percentage of the 37.5% weight
    score += (evaluation.usabilityScore / 4) * useWeights.usability;
  } else {
    maxPossibleScore -= useWeights.usability;
  }
  
  // Visuals: 18.75% of task score, scaled between 1-4
  if (evaluation.visualsScore !== undefined && evaluation.visualsScore !== null) {
    // Convert 1-4 scale to percentage of the 18.75% weight
    score += (evaluation.visualsScore / 4) * useWeights.visuals;
  } else {
    maxPossibleScore -= useWeights.visuals;
  }
  
  // If we can't calculate a meaningful score, return null
  if (maxPossibleScore === 0) return null;
  
  // Return score as a percentage (0-100)
  return parseFloat((score).toFixed(1));
}

// Calculate category evaluation score based on weights
export function calculateCategoryScore(
  taskAvgScore: number | null,
  categoryEval: Partial<CategoryEvaluation> | null,
  weights?: { 
    tasks: number, 
    responsiveness: number, 
    writing: number, 
    emotional: number 
  }
): number | null {
  if (!categoryEval && taskAvgScore === null) return null;
  
  // Default weights based on requirements (as percentages)
  // Tasks: 80%, Responsiveness: 15%, Writing: 5%, Emotional: 5% (bonus)
  const defaultWeights = {
    tasks: 80,
    responsiveness: 15,
    writing: 5,
    emotional: 5 // Bonus
  };
  
  // Use provided weights or defaults
  const useWeights = weights || defaultWeights;
  
  let score = 0;
  let maxPossibleScore = 100; // Scale to percentage (0-100)
  
  // Average of all task scores (80% of overall score)
  if (taskAvgScore !== null) {
    // Convert task score (0-100) to percentage of 80% weight
    score += taskAvgScore * (useWeights.tasks / 100);
  } else {
    maxPossibleScore -= useWeights.tasks;
  }
  
  // System Feedback & Responsiveness (15% of overall score)
  if (categoryEval?.responsivenessScore !== undefined && categoryEval.responsivenessScore !== null) {
    // Convert 1-4 scale to percentage of 15% weight
    score += (categoryEval.responsivenessScore / 4) * useWeights.responsiveness;
  } else {
    maxPossibleScore -= useWeights.responsiveness;
  }
  
  // Writing (5% of overall score)
  if (categoryEval?.writingScore !== undefined && categoryEval.writingScore !== null) {
    // Convert 1-4 scale to percentage of 5% weight
    score += (categoryEval.writingScore / 4) * useWeights.writing;
  } else {
    maxPossibleScore -= useWeights.writing;
  }
  
  // If we can't calculate a meaningful score, return null
  if (maxPossibleScore === 0) return null;
  
  // Emotional score is a bonus (5% overall score)
  // Only add this if it exists, but don't reduce maxPossibleScore if missing
  if (categoryEval?.emotionalScore !== undefined && categoryEval.emotionalScore !== null) {
    // Convert 1-4 scale to percentage of 5% weight
    score += (categoryEval.emotionalScore / 4) * useWeights.emotional;
  }
  
  // Return score as a percentage (0-100)
  return parseFloat(score.toFixed(1));
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
