import { calculateTaskScore, calculateCategoryScore, calculateOverallScore } from '../../client/src/lib/utils';
import { TaskEvaluation } from '../../shared/schema';

describe('Scoring Calculation Tests', () => {
  describe('Task Score Calculation', () => {
    it('should calculate task score correctly for a completely doable task', () => {
      const evaluation = {
        isDoable: true,
        usabilityRating: 80,
        interactionRating: 70,
        visualsRating: 90
      } as TaskEvaluation;

      const scoringConfig = {
        taskDoableWeight: 43.75,
        taskUsabilityWeight: 37.5 / 2,
        taskInteractionWeight: 37.5 / 2,
        taskVisualsWeight: 18.75
      };

      const score = calculateTaskScore(evaluation, scoringConfig);
      
      // Doable (100%) * 43.75 + Usability (80%) * 18.75 + Interaction (70%) * 18.75 + Visuals (90%) * 18.75
      // = 43.75 + 15 + 13.125 + 16.875 = 88.75
      expect(score).toBeCloseTo(88.75, 1);
    });

    it('should calculate task score correctly for a non-doable task', () => {
      const evaluation = {
        isDoable: false,
        usabilityRating: 80,
        interactionRating: 70,
        visualsRating: 90
      } as TaskEvaluation;

      const scoringConfig = {
        taskDoableWeight: 43.75,
        taskUsabilityWeight: 37.5 / 2,
        taskInteractionWeight: 37.5 / 2,
        taskVisualsWeight: 18.75
      };

      const score = calculateTaskScore(evaluation, scoringConfig);
      
      // Doable (0%) * 43.75 + Usability (80%) * 18.75 + Interaction (70%) * 18.75 + Visuals (90%) * 18.75
      // = 0 + 15 + 13.125 + 16.875 = 45
      expect(score).toBeCloseTo(45, 1);
    });

    it('should handle null or undefined ratings by treating them as 0', () => {
      const evaluation = {
        isDoable: true,
        usabilityRating: null as any,
        interactionRating: undefined as any,
        visualsRating: 90
      } as TaskEvaluation;

      const scoringConfig = {
        taskDoableWeight: 43.75,
        taskUsabilityWeight: 37.5 / 2,
        taskInteractionWeight: 37.5 / 2,
        taskVisualsWeight: 18.75
      };

      const score = calculateTaskScore(evaluation, scoringConfig);
      
      // Doable (100%) * 43.75 + Usability (0%) * 18.75 + Interaction (0%) * 18.75 + Visuals (90%) * 18.75
      // = 43.75 + 0 + 0 + 16.875 = 60.625
      expect(score).toBeCloseTo(60.63, 1);
    });
  });

  describe('Category Score Calculation', () => {
    it('should calculate category score based on task scores', () => {
      const taskScores = [90, 80, 70];
      
      const score = calculateCategoryScore(taskScores);
      
      // Average of task scores: (90 + 80 + 70) / 3 = 80
      expect(score).toBe(80);
    });

    it('should return 0 for empty task scores array', () => {
      const taskScores: number[] = [];
      
      const score = calculateCategoryScore(taskScores);
      
      expect(score).toBe(0);
    });
  });

  describe('Overall Score Calculation', () => {
    it('should calculate overall score based on category scores and weights', () => {
      const categoryScores = [
        { categoryId: 1, score: 90 },
        { categoryId: 2, score: 80 },
        { categoryId: 3, score: 70 }
      ];
      
      const categoryWeights = [
        { categoryId: 1, weight: 50 },
        { categoryId: 2, weight: 30 },
        { categoryId: 3, weight: 20 }
      ];
      
      const score = calculateOverallScore(categoryScores, categoryWeights);
      
      // Weighted average: (90 * 0.5) + (80 * 0.3) + (70 * 0.2) = 45 + 24 + 14 = 83
      expect(score).toBe(83);
    });

    it('should use equal weights if no weights are provided', () => {
      const categoryScores = [
        { categoryId: 1, score: 90 },
        { categoryId: 2, score: 80 },
        { categoryId: 3, score: 70 }
      ];
      
      const score = calculateOverallScore(categoryScores);
      
      // Simple average: (90 + 80 + 70) / 3 = 80
      expect(score).toBe(80);
    });

    it('should return 0 for empty category scores array', () => {
      const categoryScores: Array<{ categoryId: number, score: number }> = [];
      
      const score = calculateOverallScore(categoryScores);
      
      expect(score).toBe(0);
    });
  });
});