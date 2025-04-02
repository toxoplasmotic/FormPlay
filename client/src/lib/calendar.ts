// This is a client-side abstraction for calendar functionality
// Actual calendar events are added from the server

export interface CalendarEvent {
  title: string;
  start: Date;
  end?: Date;
  description?: string;
  location?: string;
}

export async function addToCalendar(event: CalendarEvent): Promise<boolean> {
  try {
    // In a real app, this would call an API endpoint to add to calendar
    console.log(`Client requested to add event to calendar: ${event.title}`);
    return true;
  } catch (error) {
    console.error('Calendar add error:', error);
    return false;
  }
}

export function createTpsReviewEvent(reportId: number, date: string, location: string): CalendarEvent {
  const eventDate = new Date(date);
  
  return {
    title: 'Review TPS Reports',
    start: eventDate,
    description: `TPS Report #${reportId} review session`,
    location: location
  };
}
