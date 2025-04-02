import { 
  User, InsertUser, 
  TpsReport, InsertTpsReport, 
  TpsLog, InsertTpsLog, 
  TpsStatus 
} from "@shared/schema";
import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import * as ical from 'node-ical';
import { promisify } from 'util';

// Modify the interface with any CRUD methods
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUserWithPartner(userId: number): Promise<{user: User, partner: User} | undefined>;
  
  // TPS Report methods
  createTpsReport(report: InsertTpsReport): Promise<TpsReport>;
  getTpsReport(id: number): Promise<TpsReport | undefined>;
  updateTpsReport(id: number, data: Partial<TpsReport>): Promise<TpsReport | undefined>;
  getAllTpsReports(): Promise<TpsReport[]>;
  getTpsReportsByUser(userId: number): Promise<TpsReport[]>;
  getTpsReportsByStatus(status: TpsStatus): Promise<TpsReport[]>;
  replicateTpsReport(id: number): Promise<TpsReport | undefined>;
  
  // Log methods
  createTpsLog(log: InsertTpsLog): Promise<TpsLog>;
  getTpsLogsByReport(tpsId: number): Promise<TpsLog[]>;
  
  // Helper methods
  sendEmail(to: string, subject: string, body: string): Promise<boolean>;
  addToCalendar(userId: number, event: any): Promise<boolean>;
  savePdfToDisk(reportId: number, pdfData: Buffer): Promise<string>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private tpsReports: Map<number, TpsReport>;
  private tpsLogs: Map<number, TpsLog>;
  private userId: number;
  private tpsId: number;
  private logId: number;
  private pdfDir: string;
  
  constructor() {
    this.users = new Map();
    this.tpsReports = new Map();
    this.tpsLogs = new Map();
    this.userId = 1;
    this.tpsId = 1;
    this.logId = 1;
    this.pdfDir = path.join(process.cwd(), 'storage', 'pdfs');
    
    // Ensure PDF directory exists
    if (!fs.existsSync(this.pdfDir)) {
      fs.mkdirSync(this.pdfDir, { recursive: true });
    }
    
    // Initialize with Matt and Mina users
    this.initUsers();
  }
  
  private initUsers() {
    const matt: User = {
      id: this.userId++,
      username: 'matt',
      password: 'password', // In a real app, this would be hashed
      name: 'Matt',
      email: 'matt@example.com',
      partner_id: 2
    };
    
    const mina: User = {
      id: this.userId++,
      username: 'mina',
      password: 'password', // In a real app, this would be hashed
      name: 'Mina',
      email: 'mina@example.com',
      partner_id: 1
    };
    
    this.users.set(matt.id, matt);
    this.users.set(mina.id, mina);
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getUserWithPartner(userId: number): Promise<{user: User, partner: User} | undefined> {
    const user = await this.getUser(userId);
    if (!user || !user.partner_id) return undefined;
    
    const partner = await this.getUser(user.partner_id);
    if (!partner) return undefined;
    
    return { user, partner };
  }
  
  // TPS Report methods
  async createTpsReport(report: InsertTpsReport): Promise<TpsReport> {
    const id = this.tpsId++;
    const now = new Date();
    const tpsReport: TpsReport = {
      ...report,
      id,
      created_at: now,
      updated_at: now
    };
    
    this.tpsReports.set(id, tpsReport);
    
    // Create log entry
    await this.createTpsLog({
      tps_id: id,
      user_id: report.creator_id,
      action: 'created',
      details: {}
    });
    
    return tpsReport;
  }
  
  async getTpsReport(id: number): Promise<TpsReport | undefined> {
    return this.tpsReports.get(id);
  }
  
  async updateTpsReport(id: number, data: Partial<TpsReport>): Promise<TpsReport | undefined> {
    const report = this.tpsReports.get(id);
    if (!report) return undefined;
    
    const updatedReport: TpsReport = {
      ...report,
      ...data,
      updated_at: new Date()
    };
    
    this.tpsReports.set(id, updatedReport);
    return updatedReport;
  }
  
  async getAllTpsReports(): Promise<TpsReport[]> {
    return Array.from(this.tpsReports.values());
  }
  
  async getTpsReportsByUser(userId: number): Promise<TpsReport[]> {
    return Array.from(this.tpsReports.values()).filter(
      report => report.creator_id === userId || report.receiver_id === userId
    );
  }
  
  async getTpsReportsByStatus(status: TpsStatus): Promise<TpsReport[]> {
    return Array.from(this.tpsReports.values()).filter(
      report => report.status === status
    );
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
    const id = this.logId++;
    const tpsLog: TpsLog = {
      ...log,
      id,
      timestamp: new Date()
    };
    
    this.tpsLogs.set(id, tpsLog);
    return tpsLog;
  }
  
  async getTpsLogsByReport(tpsId: number): Promise<TpsLog[]> {
    return Array.from(this.tpsLogs.values()).filter(
      log => log.tps_id === tpsId
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
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

// Import the DatabaseStorage implementation
import { DatabaseStorage } from './database-storage';

// Use DatabaseStorage instead of MemStorage for persistent storage
export const storage = new DatabaseStorage();
