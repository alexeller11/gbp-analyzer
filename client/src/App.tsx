import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import GoogleOAuthCallback from "@/pages/GoogleOAuthCallback";
import Dashboard from "@/pages/Dashboard";
import ProfileAnalysis from "@/pages/ProfileAnalysis";
import AIChatPage from "@/pages/AIChatPage";
import PerformanceCharts from "@/pages/PerformanceCharts";
import CompetitorComparison from "@/pages/CompetitorComparison";
import Checklist from "@/pages/Checklist";
import ReviewResponder from "@/pages/ReviewResponder";
import PostGenerator from "@/pages/PostGenerator";
import KeywordAnalyzer from "@/pages/KeywordAnalyzer";
import ActivityMonitor from "@/pages/ActivityMonitor";
import AISearchOptimizer from "@/pages/AISearchOptimizer";
import ReportGenerator from "@/pages/ReportGenerator";
import ProfileChecklist from "@/pages/ProfileChecklist";
import GeoGrid from "@/pages/GeoGrid";
import ScoreHistoryPage from "@/pages/ScoreHistoryPage";
import AlertSettings from "@/pages/AlertSettings";
import PublicReportPage from "@/pages/PublicReportPage";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/api/oauth/google/callback" component={GoogleOAuthCallback} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/checklist" component={Checklist} />
      <Route path="/profile/:profileId" component={ProfileAnalysis} />
      <Route path="/profile/:profileId/chat" component={AIChatPage} />
      <Route path="/profile/:profileId/charts" component={PerformanceCharts} />
      <Route path="/profile/:profileId/competitors" component={CompetitorComparison} />
      <Route path="/profile/:profileId/reviews" component={ReviewResponder} />
      <Route path="/profile/:profileId/posts" component={PostGenerator} />
      <Route path="/profile/:profileId/keywords" component={KeywordAnalyzer} />
      <Route path="/profile/:profileId/activity" component={ActivityMonitor} />
      <Route path="/profile/:profileId/ai-search" component={AISearchOptimizer} />
      <Route path="/profile/:profileId/report" component={ReportGenerator} />
      <Route path="/profile/:profileId/checklist" component={ProfileChecklist} />
      <Route path="/profile/:profileId/geo-grid" component={GeoGrid} />
      <Route path="/profile/:profileId/score-history" component={ScoreHistoryPage} />
      <Route path="/alerts" component={AlertSettings} />
      <Route path="/public/report/:token" component={PublicReportPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
