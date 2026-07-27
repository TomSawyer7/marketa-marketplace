// Auto-generated from live Supabase schema via MCP introspection
// Date: 2026-07-26

// ---- Enum-style string unions (not DB enums) ----
export type DbVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type DbUserRole = 'user' | 'admin';

export type DbCategory = 'Vehicles' | 'Rentals' | 'Electronics' | 'Clothing' | 'Home' | 'Toys' | 'Sports';

export type DbListingStatus = 'active' | 'pending_deal' | 'sold';

export type DbTransactionStatus = 'in_discussion' | 'marked_done' | 'completed';

export type DbDisputeStatus = 'none' | 'pending_dual_consent' | 'under_review' | 'resolved';

// ---- Tables (exact DB column names & types) ----

export interface DbProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  verification_status: string | null;
  id_document_url: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  face_match_score: number | null;
  location: string | null;
  created_at: string | null;
}

export interface DbListing {
  id: string;
  title: string | null;
  description: string | null;
  price: number | null;
  category: string | null;
  location: string | null;
  image_urls: string | null;
  user_id: string | null;
  status: string | null;
  created_at: string | null;
}

export interface DbConversation {
  id: string;
  listing_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  status: string | null;
  created_at: string | null;
}

export interface DbMessage {
  id: string;
  conversation_id: string | null;
  sender_id: string | null;
  content: string | null;
  image_url: string | null;
  is_edited: boolean | null;
  created_at: string | null;
}

export interface DbReviewAppeal {
  id: string;
  buyer_id: string | null;
  seller_id: string | null;
  buyer_chat_consent: boolean | null;
  seller_chat_consent: boolean | null;
  reason: string | null;
  status: string | null;
  created_at: string | null;
}

// ---- Post-migration types (after running the sync migration) ----
// Once 20260726000002_sync_schema_with_app.sql is applied,
// the columns below will also exist in the DB.
// Re-run schema introspection after applying migrations to confirm.

export interface DbProfileAfterMigration extends DbProfile {
  email: string;
  role: DbUserRole;
}

export interface DbListingAfterMigration extends DbListing {
  image_url: string;
  seller_id: string;
}

export interface DbConversationAfterMigration extends DbConversation {
  buyer_chat_consent: boolean;
  seller_chat_consent: boolean;
  dispute_status: DbDisputeStatus;
  updated_at: string;
}

export interface DbMessageAfterMigration extends DbMessage {
  text: string;
  reply_to_id: string | null;
  is_deleted: boolean | null;
}
