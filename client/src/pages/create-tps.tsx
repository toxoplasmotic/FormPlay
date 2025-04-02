import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/header";
import PdfForm from "@/components/pdf-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CreateTps() {
  const [, setLocation] = useLocation();
  
  // Get user info
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/api/me'],
  });
  
  if (userLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex justify-center items-center py-12">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }
  
  const username = userData?.user?.name || "User";
  const userId = userData?.user?.id;
  const partnerId = userData?.partner?.id;
  const partnerName = userData?.partner?.name;
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header username={username} />
      
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-gray-800">New TPS Report</h1>
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
          
          {userId && partnerId ? (
            <PdfForm 
              mode="create"
              userId={userId}
              partnerId={partnerId}
              userNames={{
                user: username,
                partner: partnerName
              }}
            />
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
              <p>User information not available. Please try again later.</p>
              <Button className="mt-4" onClick={() => setLocation('/')}>
                Return to Dashboard
              </Button>
            </div>
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
