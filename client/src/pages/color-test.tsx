import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScorePill } from "@/components/ui/score-pill";
import { getScoreColorClass, getScoreTextColorClass } from "@/lib/utils";

export default function ColorTestPage() {
  const scores = [1, 2, 3, 4];
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Score Color Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Score Pills</CardTitle>
            <CardDescription>Testing the score pill component with different scores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              {scores.map((score) => (
                <ScorePill key={score} score={score} size="lg" />
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Background Colors</CardTitle>
            <CardDescription>Testing the score background colors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {scores.map((score) => (
                <div 
                  key={score}
                  className={`${getScoreColorClass(score)} h-20 rounded-md flex items-center justify-center text-white font-bold`}
                >
                  Score: {score.toFixed(1)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Text Colors</CardTitle>
            <CardDescription>Testing the score text colors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {scores.map((score) => (
                <div 
                  key={score}
                  className={`${getScoreTextColorClass(score)} h-20 bg-gray-100 rounded-md flex items-center justify-center font-bold text-xl`}
                >
                  Score: {score.toFixed(1)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Color Reference</CardTitle>
            <CardDescription>Direct color class reference</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-score-poor h-12 rounded-md flex items-center justify-center text-white">Score Poor</div>
              <div className="bg-score-fair h-12 rounded-md flex items-center justify-center text-white">Score Fair</div>
              <div className="bg-score-good h-12 rounded-md flex items-center justify-center text-white">Score Good</div>
              <div className="bg-score-excellent h-12 rounded-md flex items-center justify-center text-white">Score Excellent</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}