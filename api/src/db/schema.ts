// Ping Database Schema — 5 tables
// Users own agents. Agents connect to Nexus. Chat happens locally.
// Heavy lifting (matching, routing, A2A conversations) is all Nexus.

import {
  pgTable, uuid, varchar, timestamp, jsonb, boolean, text,
} from 'drizzle-orm/pg-core';

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Agents (one per user) ───────────────────────────────────────────────────

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  // Nexus integration
  nexusAgentId: uuid('nexus_agent_id'),
  nexusApiKey: text('nexus_api_key'),
  // Profile summaries (synced from Nexus)
  supplySummary: text('supply_summary'),
  demandSummary: text('demand_summary'),
  conversationStyle: varchar('conversation_style', { length: 20 }).default('balanced'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  onboardingComplete: boolean('onboarding_complete').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Agent Profiles (structured onboarding data) ────────────────────────────

export const agentProfiles = pgTable('agent_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull().unique(),
  expertise: jsonb('expertise').$type<string[]>().default([]),
  experiences: jsonb('experiences').$type<string[]>().default([]),
  opinions: jsonb('opinions').$type<string[]>().default([]),
  localKnowledge: jsonb('local_knowledge').$type<string[]>().default([]),
  activeQuestions: jsonb('active_questions').$type<string[]>().default([]),
  goals: jsonb('goals').$type<string[]>().default([]),
  decisions: jsonb('decisions').$type<string[]>().default([]),
});

// ─── Conversations (user ↔ agent chat) ───────────────────────────────────────

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Messages ────────────────────────────────────────────────────────────────

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  senderType: varchar('sender_type', { length: 20 }).notNull(), // 'user' | 'agent' | 'network'
  content: text('content').notNull(),
  messageType: varchar('message_type', { length: 20 }).notNull().default('text'), // 'text' | 'insight' | 'signal'
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow(),
});
