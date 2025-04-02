import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import Header from "@/components/header";
import TpsForm from "@/components/tps-form";
import TpsReview from "@/components/tps-review";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TpsStatus } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function ViewTps() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/reports/:id');
  const reportId = params ? parseInt(params.id) : null;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Get user info
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/api/me'],
  });
  
  // Get report details
  const { 
    data: report, 
    isLoading: reportLoading, 
    isError,
    error 
  } = useQuery({
    queryKey: [`/api/tps-reports/${reportId}`],
    enabled: !!reportId && !!userData,
  });
  
  useEffect(() => {
    if (isError) {
      toast({
        title: "Error loading report",
        description: error instanceof Error ? error.message : "Could not load report",
        variant: "destructive"
      });
    }
  }, [isError, error, toast]);
  
  if (userLoading || reportLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header username={userData?.user?.name || "User"} />
        <main className="flex-grow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center items-center py-12">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  if (!report) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header username={userData?.user?.name || "User"} />
        <main className="flex-grow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="md:flex md:items-center md:justify-between mb-6">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-semibold text-gray-800">TPS Report</h1>
                <p className="mt-1 text-sm text-gray-500">Trust, Pleasure, Safety</p>
              </div>
              <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
                <Button 
                  variant="outline"
                  onClick={() => setLocation('/')}
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Reports
                </Button>
              </div>
            </div>
            
            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
              <p>Report not found or you don't have permission to view it.</p>
              <Button className="mt-4" onClick={() => setLocation('/')}>
                Return to Dashboard
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  const username = userData?.user?.name || "User";
  const userId = userData?.user?.id;
  const isCreator = report.creator_id === userId;
  const partnerName = isCreator ? report.receiver_name : report.creator_name;
  
  // Determine the mode based on report status and user role
  let formMode = "view";
  if (report.status === TpsStatus.DRAFT && isCreator) {
    formMode = "edit";
  } else if (report.status === TpsStatus.PENDING_REVIEW && !isCreator) {
    formMode = "review";
  } else if (report.status === TpsStatus.PENDING_APPROVAL && isCreator) {
    formMode = "approve";
  }
  
  const handleSuccessAction = () => {
    // Invalidate cache to refetch the reports
    queryClient.invalidateQueries({ queryKey: ['/api/tps-reports'] });
    queryClient.invalidateQueries({ queryKey: [`/api/tps-reports/${reportId}`] });
    queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header username={username} />
      
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-gray-800">
                {formMode === "review" ? "Review TPS Report" : "TPS Report"}
              </h1>
              <p className="mt-1 text-sm text-gray-500">Trust, Pleasure, Safety</p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
              <Button 
                variant="outline"
                onClick={() => setLocation('/')}
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Reports
              </Button>
            </div>
          </div>
          
          {formMode === "edit" ? (
            <TpsForm 
              reportId={report.id}
              initialData={report}
              mode="edit"
              userId={userId}
              partnerId={isCreator ? report.receiver_id : report.creator_id}
              userNames={{
                user: username,
                partner: partnerName
              }}
              onSubmitSuccess={handleSuccessAction}
            />
          ) : formMode === "review" || formMode === "approve" ? (
            <TpsReview
              report={report}
              isCreator={isCreator}
              username={username}
              partnerName={partnerName}
              onSuccessAction={handleSuccessAction}
            />
          ) : (
            <TpsReview
              report={report}
              isCreator={isCreator}
              username={username}
              partnerName={partnerName}
            />
          )}
        </div>
      </main>

      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-gray-500 text-center">FormPlay – Trust, Pleasure, Safety</p>
        </div>
      </footer>
    </div>
  );
}
