import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatTimeRange(start: string, end: string): string {
  if (!start || !end) return '';
  
  // Convert 24-hour to 12-hour format
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };
  
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function getStatusBadgeColor(status: string): {
  bgColor: string;
  textColor: string;
} {
  switch (status) {
    case 'draft':
      return { bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
    case 'pending_review':
      return { bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
    case 'pending_approval':
      return { bgColor: 'bg-pink-100', textColor: 'text-pink-800' };
    case 'completed':
      return { bgColor: 'bg-green-100', textColor: 'text-green-800' };
    case 'aborted':
      return { bgColor: 'bg-red-100', textColor: 'text-red-800' };
    default:
      return { bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
  }
}

export function getStatusLabel(status: string, isCreator: boolean): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'pending_review':
      return isCreator ? 'Awaiting Review' : 'Your Review Needed';
    case 'pending_approval':
      return isCreator ? 'Your Approval Needed' : 'Awaiting Approval';
    case 'completed':
      return 'Completed';
    case 'aborted':
      return 'Aborted';
    default:
      return status;
  }
}

// This function should be in a React component, not in a utility file
// Removed JSX content as it's causing build errors
export function getReportIcon(status: string): string {
  return "TPS";
}

export function generateInitials(name: string): string {
  if (!name) return '';
  
  return name.split(' ')
    .map(part => part[0]?.toUpperCase() || '')
    .join('');
}
