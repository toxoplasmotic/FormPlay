import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getStatusBadgeColor } from "@/lib/utils";
import Header from "@/components/header";
import TpsListItem from "@/components/tps-list-item";
import StatCard from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { TpsStatus } from "@shared/schema";
import { 
  FilePlus2, 
  FileText, 
  CheckCircle, 
  XCircle,
  Search
} from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [filter, setFilter] = useState<TpsStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get user info
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/api/me'],
  });
  
  // Get all reports
  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['/api/tps-reports'],
    enabled: !!userData,
  });
  
  // Get stats
  const { data: stats } = useQuery({
    queryKey: ['/api/stats'],
    enabled: !!userData,
  });
  
  useEffect(() => {
    // Refetch reports when navigating back to this page
    refetch();
  }, [refetch]);
  
  if (userLoading || isLoading) {
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
  
  const username = userData?.user?.name || "User";
  const userId = userData?.user?.id;
  
  // Filter and search reports
  const filteredReports = reports?.filter(report => {
    // Filter by status
    if (filter !== 'all' && report.status !== filter) {
      return false;
    }
    
    // Search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const location = report.location === 'master' ? 'Master bedroom' : 
                     report.location === 'basement' ? 'Basement' : 
                     report.location === 'other' ? report.location_other : 
                     report.location;
      
      return (
        location?.toLowerCase().includes(searchLower) ||
        report.creator_name.toLowerCase().includes(searchLower) ||
        report.receiver_name.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header username={username} />
      
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-gray-800">TPS Reports</h1>
              <p className="mt-1 text-sm text-gray-500">Trust, Pleasure, Safety</p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Button
                onClick={() => setLocation('/new')}
              >
                <FilePlus2 className="h-5 w-5 mr-2" />
                New TPS Report
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <StatCard
              title="Pending Reports"
              value={stats?.pending || 0}
              icon={<FileText className="h-6 w-6 text-indigo-600" />}
              bgColor="bg-indigo-100"
              textColor="text-indigo-600"
            />
            <StatCard
              title="Completed Reports"
              value={stats?.completed || 0}
              icon={<CheckCircle className="h-6 w-6 text-emerald-600" />}
              bgColor="bg-emerald-100"
              textColor="text-emerald-600"
            />
            <StatCard
              title="Aborted Reports"
              value={stats?.aborted || 0}
              icon={<XCircle className="h-6 w-6 text-red-600" />}
              bgColor="bg-red-100"
              textColor="text-red-600"
            />
          </div>

          {/* Filter & Search */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex space-x-3 mb-4 md:mb-0">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
                size="sm"
              >
                All Reports
              </Button>
              <Button
                variant={filter === TpsStatus.PENDING_REVIEW || filter === TpsStatus.PENDING_APPROVAL ? 'default' : 'outline'}
                onClick={() => filter === TpsStatus.PENDING_REVIEW || filter === TpsStatus.PENDING_APPROVAL 
                  ? setFilter('all') 
                  : setFilter(TpsStatus.PENDING_REVIEW)}
                size="sm"
              >
                Pending
              </Button>
              <Button
                variant={filter === TpsStatus.COMPLETED ? 'default' : 'outline'}
                onClick={() => filter === TpsStatus.COMPLETED ? setFilter('all') : setFilter(TpsStatus.COMPLETED)}
                size="sm"
              >
                Completed
              </Button>
              <Button
                variant={filter === TpsStatus.ABORTED ? 'default' : 'outline'}
                onClick={() => filter === TpsStatus.ABORTED ? setFilter('all') : setFilter(TpsStatus.ABORTED)}
                size="sm"
              >
                Aborted
              </Button>
            </div>
            <div className="w-full md:w-64">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <Input 
                  placeholder="Search reports" 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* TPS Reports List */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {filteredReports?.length ? (
              <ul className="divide-y divide-gray-200">
                {filteredReports.map(report => (
                  <TpsListItem 
                    key={report.id} 
                    report={report} 
                    isCreator={report.creator_id === userId}
                  />
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center">
                <p className="text-gray-500">
                  {searchTerm || filter !== 'all'
                    ? 'No reports match your search or filter criteria'
                    : 'No TPS reports yet. Create your first one!'}
                </p>
                {!searchTerm && filter === 'all' && (
                  <Button 
                    className="mt-4"
                    onClick={() => setLocation('/new')}
                  >
                    Create TPS Report
                  </Button>
                )}
              </div>
            )}
          </div>
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
