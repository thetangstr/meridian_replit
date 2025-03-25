import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Share } from "lucide-react";
import { ScorePill } from "@/components/ui/score-pill";
import { useAuth } from "@/lib/auth";
import { canAccessInternalReports } from "@/lib/auth";
import { 
  ReportWithReview, 
  CujCategory 
} from "@shared/schema";
import { formatDateTime } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export default function ReportView() {
  const params = useParams();
  const reportId = Number(params.id);
  const [_, setLocation] = useLocation();
  const { user } = useAuth();
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  
  // Fetch report with review details
  const { data: report, isLoading } = useQuery<ReportWithReview>({
    queryKey: [`/api/reports/${reportId}`],
  });
  
  // Toggle category expansion
  const toggleCategoryExpand = (categoryId: number) => {
    setExpandedCategory(current => current === categoryId ? null : categoryId);
  };
  
  // Export report as PDF
  const handleExportReport = () => {
    // In a real implementation, this would generate and download a PDF
    alert("PDF export functionality would be implemented here");
  };
  
  // Share report
  const handleShareReport = () => {
    // In a real implementation, this would open a share dialog
    alert("Share functionality would be implemented here");
  };
  
  // View detailed task evaluations
  const handleViewCategoryDetails = (categoryId: number) => {
    // In a real implementation, this would navigate to a detailed view
    toggleCategoryExpand(categoryId);
  };
  
  // View full detailed report
  const handleViewFullReport = () => {
    // In a real implementation, this would navigate to a more detailed report
    alert("Full detailed report would be displayed here");
  };
  
  // Determine if user should see restricted content
  const canViewInternalContent = canAccessInternalReports(user);
  
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button variant="ghost" className="mr-2" disabled>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }
  
  if (!report) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" onClick={() => setLocation('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-medium text-foreground">Report Not Found</h2>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-medium text-destructive">Error loading report</h3>
            <p className="text-muted-foreground mt-2">
              The requested report could not be found or there was an error loading data.
            </p>
            <Button className="mt-4" onClick={() => setLocation('/')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-medium text-foreground">
          {report.review.car.make} {report.review.car.model} ({report.review.car.year}) Report
        </h2>
        <div className="hidden sm:flex space-x-3">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="mr-1 h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={handleShareReport}>
            <Share className="mr-1 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>
      
      {/* Executive Report */}
      <Card className="overflow-hidden mb-6">
        <div className="p-4 bg-primary bg-opacity-5 border-b border-gray-200">
          <h3 className="font-medium text-lg text-primary">Executive Summary</h3>
        </div>
        
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="sm:w-1/3">
              <div className="bg-gray-100 rounded-lg overflow-hidden aspect-[4/3]">
                {report.review.car.imageUrl ? (
                  <img 
                    src={report.review.car.imageUrl} 
                    alt={`${report.review.car.make} ${report.review.car.model}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <span className="text-gray-400">No image available</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="sm:w-2/3">
              <div className="flex items-baseline justify-between mb-4">
                <h4 className="font-medium text-xl">
                  {report.review.car.make} {report.review.car.model} ({report.review.car.year})
                </h4>
                <div className="flex items-center">
                  <ScorePill score={report.overallScore} size="md" />
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex">
                  <span className="text-sm font-medium w-32">Android Version:</span>
                  <span className="text-sm">{report.review.car.androidVersion}</span>
                </div>
                <div className="flex">
                  <span className="text-sm font-medium w-32">Build Fingerprint:</span>
                  <span className="text-sm">{report.review.car.buildFingerprint}</span>
                </div>
                <div className="flex">
                  <span className="text-sm font-medium w-32">Reviewed Date:</span>
                  <span className="text-sm">{
                    formatDateTime(report.review.updatedAt)
                  }</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Takeaways - Only visible to internal users */}
          {canViewInternalContent && (
            <div className="mt-6">
              <h4 className="font-medium mb-2">Key Takeaways</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="mb-2">
                  This IVI is <span className="font-medium text-accent">
                    {report.overallScore && report.overallScore >= 3.5 ? "outstanding" :
                     report.overallScore && report.overallScore >= 3.0 ? "good" :
                     report.overallScore && report.overallScore >= 2.0 ? "ok" : "bad"}
                  </span>, 
                  I would rank it <span className="font-medium">#{report.benchmarkRank || "N/A"}</span> in our GAS fleet 
                  and it is <span className="font-medium">{report.benchmarkComparison || "comparable"}</span> than our previous benchmark.
                </p>
                
                <div className="mt-4">
                  <p className="text-sm font-medium">The thing I liked the most is:</p>
                  <p className="text-sm text-muted-foreground">{report.topLikes || "No specific highlights mentioned."}</p>
                </div>
                
                <div className="mt-3">
                  <p className="text-sm font-medium">The thing I hated the most is:</p>
                  <p className="text-sm text-muted-foreground">{report.topHates || "No specific issues mentioned."}</p>
                </div>
              </div>
            </div>
          )}

          {/* Top Three Issues - Only for internal users */}
          {canViewInternalContent && report.topIssues && report.topIssues.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium mb-2">Top Three Issues</h4>
              <div className="space-y-2">
                {report.topIssues.slice(0, 3).map((issue, index) => (
                  <div 
                    key={index} 
                    className={`${
                      index === 0 
                        ? "bg-error bg-opacity-5 border-l-4 border-error" 
                        : "bg-warning bg-opacity-5 border-l-4 border-warning"
                    } rounded-r-lg p-3`}
                  >
                    <div className="flex items-baseline">
                      <span className="font-medium mr-2">{issue.category}:</span>
                      <span className="text-sm">{issue.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Category Scores */}
      <Card className="overflow-hidden mb-6">
        <div className="p-4 bg-primary bg-opacity-5 border-b border-gray-200">
          <h3 className="font-medium text-lg text-primary">Category Scores</h3>
        </div>
        
        <CardContent className="p-4">
          <div className="space-y-6">
            {report.categoryScores.map(categoryScore => (
              <div key={categoryScore.category.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="material-icons text-primary mr-2">{categoryScore.category.icon}</span>
                    <h4 className="font-medium">{categoryScore.category.name}</h4>
                  </div>
                  <ScorePill score={categoryScore.score} />
                </div>
                
                {/* Task Completion */}
                <div className="space-y-1 mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Task Completion</span>
                    <span>{categoryScore.taskScore.toFixed(1)}/4.0</span>
                  </div>
                  <Progress 
                    value={(categoryScore.taskScore / 4) * 100} 
                    className="h-2"
                  />
                </div>
                
                {/* System Feedback */}
                <div className="space-y-1 mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>System Feedback</span>
                    <span>{categoryScore.responsivenessScore.toFixed(1)}/4.0</span>
                  </div>
                  <Progress 
                    value={(categoryScore.responsivenessScore / 4) * 100} 
                    className="h-2"
                  />
                </div>
                
                {/* Writing */}
                <div className="space-y-1 mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Writing</span>
                    <span>{categoryScore.writingScore.toFixed(1)}/4.0</span>
                  </div>
                  <Progress 
                    value={(categoryScore.writingScore / 4) * 100} 
                    className="h-2"
                  />
                </div>
                
                {/* Emotional (Bonus) */}
                <div className="space-y-1 mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Emotional (Bonus)</span>
                    <span>{categoryScore.emotionalScore.toFixed(1)}/4.0</span>
                  </div>
                  <Progress 
                    value={(categoryScore.emotionalScore / 4) * 100} 
                    className="h-2"
                  />
                </div>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary text-sm flex items-center mt-2"
                  onClick={() => handleViewCategoryDetails(categoryScore.category.id)}
                >
                  <span>View detailed tasks</span>
                  <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
                
                {/* Expanded tasks would be shown here */}
                {expandedCategory === categoryScore.category.id && (
                  <div className="mt-2 pl-4 border-l-2 border-gray-200">
                    <p className="text-sm text-gray-500">
                      Detailed task evaluations would be displayed here.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>

        {canViewInternalContent && (
          <div className="border-t border-gray-200 p-4 flex justify-center">
            <Button variant="ghost" className="text-primary" onClick={handleViewFullReport}>
              <span>View full detailed report</span>
              <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
