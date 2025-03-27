import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  TaskEvaluation, 
  CategoryEvaluation, 
  scoringScaleDescriptions,
  TaskEvaluationWithTask,
  CategoryEvaluationWithCategory,
  ReportWithReview,
  ReviewWithDetails,
  TaskWithCategory,
  CujCategory,
  Task
} from "@shared/schema";
import FileSaver from 'file-saver';

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

// Export review data to CSV
export function exportReviewToCSV(
  review: ReviewWithDetails, 
  taskEvaluations: TaskEvaluationWithTask[], 
  categoryEvaluations: CategoryEvaluationWithCategory[]
): void {
  // Format headers
  const headers = [
    'Category',
    'CUJ',
    'Task',
    'Completed',
    'Task Doable',
    'Usability Score',
    'Visuals Score',
    'Task Score',
    'Task Feedback'
  ];

  // Group tasks by category for easier processing
  const categoriesMap: Record<number, { 
    category: CujCategory, 
    tasks: TaskEvaluationWithTask[] 
  }> = {};

  // Organize task evaluations by category
  taskEvaluations.forEach(taskEval => {
    const categoryId = taskEval.task.cuj.categoryId;
    
    if (!categoriesMap[categoryId]) {
      categoriesMap[categoryId] = {
        category: taskEval.task.cuj.category,
        tasks: []
      };
    }
    
    categoriesMap[categoryId].tasks.push(taskEval);
  });

  // Get all evaluation data rows
  const rows: string[][] = [];

  // Process each category and its tasks
  Object.values(categoriesMap).forEach(({ category, tasks }) => {
    // Find category evaluation
    const categoryEval = categoryEvaluations.find(c => c.categoryId === category.id);
    
    // Add category level information
    if (categoryEval) {
      rows.push([
        `${category.name}`,
        'Category Evaluation',
        'Overall Assessment',
        'Yes',
        'N/A',
        `Responsiveness: ${categoryEval.responsivenessScore}/4`,
        `Writing: ${categoryEval.writingScore}/4`,
        `Emotional: ${categoryEval.emotionalScore}/4`,
        categoryEval.responsivenessScore !== null && categoryEval.responsivenessScore <= 2 ? categoryEval.responsivenessFeedback || 'No feedback' : 'N/A'
      ]);
    }
    
    // Add all tasks for this category
    tasks.forEach(taskEval => {
      const taskScore = calculateTaskScore(taskEval);
      
      rows.push([
        category.name,
        taskEval.task.cuj.name,
        taskEval.task.name,
        'Yes',
        taskEval.doable ? 'Yes' : 'No',
        `${taskEval.usabilityScore}/4`,
        `${taskEval.visualsScore}/4`,
        taskScore ? formatScore(taskScore) : 'N/A',
        taskEval.usabilityScore && taskEval.usabilityScore <= 2 ? 
          taskEval.usabilityFeedback || 'No feedback' : 'N/A'
      ]);
    });
  });

  // Convert to CSV format
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => 
        // Escape quotes and wrap in quotes to handle commas in content
        `"${String(cell).replace(/"/g, '""')}"`
      ).join(',')
    )
  ].join('\n');

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  FileSaver.saveAs(blob, `${review.car.make}_${review.car.model}_Review_${new Date().toISOString().split('T')[0]}.csv`);
}

