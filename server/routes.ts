import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTpsReportSchema, insertTpsLogSchema, TpsStatus } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import * as fs from 'fs';
import * as path from 'path';
import session from 'express-session';
import MemoryStore from 'memorystore';

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up sessions
  const MemoryStoreSession = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'formplay-tps-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 86400000 }, // 24 hours
    store: new MemoryStoreSession({ checkPeriod: 86400000 })
  }));

  // Authentication middleware
  const authenticate = (req: Request, res: Response, next: Function) => {
    if (req.session && req.session.userId) {
      return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
  };

  // Auth routes
  app.post('/api/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      req.session.userId = user.id;
      return res.json({ 
        id: user.id, 
        username: user.username, 
        name: user.name,
        email: user.email
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  });

  app.post('/api/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });

  app.get('/api/me', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const userWithPartner = await storage.getUserWithPartner(userId);
      
      if (!userWithPartner) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const { user, partner } = userWithPartner;
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email
        },
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email
        }
      });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({ message: 'Server error fetching user data' });
    }
  });

  // TPS Report routes
  app.get('/api/tps-reports', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const status = req.query.status as string;
      
      let reports;
      if (status) {
        reports = await storage.getTpsReportsByStatus(status as TpsStatus);
        // Filter to only show reports for this user
        reports = reports.filter(report => 
          report.creator_id === userId || report.receiver_id === userId
        );
      } else {
        reports = await storage.getTpsReportsByUser(userId);
      }
      
      // Get users for additional context
      const users = await storage.getAllUsers();
      const usersMap = new Map(users.map(user => [user.id, user]));
      
      // Map reports to include creator/receiver names
      const enrichedReports = reports.map(report => ({
        ...report,
        creator_name: usersMap.get(report.creator_id)?.name || 'Unknown',
        receiver_name: usersMap.get(report.receiver_id)?.name || 'Unknown'
      }));
      
      res.json(enrichedReports);
    } catch (error) {
      console.error('Get TPS reports error:', error);
      res.status(500).json({ message: 'Server error fetching TPS reports' });
    }
  });

  app.get('/api/tps-reports/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const reportId = parseInt(req.params.id);
      
      if (isNaN(reportId)) {
        return res.status(400).json({ message: 'Invalid report ID' });
      }
      
      const report = await storage.getTpsReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: 'TPS report not found' });
      }
      
      // Ensure user is either creator or receiver
      if (report.creator_id !== userId && report.receiver_id !== userId) {
        return res.status(403).json({ message: 'Access denied to this report' });
      }
      
      // Log that the user viewed this report
      await storage.createTpsLog({
        tps_id: reportId,
        user_id: userId,
        action: 'viewed',
        details: {}
      });
      
      // Get users for additional context
      const users = await storage.getAllUsers();
      const usersMap = new Map(users.map(user => [user.id, user]));
      
      const enrichedReport = {
        ...report,
        creator_name: usersMap.get(report.creator_id)?.name || 'Unknown',
        receiver_name: usersMap.get(report.receiver_id)?.name || 'Unknown'
      };
      
      res.json(enrichedReport);
    } catch (error) {
      console.error('Get TPS report error:', error);
      res.status(500).json({ message: 'Server error fetching TPS report' });
    }
  });

  app.post('/api/tps-reports', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const userData = await storage.getUserWithPartner(userId);
      
      if (!userData) {
        return res.status(404).json({ message: 'User or partner not found' });
      }
      
      // Validate the TPS report data
      const reportData = {
        ...req.body,
        creator_id: userId,
        receiver_id: userData.partner.id
      };
      
      try {
        insertTpsReportSchema.parse(reportData);
      } catch (error) {
        if (error instanceof ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.message });
        }
        throw error;
      }
      
      // Create the report
      const report = await storage.createTpsReport(reportData);
      
      // Handle PDF data if provided
      if (req.body.pdfData) {
        const pdfBuffer = Buffer.from(req.body.pdfData, 'base64');
        const pdfPath = await storage.savePdfToDisk(report.id, pdfBuffer);
        
        // Update the report with the PDF path
        await storage.updateTpsReport(report.id, { pdf_path: pdfPath });
      }
      
      // If status is past draft, notify the partner
      if (report.status === TpsStatus.PENDING_REVIEW) {
        await storage.sendEmail(
          userData.partner.email,
          'New TPS Report Available',
          `${userData.user.name} has created a new TPS report for you to review. Please log in to FormPlay to check it out!`
        );
      }
      
      res.status(201).json(report);
    } catch (error) {
      console.error('Create TPS report error:', error);
      res.status(500).json({ message: 'Server error creating TPS report' });
    }
  });

  app.put('/api/tps-reports/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const reportId = parseInt(req.params.id);
      
      if (isNaN(reportId)) {
        return res.status(400).json({ message: 'Invalid report ID' });
      }
      
      const report = await storage.getTpsReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: 'TPS report not found' });
      }
      
      // Check permissions based on status and user role
      const isCreator = report.creator_id === userId;
      const isReceiver = report.receiver_id === userId;
      
      if (!isCreator && !isReceiver) {
        return res.status(403).json({ message: 'Access denied to this report' });
      }
      
      // Check if the user can edit based on the report status
      if (report.status === TpsStatus.DRAFT && !isCreator) {
        return res.status(403).json({ message: 'Only the creator can edit a draft' });
      }
      
      if (report.status === TpsStatus.PENDING_REVIEW && !isReceiver) {
        return res.status(403).json({ message: 'Only the receiver can review this report' });
      }
      
      if (report.status === TpsStatus.PENDING_APPROVAL && !isCreator) {
        return res.status(403).json({ message: 'Only the creator can approve this report' });
      }
      
      if (report.status === TpsStatus.COMPLETED || report.status === TpsStatus.ABORTED) {
        return res.status(403).json({ message: 'This report is already finalized' });
      }
      
      // Update the report
      const updateData = req.body;
      const updatedReport = await storage.updateTpsReport(reportId, updateData);
      
      if (!updatedReport) {
        return res.status(500).json({ message: 'Failed to update TPS report' });
      }
      
      // Create log entry
      await storage.createTpsLog({
        tps_id: reportId,
        user_id: userId,
        action: 'updated',
        details: { status: updatedReport.status }
      });
      
      // Handle status transitions and notifications
      const userData = await storage.getUserWithPartner(userId);
      if (userData) {
        if (updateData.status === TpsStatus.PENDING_REVIEW && isCreator) {
          // Creator submitting for review
          await storage.sendEmail(
            userData.partner.email,
            'TPS Report Ready for Review',
            `${userData.user.name} has submitted a TPS report for your review. Please log in to FormPlay to check it out!`
          );
        } else if (updateData.status === TpsStatus.PENDING_APPROVAL && isReceiver) {
          // Receiver sending back for approval
          await storage.sendEmail(
            userData.partner.email,
            'TPS Report Ready for Your Approval',
            `${userData.user.name} has reviewed your TPS report. Please log in to FormPlay to check it out!`
          );
        } else if (updateData.status === TpsStatus.COMPLETED && isCreator) {
          // Creator approving the report
          await storage.sendEmail(
            userData.partner.email,
            'TPS Report Completed',
            `${userData.user.name} has approved the TPS report. It's time to review TPS reports!`
          );
          
          // Add calendar event for both users
          const event = {
            summary: 'Review TPS Reports',
            start: new Date(),
            description: `TPS Report #${report.id} review time!`
          };
          
          await storage.addToCalendar(userId, event);
          await storage.addToCalendar(userData.partner.id, event);
        } else if (updateData.status === TpsStatus.ABORTED) {
          // Report was denied/aborted
          const partner = isCreator ? userData.partner : userData.user;
          await storage.sendEmail(
            partner.email,
            'TPS Report Aborted',
            `A TPS report has been aborted. Please log in to FormPlay for details.`
          );
        }
      }
      
      res.json(updatedReport);
    } catch (error) {
      console.error('Update TPS report error:', error);
      res.status(500).json({ message: 'Server error updating TPS report' });
    }
  });

  app.post('/api/tps-reports/:id/replicate', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const reportId = parseInt(req.params.id);
      
      if (isNaN(reportId)) {
        return res.status(400).json({ message: 'Invalid report ID' });
      }
      
      const report = await storage.getTpsReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: 'TPS report not found' });
      }
      
      // Only completed or aborted reports can be replicated
      if (report.status !== TpsStatus.COMPLETED && report.status !== TpsStatus.ABORTED) {
        return res.status(400).json({ message: 'Only completed or aborted reports can be replicated' });
      }
      
      // Replicate the report
      const newReport = await storage.replicateTpsReport(reportId);
      
      if (!newReport) {
        return res.status(500).json({ message: 'Failed to replicate TPS report' });
      }
      
      res.status(201).json(newReport);
    } catch (error) {
      console.error('Replicate TPS report error:', error);
      res.status(500).json({ message: 'Server error replicating TPS report' });
    }
  });

  app.get('/api/tps-reports/:id/logs', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const reportId = parseInt(req.params.id);
      
      if (isNaN(reportId)) {
        return res.status(400).json({ message: 'Invalid report ID' });
      }
      
      const report = await storage.getTpsReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: 'TPS report not found' });
      }
      
      // Ensure user is either creator or receiver
      if (report.creator_id !== userId && report.receiver_id !== userId) {
        return res.status(403).json({ message: 'Access denied to this report logs' });
      }
      
      const logs = await storage.getTpsLogsByReport(reportId);
      
      // Get users for additional context
      const users = await storage.getAllUsers();
      const usersMap = new Map(users.map(user => [user.id, user]));
      
      // Map logs to include user names
      const enrichedLogs = logs.map(log => ({
        ...log,
        user_name: usersMap.get(log.user_id)?.name || 'Unknown'
      }));
      
      res.json(enrichedLogs);
    } catch (error) {
      console.error('Get TPS logs error:', error);
      res.status(500).json({ message: 'Server error fetching TPS logs' });
    }
  });

  // Serve the PDF templates
  app.get('/api/templates/tps-vanilla', (req: Request, res: Response) => {
    const pdfPath = path.join(process.cwd(), 'storage', 'pdfs', 'tps-vanilla.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'PDF template not found' });
    }
    
    console.log('Serving PDF template from:', pdfPath);
    res.contentType('application/pdf');
    res.sendFile(pdfPath);
  });

  // Stats
  app.get('/api/stats', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const reports = await storage.getTpsReportsByUser(userId);
      
      const pending = reports.filter(r => 
        r.status === TpsStatus.PENDING_REVIEW || 
        r.status === TpsStatus.PENDING_APPROVAL
      ).length;
      
      const completed = reports.filter(r => r.status === TpsStatus.COMPLETED).length;
      const aborted = reports.filter(r => r.status === TpsStatus.ABORTED).length;
      
      res.json({ pending, completed, aborted });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ message: 'Server error fetching stats' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
