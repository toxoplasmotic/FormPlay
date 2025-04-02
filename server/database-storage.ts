import { 
  User, InsertUser, 
  TpsReport, InsertTpsReport, 
  TpsLog, InsertTpsLog, 
  TpsStatus 
} from "@shared/schema";
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as db from './db';
import { IStorage } from './storage';

export class DatabaseStorage implements IStorage {
  private pdfDir: string;
  
  constructor() {
    this.pdfDir = path.join(process.cwd(), 'storage', 'pdfs');
    
    // Ensure PDF directory exists
    if (!fs.existsSync(this.pdfDir)) {
      fs.mkdirSync(this.pdfDir, { recursive: true });
    }
    
    // Initialize database
    this.initDatabase();
  }
  
  private async initDatabase() {
    try {
      console.log('Initializing database...');
      // Run migrations and seed data if needed
      await db.runMigrations();
      await db.seedDatabase();
      console.log('Database initialization complete');
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return db.getUserById(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return db.getUserByUsername(username);
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.db.insert(db.users).values(user).returning();
    return newUser;
  }
  
  async getAllUsers(): Promise<User[]> {
    return db.getAllUsers();
  }
  
  async getUserWithPartner(userId: number): Promise<{user: User, partner: User} | undefined> {
    return db.getUserWithPartner(userId);
  }
  
  // TPS Report methods
  async createTpsReport(report: InsertTpsReport): Promise<TpsReport> {
    const newReport = await db.createTpsReport(report);
    
    // Create log entry
    await this.createTpsLog({
      tps_id: newReport.id,
      user_id: report.creator_id,
      action: 'created',
      details: {}
    });
    
    return newReport;
  }
  
  async getTpsReport(id: number): Promise<TpsReport | undefined> {
    return db.getTpsReport(id);
  }
  
  async updateTpsReport(id: number, data: Partial<TpsReport>): Promise<TpsReport | undefined> {
    return db.updateTpsReport(id, data);
  }
  
  async getAllTpsReports(): Promise<TpsReport[]> {
    return db.db.select().from(db.tpsReports);
  }
  
  async getTpsReportsByUser(userId: number): Promise<TpsReport[]> {
    return db.getTpsReportsByUser(userId);
  }
  
  async getTpsReportsByStatus(status: TpsStatus): Promise<TpsReport[]> {
    return db.getTpsReportsByStatus(status);
  }
  
  async replicateTpsReport(id: number): Promise<TpsReport | undefined> {
    const original = await this.getTpsReport(id);
    if (!original) return undefined;
    
    // Create a copy with reset dates and emotional state
    const formData = JSON.parse(JSON.stringify(original.form_data));
    
    // Reset emotional state
    if (formData.emotional_state) {
      formData.emotional_state = { matt: '', mina: '' };
    }
    
    // Set current date
    const today = new Date().toISOString().split('T')[0];
    
    const newReport: InsertTpsReport = {
      creator_id: original.creator_id,
      receiver_id: original.receiver_id,
      status: TpsStatus.DRAFT,
      date: today,
      time_start: original.time_start,
      time_end: original.time_end,
      location: original.location,
      location_other: original.location_other,
      sound: original.sound,
      form_data: formData,
      creator_notes: '',
      receiver_notes: '',
      creator_initials: '',
      receiver_initials: '',
      replicated_from_id: original.id,
      pdf_path: ''
    };
    
    const report = await this.createTpsReport(newReport);
    
    // Create log entry for replication
    await this.createTpsLog({
      tps_id: report.id,
      user_id: original.creator_id,
      action: 'replicated',
      details: { original_id: original.id }
    });
    
    return report;
  }
  
  // Log methods
  async createTpsLog(log: InsertTpsLog): Promise<TpsLog> {
    return db.createTpsLog({
      ...log,
      timestamp: new Date()
    });
  }
  
  async getTpsLogsByReport(tpsId: number): Promise<TpsLog[]> {
    const logs = await db.getTpsLogsByReport(tpsId);
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  // Helper methods
  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    // In a real app, this would send an actual email
    console.log(`Email sent to ${to}: ${subject} - ${body}`);
    return true;
  }
  
  async addToCalendar(userId: number, event: any): Promise<boolean> {
    // In a real app, this would add to the user's calendar
    console.log(`Calendar event added for user ${userId}: ${JSON.stringify(event)}`);
    return true;
  }
  
  async savePdfToDisk(reportId: number, pdfData: Buffer): Promise<string> {
    const pdfPath = path.join(this.pdfDir, `tps_report_${reportId}.pdf`);
    await promisify(fs.writeFile)(pdfPath, pdfData);
    return pdfPath;
  }
}