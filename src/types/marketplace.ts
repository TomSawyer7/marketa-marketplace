export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type FaceMatchStatus = 'not_run' | 'passed' | 'needs_review' | 'failed';
export type EverifyStatus = 'none' | 'passed' | 'failed';
export type UserRole = 'user' | 'admin';
export type Category = 'Vehicles' | 'Rentals' | 'Electronics' | 'Clothing' | 'Home' | 'Toys' | 'Sports';
export type ListingStatus = 'active' | 'pending_deal' | 'sold';
export type TransactionStatus = 'in_discussion' | 'marked_done' | 'completed';
export type DisputeStatus = 'none' | 'pending_dual_consent' | 'under_review' | 'resolved';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';
export type AppealStatus = 'pending' | 'approved' | 'denied';
export type ReviewTag = 'fast_shipper' | 'good_communication' | 'item_as_described' | 'fair_price' | 'friendly' | 'late_delivery' | 'item_not_as_described' | 'poor_communication';

export interface NationalIdFields {
  full_name: string;
  id_number: string;
  date_of_birth: string;
  expiry_date: string;
  nationality: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  verification_status: VerificationStatus;
  id_document_url?: string;
  id_front_url?: string;
  id_back_url?: string;
  id_type?: 'National ID';
  id_number?: string;
  id_front_captured_at?: string;
  id_back_captured_at?: string;
  selfie_captured_at?: string;
  selfie_url?: string;
  face_match_score?: number | null;
  face_match_status?: FaceMatchStatus;
  ocr_fields?: NationalIdFields;
  ocr_raw_text?: string;
  ocr_confidence?: Partial<Record<keyof NationalIdFields, number>>;
  role: UserRole;
  created_at: string;
  liveness_check_passed?: boolean;
  liveness_challenge_type?: string | null;
  qr_payload?: string | null;
  qr_extracted_at?: string | null;
  qr_image_data_url?: string | null;
  everify_status?: EverifyStatus;
  everify_notes?: string | null;
  is_restricted?: boolean;
  restriction_reason?: string | null;
  location?: string;
  bio?: string;
  buyer_id?: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  location: string;
  image_url: string;
  seller_id: string;
  seller?: Profile;
  status: ListingStatus;
  buyer_id?: string | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Conversation {
  id: string;
  listing_id: string;
  listing?: Listing;
  buyer_id: string;
  buyer?: Profile;
  seller_id: string;
  seller?: Profile;
  status: TransactionStatus;
  buyer_chat_consent: boolean;
  seller_chat_consent: boolean;
  dispute_status?: DisputeStatus;
  created_at: string;
  updated_at?: string;
  review_window_expires_at?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender?: Profile;
  text: string;
  image_url?: string;
  reply_to_id?: string;
  reply_to?: Message;
  is_edited?: boolean;
  is_deleted?: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  listing_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  tags: ReviewTag[];
  title?: string;
  comment: string;
  created_at: string;
}

export interface ReviewToken {
  id: string;
  conversation_id: string;
  reviewer_id: string;
  reviewee_id: string;
  listing_id: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

export interface Appeal {
  id: string;
  user_id: string;
  reason: string;
  status: AppealStatus;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

export interface ReviewAppeal {
  id: string;
  conversation_id: string;
  conversation?: Conversation;
  status: 'Under Review' | 'Resolved';
  requested_by: string;
  reason?: string;
  created_at: string;
}
