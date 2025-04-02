import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import Home from "@/pages/home";
import CreateTps from "@/pages/create-tps";
import ViewTps from "@/pages/view-tps";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";
import { apiRequest } from "./lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/new" component={CreateTps} />
      <Route path="/reports/:id" component={ViewTps} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/me', { credentials: 'include' });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data);
          setIsAuthenticated(true);
        } else {
          // If not logged in, auto-login as Matt for demo purposes
          // In a real app, this would show a login form
          const loginRes = await apiRequest('POST', '/api/login', {
            username: 'matt',
            password: 'password'
          });
          
          if (loginRes.ok) {
            const userData = await loginRes.json();
            setUser({ user: userData, partner: { name: 'Mina' } });
            setIsAuthenticated(true);
            toast({
              title: "Logged in as Matt",
              description: "You're now logged in as Matt for the demo.",
            });
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {isAuthenticated ? (
        <div className="flex flex-col min-h-screen bg-gray-50">
          <Router />
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md w-full mx-4 p-8 bg-white shadow-lg rounded-lg">
            <h1 className="text-2xl font-bold text-center mb-6">FormPlay</h1>
            <p className="text-gray-600 text-center mb-6">
              Auto-login as Matt is in progress...
            </p>
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      )}
    </QueryClientProvider>
  );
}

export default App;