// Generate Google Docs export with data
export function generateGoogleDocsExport(
  report: ReportWithReview,
  taskEvaluations: TaskEvaluationWithTask[],
  categoryEvaluations: CategoryEvaluationWithCategory[]
): string {
  // Base Google Docs template URL
  const baseUrl = 'https://docs.google.com/document/create';
  
  // Create a title for the document
  const title = `${report.review.car.make} ${report.review.car.model} (${report.review.car.year}) Evaluation Report`;
  
  // Calculate overall averages for tasks
  let totalTaskScore = 0;
  let taskCount = 0;
  
  taskEvaluations.forEach(taskEval => {
    const score = calculateTaskScore(taskEval);
    if (score !== null) {
      totalTaskScore += score;
      taskCount++;
    }
  });
  
  const avgTaskScore = taskCount > 0 ? totalTaskScore / taskCount : 0;
  
  // Create a structured document content using markdown formatting
  // This will display nicely in Google Docs without requiring docx generation
  const sections = [];
  
  // Title and header
  sections.push(`# ${title}`);
  sections.push(`_Evaluation Date: ${formatDateTime(report.review.updatedAt || report.review.createdAt)}_`);
  sections.push(`_Reviewer: ${report.review.reviewer.name}_`);
  sections.push('');
  
  // Vehicle information
  sections.push('## Vehicle Information');
  sections.push('| Property | Value |');
  sections.push('|----------|-------|');
  sections.push(`| Make | ${report.review.car.make} |`);
  sections.push(`| Model | ${report.review.car.model} |`);
  sections.push(`| Year | ${report.review.car.year} |`);
  sections.push(`| Android Version | ${report.review.car.androidVersion || 'N/A'} |`);
  sections.push(`| Build Fingerprint | ${report.review.car.buildFingerprint || 'N/A'} |`);
  sections.push('');
  
  // Summary section
  sections.push('## Summary');
  sections.push(`Overall Score: **${formatScore(avgTaskScore)}/100**`);
  sections.push(`Total Tasks Evaluated: ${taskCount}`);
  sections.push(`Category Evaluations: ${categoryEvaluations.length}`);
  sections.push('');
  
  // Category scores table
  sections.push('## Category Scores');
  sections.push('| Category | Responsiveness | Writing | Emotional | Score |');
  sections.push('|----------|----------------|---------|-----------|-------|');
  
  categoryEvaluations.forEach(catEval => {
    const categoryName = catEval.category?.name || 'Unknown';
    const responsivenessScore = catEval.responsivenessScore || 'N/A';
    const writingScore = catEval.writingScore || 'N/A';
    const emotionalScore = catEval.emotionalScore || 'N/A';
    
    // Calculate category score
    const categoryScore = calculateCategoryScore(null, catEval);
    const scoreDisplay = categoryScore !== null ? formatScore(categoryScore) : 'N/A';
    
    sections.push(`| ${categoryName} | ${responsivenessScore}/4 | ${writingScore}/4 | ${emotionalScore}/4 | ${scoreDisplay} |`);
  });
  
  sections.push('');
  
  // Task evaluations (limited to reduce size)
  if (taskEvaluations.length > 0) {
    sections.push('## Task Evaluations');
    sections.push('_Sample of tasks (limited to 10 tasks)_');
    sections.push('');
    sections.push('| Task | Category | Doable | Usability | Visuals | Score |');
    sections.push('|------|----------|--------|-----------|---------|-------|');
    
    // Show up to 10 tasks to avoid making the document too large
    taskEvaluations.slice(0, 10).forEach(taskEval => {
      const taskScore = calculateTaskScore(taskEval);
      const scoreFormatted = taskScore !== null ? formatScore(taskScore) : 'N/A';
      const categoryName = taskEval.task.cuj?.category?.name || 'Unknown';
      
      sections.push(`| ${taskEval.task.name} | ${categoryName} | ${taskEval.doable ? 'Yes' : 'No'} | ${taskEval.usabilityScore}/4 | ${taskEval.visualsScore}/4 | ${scoreFormatted} |`);
    });
    
    if (taskEvaluations.length > 10) {
      sections.push(`_...and ${taskEvaluations.length - 10} more tasks..._`);
    }
    
    sections.push('');
  }
  
  // Note about CSV export
  sections.push('## Note');
  sections.push('This is a simplified preview of the evaluation report. A CSV file has been downloaded to your device.');
  sections.push('For a complete detailed view with all data, please import the CSV file into a spreadsheet application.');
  
  // Join all sections with newlines
  const docContent = sections.join('\n');
  
  // Encode the content for URL
  const encodedContent = encodeURIComponent(docContent);
  
  // Return the Google Docs URL
  return `${baseUrl}?title=${encodeURIComponent(title)}&body=${encodedContent}`;
}

// No longer need the document helper functions since we're using markdown format

// Export review data to Google Spreadsheet format
export function exportReviewToGoogleSheets(
  review: ReviewWithDetails,
  taskEvaluations: TaskEvaluationWithTask[],
  categoryEvaluations: CategoryEvaluationWithCategory[]
): string {
  // First, create and download the CSV file for the user
  exportReviewToCSV(review, taskEvaluations, categoryEvaluations);
  
  // Create a more descriptive query string to pass to Google Sheets
  const title = `${review.car.make} ${review.car.model} (${review.car.year}) Evaluation`;
  
  // Create a simplified content to show in a single sheet
  // This generates just enough data to start, and user can import the CSV for the full dataset
  
  // Format data for simple spreadsheet
  const headers = ["Category", "Task", "Score", "Feedback"];
  
  // Group tasks by category for display
  const categoriesMap: Record<number, { 
    category: CujCategory, 
    tasks: TaskEvaluationWithTask[] 
  }> = {};
  
  // Organize task evaluations by category
  taskEvaluations.forEach(taskEval => {
    if (taskEval.task.cuj && taskEval.task.cuj.categoryId) {
      const categoryId = taskEval.task.cuj.categoryId;
      
      if (!categoriesMap[categoryId]) {
        categoriesMap[categoryId] = {
          category: taskEval.task.cuj.category,
          tasks: []
        };
      }
      
      categoriesMap[categoryId].tasks.push(taskEval);
    }
  });
  
  // Build spreadsheet base URL
  const sheetsUrl = 'https://docs.google.com/spreadsheets/create';
  
  // Return the URL to create a new pre-filled Google Sheet
  return `${sheetsUrl}?title=${encodeURIComponent(title)}`;
}
