// This is a client-side abstraction for email functionality
// Actual emails are sent from the server

export interface EmailData {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(emailData: EmailData): Promise<boolean> {
  try {
    // In a real app, this would call an API endpoint to send the email
    console.log(`Client requested to send email to ${emailData.to}: ${emailData.subject}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export function getEmailSubjectForStatus(status: string, creator: string, receiver: string): string {
  switch (status) {
    case 'pending_review':
      return `New TPS Report from ${creator}`;
    case 'pending_approval':
      return `TPS Report Reviewed by ${receiver}`;
    case 'completed':
      return 'TPS Report Completed';
    case 'aborted':
      return 'TPS Report Aborted';
    default:
      return 'TPS Report Update';
  }
}

export function getEmailBodyForStatus(status: string, creator: string, receiver: string): string {
  switch (status) {
    case 'pending_review':
      return `${creator} has created a new TPS report for you to review. Please log in to FormPlay to check it out!`;
    case 'pending_approval':
      return `${receiver} has reviewed your TPS report and made some changes. Please log in to FormPlay to approve it.`;
    case 'completed':
      return `Your TPS report has been approved! Time to review TPS reports together.`;
    case 'aborted':
      return `Unfortunately, your TPS report has been declined. Please log in to FormPlay for more details.`;
    default:
      return 'There has been an update to your TPS report.';
  }
}
