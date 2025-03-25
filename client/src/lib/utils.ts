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
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Format: "Mar 24 - Mar 30, 2025"
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
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
  
  // Use the exact weights provided by the user:
  // Doable (Yes or No). Yes = 43.75%/43.75% of task score, No = 0%/43.75% of task score
  // Usability & Interaction. 37.5% of overall score. Scaled between 1-4
  // Visuals. 18.75% of overall score. Scaled between 1-4
  
  let score = 0;
  let totalPossibleScore = 0;
  
  // Doable is binary - full score or zero (43.75% of overall score)
  if (evaluation.doable !== undefined && evaluation.doable !== null) {
    const doableValue = evaluation.doable ? weights.doable : 0;
    score += doableValue;
    totalPossibleScore += weights.doable;
  }
  
  // Usability (37.5% of overall score)
  if (evaluation.usabilityScore !== undefined && evaluation.usabilityScore !== null) {
    // Convert the 1-4 score to a percentage of the total possible usability points
    const usabilityValue = (evaluation.usabilityScore / 4) * weights.usability;
    score += usabilityValue;
    totalPossibleScore += weights.usability;
  }
  
  // Visuals (18.75% of overall score)
  if (evaluation.visualsScore !== undefined && evaluation.visualsScore !== null) {
    // Convert the 1-4 score to a percentage of the total possible visuals points
    const visualsValue = (evaluation.visualsScore / 4) * weights.visuals;
    score += visualsValue;
    totalPossibleScore += weights.visuals;
  }
  
  // If no scores were provided, return null
  if (totalPossibleScore === 0) return null;
  
  // Calculate the final score as a value between 0-4
  const percentageScore = score / totalPossibleScore;
  return percentageScore * 4;
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
  
  // Use the exact weights provided by the user:
  // Task scores average: 80% of overall CUJ category score
  // System Feedback & Responsiveness: 15% of overall score. Scaled between 1-4
  // Writing: 5% of overall score. Scaled between 1-4
  // Emotional: 5% bonus (can increase score beyond 4). Scaled between 1-4
  
  let score = 0;
  let totalPossibleScore = 0;
  
  // Task average (80% of overall score)
  if (taskAvgScore !== null) {
    // Task scores are already on a 0-4 scale
    score += (taskAvgScore / 4) * weights.tasks;
    totalPossibleScore += weights.tasks;
  }
  
  // Responsiveness (15% of overall score)
  if (categoryEval?.responsivenessScore !== undefined && categoryEval.responsivenessScore !== null) {
    score += (categoryEval.responsivenessScore / 4) * weights.responsiveness;
    totalPossibleScore += weights.responsiveness;
  }
  
  // Writing (5% of overall score)
  if (categoryEval?.writingScore !== undefined && categoryEval.writingScore !== null) {
    score += (categoryEval.writingScore / 4) * weights.writing;
    totalPossibleScore += weights.writing;
  }
  
  // If no scores were provided, return null
  if (totalPossibleScore === 0) return null;
  
  // Calculate base score as a percentage of total possible score, then scale to 0-4
  const baseScorePercent = score / totalPossibleScore;
  let finalScore = baseScorePercent * 4;
  
  // Apply emotional bonus (never decreases score, can increase beyond 4.0)
  if (categoryEval?.emotionalScore !== undefined && categoryEval.emotionalScore !== null) {
    // This is a direct bonus percentage that can push score above 4.0
    const emotionalBonusPercent = (categoryEval.emotionalScore / 4) * (weights.emotional / 100);
    finalScore += emotionalBonusPercent * 4;
  }
  
  return finalScore;
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
