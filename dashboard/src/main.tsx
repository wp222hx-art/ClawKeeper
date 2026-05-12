import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { RunsProvider } from './lib/runs-context';
import { ActiveRunsIndicator } from './components/runs/ActiveRunsIndicator';
import './index.css';

const query_client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minute - data is considered fresh for 60s
      gcTime: 300000, // 5 minutes - cached data kept in memory for 5min
      refetchOnWindowFocus: false, // Disable auto-refetch on window focus
      refetchOnMount: false, // Disable refetch when component mounts
      refetchOnReconnect: false, // Disable refetch on network reconnect
      retry: 1, // Only retry failed queries once
    },
  },
});

// Initialize theme before first render to prevent flash
function init_theme() {
  const stored_theme = localStorage.getItem('clawkeeper-theme');
  const theme = stored_theme || 'light'; // Default to light mode for better login page visibility
  
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Run theme initialization immediately
init_theme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={query_client}>
      {/*
        RunsProvider sits ABOVE <App /> (and therefore above the Router) so
        that route changes never unmount it. This is what allows AI generation
        tasks to keep running when the user navigates away from the page that
        started them — the slot-key registry lives here, not inside any page.
      */}
      <RunsProvider>
        <App />
        <ActiveRunsIndicator />
      </RunsProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
