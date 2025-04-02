import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as path from 'path';
import * as fs from 'fs';
import { users, tpsReports, tpsLogs, User, TpsReport, TpsLog } from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';

// Create postgres client
const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString as string);
export const db = drizzle(client);

// Optional: Run migrations
export async function runMigrations() {
  try {
    // Create migrations folder if it doesn't exist
    const migrationsFolder = path.join(process.cwd(), 'drizzle');
    if (!fs.existsSync(migrationsFolder)) {
      fs.mkdirSync(migrationsFolder, { recursive: true });
    }
    
    console.log('Running database migrations...');
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

// Initialize the database with some data
export async function seedDatabase() {
  try {
    // Check if we already have users
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) {
      console.log('Database already seeded');
      return;
    }
    
    console.log('Seeding database with initial data...');
    
    // Create users
    const [matt] = await db.insert(users).values({
      username: 'matt',
      password: 'password', // In a real app, this should be hashed
      name: 'Matt',
      email: 'matt@example.com',
    }).returning();
    
    const [mina] = await db.insert(users).values({
      username: 'mina',
      password: 'password', // In a real app, this should be hashed
      name: 'Mina',
      email: 'mina@example.com',
    }).returning();
    
    // Update partner relationships
    await db.update(users)
      .set({ partner_id: mina.id })
      .where(eq(users.id, matt.id));
    
    await db.update(users)
      .set({ partner_id: matt.id })
      .where(eq(users.id, mina.id));
    
    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Helper functions for database operations
export async function getUserById(id: number): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user;
}

export async function getUserWithPartner(userId: number): Promise<{user: User, partner: User} | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.partner_id) return undefined;
  
  const [partner] = await db.select().from(users).where(eq(users.id, user.partner_id));
  if (!partner) return undefined;
  
  return { user, partner };
}

export async function getAllUsers(): Promise<User[]> {
  return db.select().from(users);
}

export async function createTpsReport(reportData: any): Promise<TpsReport> {
  const [report] = await db.insert(tpsReports).values(reportData).returning();
  return report;
}

export async function getTpsReport(id: number): Promise<TpsReport | undefined> {
  const [report] = await db.select().from(tpsReports).where(eq(tpsReports.id, id));
  return report;
}

export async function updateTpsReport(id: number, data: Partial<TpsReport>): Promise<TpsReport | undefined> {
  const [updatedReport] = await db.update(tpsReports)
    .set({ ...data, updated_at: new Date() })
    .where(eq(tpsReports.id, id))
    .returning();
  return updatedReport;
}

export async function getTpsReportsByUser(userId: number): Promise<TpsReport[]> {
  return db.select()
    .from(tpsReports)
    .where(or(
      eq(tpsReports.creator_id, userId),
      eq(tpsReports.receiver_id, userId)
    ));
}

export async function getTpsReportsByStatus(status: string): Promise<TpsReport[]> {
  return db.select().from(tpsReports).where(eq(tpsReports.status, status));
}

export async function createTpsLog(logData: any): Promise<TpsLog> {
  const [log] = await db.insert(tpsLogs).values(logData).returning();
  return log;
}

export async function getTpsLogsByReport(tpsId: number): Promise<TpsLog[]> {
  return db.select().from(tpsLogs).where(eq(tpsLogs.tps_id, tpsId));
}