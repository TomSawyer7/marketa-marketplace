import { createClient } from '@supabase/supabase-js';
import type {
  Profile,
  Listing,
  Conversation,
  Message,
  Review,
  ReviewToken,
  Report,
  Appeal,
  VerificationStatus,
  FaceMatchStatus,
  EverifyStatus,
  TransactionStatus,
  ReviewTag
} from '../types/marketplace';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- PERSISTENT DATA LAYER (localStorage-backed) ---

const GUEST_PROFILE: Profile = {
  id: '',
  email: '',
  full_name: 'Guest',
  avatar_url: '',
  verification_status: 'unverified',
  role: 'user',
  created_at: ''
};

// --- LOCAL STORAGE REPOSITORY STATE MANAGER ---
class MarketplaceStore {
  private users: Profile[];
  private listings: Listing[];
  private conversations: Conversation[];
  private messages: Message[];
  private reviews: Review[];
  private reviewTokens: ReviewToken[];
  private reports: Report[];
  private appeals: Appeal[];
  private currentUserId: string;
  private listeners: (() => void)[] = [];

  private fakeUserIds = ['usr_verified_seller', 'usr_verified_buyer', 'usr_pending_user'];
  private fakeListingIds = ['lst_1', 'lst_2', 'lst_3', 'lst_4', 'lst_5', 'lst_6', 'lst_7'];
  private fakeConvIds = ['conv_1', 'conv_2'];
  private fakeMsgIds = ['msg_1', 'msg_2', 'msg_3', 'msg_4', 'msg_5', 'msg_6', 'msg_7'];

  constructor() {
    this.users = JSON.parse(localStorage.getItem('marketa_users') || '[]');
    this.listings = JSON.parse(localStorage.getItem('marketa_listings') || '[]');
    this.conversations = JSON.parse(localStorage.getItem('marketa_conversations') || '[]');
    this.messages = JSON.parse(localStorage.getItem('marketa_messages') || '[]');
    this.reviews = JSON.parse(localStorage.getItem('marketa_reviews') || '[]');
    this.reviewTokens = JSON.parse(localStorage.getItem('marketa_review_tokens') || '[]');
    this.reports = JSON.parse(localStorage.getItem('marketa_reports') || '[]');
    this.appeals = JSON.parse(localStorage.getItem('marketa_appeals') || '[]');
    this.currentUserId = localStorage.getItem('marketa_current_user_id') || '';
    this.purgeFakeData();
    this.save();
  }

  /** Strip any leftover fake seed data from localStorage */
  private purgeFakeData() {
    this.users = this.users.filter(u => !this.fakeUserIds.includes(u.id));
    this.listings = this.listings.filter(l => !this.fakeListingIds.includes(l.id) && !this.fakeUserIds.includes(l.seller_id));
    this.conversations = this.conversations.filter(c => !this.fakeConvIds.includes(c.id) && !this.fakeUserIds.includes(c.buyer_id) && !this.fakeUserIds.includes(c.seller_id));
    this.messages = this.messages.filter(m => !this.fakeMsgIds.includes(m.id) && !this.fakeUserIds.includes(m.sender_id));
    if (this.fakeUserIds.includes(this.currentUserId)) {
      this.currentUserId = '';
    }
  }

  private save() {
    localStorage.setItem('marketa_users', JSON.stringify(this.users));
    localStorage.setItem('marketa_listings', JSON.stringify(this.listings));
    localStorage.setItem('marketa_conversations', JSON.stringify(this.conversations));
    localStorage.setItem('marketa_messages', JSON.stringify(this.messages));
    localStorage.setItem('marketa_reviews', JSON.stringify(this.reviews));
    localStorage.setItem('marketa_review_tokens', JSON.stringify(this.reviewTokens));
    localStorage.setItem('marketa_reports', JSON.stringify(this.reports));
    localStorage.setItem('marketa_appeals', JSON.stringify(this.appeals));
    localStorage.setItem('marketa_current_user_id', this.currentUserId);
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  // --- USER API ---
  public getUsers(): Profile[] {
    return this.users;
  }

  public getCurrentUser(): Profile {
    if (!this.currentUserId) return GUEST_PROFILE;
    return this.users.find(u => u.id === this.currentUserId) || GUEST_PROFILE;
  }

  public getCurrentUserOrNull(): Profile | null {
    if (!this.currentUserId) return null;
    return this.users.find(u => u.id === this.currentUserId) || null;
  }

  public setCurrentUser(userId: string) {
    this.currentUserId = userId;
    this.save();
  }

  public clearCurrentUser() {
    this.currentUserId = '';
    localStorage.removeItem('marketa_current_user_id');
    this.notify();
  }

  public upsertUser(profile: Profile) {
    const idx = this.users.findIndex(u => u.id === profile.id);
    if (idx >= 0) {
      this.users[idx] = profile;
    } else {
      this.users.push(profile);
    }
    this.save();
  }

  public async updateNationalIdVerification(
    userId: string,
    data: {
      idFrontUrl: string;
      idBackUrl: string;
      selfieUrl: string;
      idFrontCapturedAt: string;
      idBackCapturedAt: string;
      selfieCapturedAt: string;
      ocrFields: any;
      ocrRawText?: string;
      ocrConfidence?: any;
      faceMatchScore: number;
      faceMatchStatus: FaceMatchStatus;
      verificationStatus: VerificationStatus;
      livenessCheckPassed?: boolean;
      livenessChallengeType?: string | null;
      qrPayload?: string | null;
      qrExtractedAt?: string | null;
      qrImageDataUrl?: string | null;
    }
  ) {
    this.users = this.users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          id_type: 'National ID' as const,
          id_document_url: data.idFrontUrl,
          id_front_url: data.idFrontUrl,
          id_back_url: data.idBackUrl,
          selfie_url: data.selfieUrl,
          id_front_captured_at: data.idFrontCapturedAt,
          id_back_captured_at: data.idBackCapturedAt,
          selfie_captured_at: data.selfieCapturedAt,
          id_number: data.ocrFields.id_number || u.id_number,
          full_name: data.ocrFields.full_name || u.full_name,
          ocr_fields: data.ocrFields,
          ocr_raw_text: data.ocrRawText,
          ocr_confidence: data.ocrConfidence,
          face_match_score: data.faceMatchScore,
          face_match_status: data.faceMatchStatus,
          verification_status: data.verificationStatus,
          liveness_check_passed: data.livenessCheckPassed,
          liveness_challenge_type: data.livenessChallengeType,
          qr_payload: data.qrPayload ?? u.qr_payload,
          qr_extracted_at: data.qrExtractedAt ?? u.qr_extracted_at,
          qr_image_data_url: data.qrImageDataUrl ?? u.qr_image_data_url
        };
      }
      return u;
    });
    this.save();
    const { error } = await supabase.from('profiles').update({
      verification_status: data.verificationStatus,
      face_match_score: data.faceMatchScore,
      face_match_status: data.faceMatchStatus,
      liveness_check_passed: data.livenessCheckPassed ?? null,
      liveness_challenge_type: data.livenessChallengeType ?? null,
      qr_payload: data.qrPayload ?? null,
      qr_extracted_at: data.qrExtractedAt ?? null,
      qr_image_data_url: data.qrImageDataUrl ?? null,
      id_front_url: data.idFrontUrl,
      id_back_url: data.idBackUrl,
      selfie_url: data.selfieUrl,
      ocr_fields: data.ocrFields,
      ocr_raw_text: data.ocrRawText ?? null
    }).eq('id', userId);
    if (error) console.error('Supabase updateNationalIdVerification error:', error.message);
  }

  public updateEverifyStatus(
    userId: string,
    status: EverifyStatus,
    notes?: string
  ) {
    this.users = this.users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          everify_status: status,
          everify_notes: notes || null
        };
      }
      return u;
    });
    this.save();
  }

  public updateProfileVerification(userId: string, status: VerificationStatus, docUrl?: string, docType?: 'National ID', docNumber?: string) {
    this.users = this.users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          verification_status: status,
          id_document_url: docUrl || u.id_document_url,
          id_type: docType || u.id_type,
          id_number: docNumber || u.id_number
        };
      }
      return u;
    });
    this.save();
    void supabase.from('profiles').update({ verification_status: status }).eq('id', userId);
  }

  public updateProfileFaceMatch(
    userId: string,
    selfieUrl: string,
    score: number,
    status: FaceMatchStatus,
    verificationStatus: VerificationStatus,
    docUrl?: string,
    docType?: 'National ID',
    docNumber?: string
  ) {
    this.users = this.users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          selfie_url: selfieUrl,
          face_match_score: score,
          face_match_status: status,
          verification_status: verificationStatus,
          id_document_url: docUrl || u.id_document_url,
          id_type: docType || u.id_type,
          id_number: docNumber || u.id_number
        };
      }
      return u;
    });
    this.save();
  }

  // --- LISTINGS API ---
  public getListings(): Listing[] {
    return this.listings.map(listing => {
      const seller = this.users.find(u => u.id === listing.seller_id);
      return { ...listing, seller };
    });
  }

  public addListing(newListing: Omit<Listing, 'id' | 'created_at' | 'status'>): Listing {
    const created: Listing = {
      ...newListing,
      id: `lst_${Date.now()}`,
      status: 'active',
      created_at: new Date().toISOString()
    };
    this.listings = [created, ...this.listings];
    this.save();
    return created;
  }

  public updateListingStatus(listingId: string, status: 'active' | 'pending_deal' | 'sold', buyerId?: string) {
    this.listings = this.listings.map(l => l.id === listingId ? { ...l, status, buyer_id: buyerId ?? l.buyer_id } : l);
    this.save();
  }

  public getListingById(listingId: string): Listing | undefined {
    const raw = this.listings.find(l => l.id === listingId);
    if (!raw) return undefined;
    const seller = this.users.find(u => u.id === raw.seller_id);
    return { ...raw, seller };
  }

  public getConversationsForListing(listingId: string): Conversation[] {
    return this.conversations
      .filter(c => c.listing_id === listingId)
      .map(c => this.populateConversation(c));
  }

  // --- TRANSACTIONS API ---
  public getTransactionsForUser(userId: string): Conversation[] {
    return this.conversations
      .filter(c => (c.buyer_id === userId || c.seller_id === userId) && (c.status === 'marked_done' || c.status === 'completed'))
      .map(c => this.populateConversation(c));
  }

  public confirmTransaction(convId: string) {
    this.conversations = this.conversations.map(c => {
      if (c.id === convId) {
        const listing = this.listings.find(l => l.id === c.listing_id);
        if (listing) {
          this.listings = this.listings.map(l => l.id === listing.id ? { ...l, status: 'sold' } : l);
        }
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const now = new Date().toISOString();
        this.reviewTokens.push(
          {
            id: `rtok_${Date.now()}_buyer`,
            conversation_id: convId,
            reviewer_id: c.buyer_id,
            reviewee_id: c.seller_id,
            listing_id: c.listing_id,
            expires_at: expiresAt,
            used: false,
            created_at: now
          },
          {
            id: `rtok_${Date.now()}_seller`,
            conversation_id: convId,
            reviewer_id: c.seller_id,
            reviewee_id: c.buyer_id,
            listing_id: c.listing_id,
            expires_at: expiresAt,
            used: false,
            created_at: now
          }
        );
        return { ...c, status: 'completed' as TransactionStatus, updated_at: now, review_window_expires_at: expiresAt };
      }
      return c;
    });
    this.save();
  }

  // --- REVIEW TOKENS API ---
  public getValidReviewTokensForUser(userId: string, otherUserId?: string): ReviewToken[] {
    const now = new Date().toISOString();
    return this.reviewTokens.filter(t =>
      t.reviewer_id === userId &&
      !t.used &&
      t.expires_at > now &&
      (otherUserId ? t.reviewee_id === otherUserId : true)
    );
  }

  public getValidReviewTokenForTransaction(userId: string, convId: string): ReviewToken | undefined {
    const now = new Date().toISOString();
    return this.reviewTokens.find(t =>
      t.reviewer_id === userId &&
      t.conversation_id === convId &&
      !t.used &&
      t.expires_at > now
    );
  }

  public markReviewTokenUsed(tokenId: string) {
    this.reviewTokens = this.reviewTokens.map(t =>
      t.id === tokenId ? { ...t, used: true } : t
    );
    this.save();
  }

  // --- REVIEWS API ---
  public addReview(
    listingId: string,
    reviewerId: string,
    revieweeId: string,
    rating: number,
    tags: ReviewTag[],
    comment: string,
    title?: string,
    tokenId?: string
  ): Review | null {
    const token = this.reviewTokens.find(t => t.id === tokenId);
    if (tokenId && (!token || token.used || token.expires_at <= new Date().toISOString())) {
      return null;
    }
    const review: Review = {
      id: `rev_${Date.now()}`,
      listing_id: listingId,
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      rating,
      tags,
      title,
      comment,
      created_at: new Date().toISOString()
    };
    this.reviews.push(review);
    if (tokenId) this.markReviewTokenUsed(tokenId);
    this.save();
    this.checkAndApplyRestriction(revieweeId);
    return review;
  }

  public getRatingDistribution(userId: string): { [star: number]: number } {
    const reviews = this.getReviewsForUser(userId);
    const dist: { [star: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating]++; });
    return dist;
  }

  public getReviewsForUser(userId: string): Review[] {
    return this.reviews.filter(r => r.reviewee_id === userId);
  }

  public getAverageRating(userId: string): { average: number; count: number } {
    const reviews = this.getReviewsForUser(userId);
    if (reviews.length === 0) return { average: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return { average: sum / reviews.length, count: reviews.length };
  }

  public getReviewById(reviewId: string): Review | undefined {
    return this.reviews.find(r => r.id === reviewId);
  }

  public hasUserReviewedListing(userId: string, listingId: string, otherPartyId: string): boolean {
    return this.reviews.some(
      r => r.reviewer_id === userId && r.listing_id === listingId && r.reviewee_id === otherPartyId
    );
  }

  // --- REPORTS API ---
  public addReport(reviewId: string, reporterId: string, reason: string): Report {
    const report: Report = {
      id: `rpt_${Date.now()}`,
      review_id: reviewId,
      reporter_id: reporterId,
      reason,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    this.reports.push(report);
    this.save();
    return report;
  }

  public getReports(): Report[] {
    return this.reports.map(r => {
      const review = this.reviews.find(rev => rev.id === r.review_id);
      return { ...r, review };
    }) as any;
  }

  public updateReportStatus(reportId: string, status: 'resolved' | 'dismissed', resolvedBy: string) {
    this.reports = this.reports.map(r => {
      if (r.id === reportId) {
        return {
          ...r,
          status,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy
        };
      }
      return r;
    });
    this.save();
  }

  public getUpheldReportsForUser(userId: string): number {
    const reviewedUserReviewIds = this.reviews
      .filter(r => r.reviewee_id === userId)
      .map(r => r.id);
    return this.reports.filter(
      r => reviewedUserReviewIds.includes(r.review_id) && r.status === 'resolved'
    ).length;
  }

  // --- APPEALS API ---
  public addAppeal(userId: string, reason: string): Appeal {
    const appeal: Appeal = {
      id: `apl_${Date.now()}`,
      user_id: userId,
      reason,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    this.appeals.push(appeal);
    this.save();
    return appeal;
  }

  public getAppeals(): Appeal[] {
    return this.appeals;
  }

  public getPendingAppealForUser(userId: string): Appeal | undefined {
    return this.appeals.find(a => a.user_id === userId && a.status === 'pending');
  }

  public getApprovedAppealForUser(userId: string): Appeal | undefined {
    return this.appeals.find(a => a.user_id === userId && a.status === 'approved');
  }

  public updateAppealStatus(appealId: string, status: 'approved' | 'denied', resolvedBy: string) {
    this.appeals = this.appeals.map(a => {
      if (a.id === appealId) {
        return {
          ...a,
          status,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy
        };
      }
      return a;
    });
    this.save();
  }

  // --- RESTRICTION API ---
  public restrictUser(userId: string, reason: string) {
    this.users = this.users.map(u => {
      if (u.id === userId) {
        return { ...u, is_restricted: true, restriction_reason: reason };
      }
      return u;
    });
    this.save();
  }

  public reinstateUser(userId: string) {
    this.users = this.users.map(u => {
      if (u.id === userId) {
        return { ...u, is_restricted: false, restriction_reason: null };
      }
      return u;
    });
    this.save();
  }

  // --- AUTO-FLAG LOGIC ---
  public checkAndApplyRestriction(userId: string) {
    const reviews = this.getReviewsForUser(userId);
    const avgRating = reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;
    const upheldReports = this.getUpheldReportsForUser(userId);

    if (upheldReports >= 3) {
      this.restrictUser(userId, `Auto-flagged: ${upheldReports} upheld reports`);
      return;
    }

    if (reviews.length >= 5 && avgRating < 2.0) {
      this.restrictUser(userId, `Auto-flagged: ${reviews.length} reviews averaging ${avgRating.toFixed(1)}`);
      return;
    }
  }

  // --- CONVERSATIONS & MESSAGING API ---
  public getConversationsForUser(userId: string): Conversation[] {
    return this.conversations
      .filter(c => c.buyer_id === userId || c.seller_id === userId)
      .map(c => this.populateConversation(c));
  }

  public getAllConversations(): Conversation[] {
    return this.conversations.map(c => this.populateConversation(c));
  }

  public getConversationById(id: string): Conversation | undefined {
    const raw = this.conversations.find(c => c.id === id);
    if (!raw) return undefined;
    return this.populateConversation(raw);
  }

  private populateConversation(c: Conversation): Conversation {
    const listingRaw = this.listings.find(l => l.id === c.listing_id);
    const seller = this.users.find(u => u.id === (listingRaw?.seller_id || c.seller_id));
    const listing = listingRaw ? { ...listingRaw, seller } : undefined;
    const buyer = this.users.find(u => u.id === c.buyer_id);

    return {
      ...c,
      listing,
      buyer,
      seller
    };
  }

  public startOrCreateConversation(listingId: string, buyerId: string): Conversation {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) throw new Error('Listing not found');

    const existing = this.conversations.find(
      c => c.listing_id === listingId && c.buyer_id === buyerId
    );
    if (existing) {
      return this.populateConversation(existing);
    }

    const created: Conversation = {
      id: `conv_${Date.now()}`,
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      status: 'in_discussion',
      buyer_chat_consent: false,
      seller_chat_consent: false,
      dispute_status: 'none',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.conversations = [created, ...this.conversations];
    this.save();
    return this.populateConversation(created);
  }

  public getMessagesForConversation(convId: string): Message[] {
    const msgs = this.messages.filter(m => m.conversation_id === convId);
    return msgs.map(m => {
      const sender = this.users.find(u => u.id === m.sender_id);
      let reply_to: Message | undefined;
      if (m.reply_to_id) {
        const replyTarget = this.messages.find(rm => rm.id === m.reply_to_id);
        if (replyTarget) {
          reply_to = {
            ...replyTarget,
            sender: this.users.find(u => u.id === replyTarget.sender_id)
          };
        }
      }
      return {
        ...m,
        sender,
        reply_to
      };
    });
  }

  public sendMessage(
    conversationId: string,
    senderId: string,
    text: string,
    imageUrl?: string,
    replyToId?: string
  ): Message {
    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      conversation_id: conversationId,
      sender_id: senderId,
      text,
      image_url: imageUrl,
      reply_to_id: replyToId,
      created_at: new Date().toISOString()
    };

    this.messages.push(newMsg);
    this.conversations = this.conversations.map(c =>
      c.id === conversationId ? { ...c, updated_at: new Date().toISOString() } : c
    );
    this.save();
    return newMsg;
  }

  public editMessage(messageId: string, newText: string) {
    this.messages = this.messages.map(m =>
      m.id === messageId ? { ...m, text: newText, is_edited: true } : m
    );
    this.save();
  }

  public deleteMessage(messageId: string) {
    this.messages = this.messages.map(m =>
      m.id === messageId ? { ...m, is_deleted: true, text: 'This message was removed' } : m
    );
    this.save();
  }

  public updateTransactionStatus(convId: string, status: TransactionStatus) {
    this.conversations = this.conversations.map(c => {
      if (c.id === convId) {
        return { ...c, status, updated_at: new Date().toISOString() };
      }
      return c;
    });
    this.save();
  }

  public setChatConsent(convId: string, userRole: 'buyer' | 'seller', consent: boolean) {
    this.conversations = this.conversations.map(c => {
      if (c.id === convId) {
        const buyerConsent = userRole === 'buyer' ? consent : c.buyer_chat_consent;
        const sellerConsent = userRole === 'seller' ? consent : c.seller_chat_consent;
        
        let dispute_status = c.dispute_status;
        if (buyerConsent && sellerConsent) {
          dispute_status = 'under_review';
        } else if (buyerConsent || sellerConsent) {
          dispute_status = 'pending_dual_consent';
        } else {
          dispute_status = 'none';
        }

        return {
          ...c,
          buyer_chat_consent: buyerConsent,
          seller_chat_consent: sellerConsent,
          dispute_status,
          updated_at: new Date().toISOString()
        };
      }
      return c;
    });
    this.save();
  }

  public resolveDispute(convId: string) {
    this.conversations = this.conversations.map(c => {
      if (c.id === convId) {
        return {
          ...c,
          dispute_status: 'resolved',
          updated_at: new Date().toISOString()
        };
      }
      return c;
    });
    this.save();
  }

  public resetToDefault() {
    this.users = [];
    this.listings = [];
    this.conversations = [];
    this.messages = [];
    this.reviews = [];
    this.reviewTokens = [];
    this.reports = [];
    this.appeals = [];
    this.currentUserId = '';
    this.save();
  }
}

export const store = new MarketplaceStore();

// --- PUBLIC LISTINGS QUERY (Tier 1 landing page) ---
export async function fetchPublicListings(): Promise<Listing[]> {
  try {
    const { data, error } = await supabase
      .from('listing_previews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      console.warn('fetchPublicListings error:', error.message);
      return [];
    }

    return (data || []).map((item: any) => ({
      ...item,
      seller_id: '',
      description: '',
      status: 'active' as const
    })) as Listing[];
  } catch (err) {
    console.warn('fetchPublicListings exception:', err);
    return [];
  }
}

// --- REAL SUPABASE AUTH HELPERS ---

/**
 * Sign up with email + password. Inserts a profiles row on success.
 * Returns the new Profile synced into the local store, or an error string.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<{ user: Profile | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });

  if (error) {
    return { user: null, error: error.message };
  }

  const authUser = data.user;
  if (!authUser) {
    return { user: null, error: 'Sign-up succeeded but no user returned.' };
  }

  // Insert profile row (verification_status defaults to 'unverified' in DB)
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;
  const { error: insertError } = await supabase.from('profiles').insert({
    id: authUser.id,
    full_name: fullName,
    avatar_url: avatarUrl
  });

  // Ignore duplicate-key errors (user refreshed / already inserted)
  if (insertError && !insertError.message.includes('duplicate')) {
    console.warn('Profile insert warning:', insertError.message);
  }

  const profile: Profile = {
    id: authUser.id,
    email: authUser.email ?? email,
    full_name: fullName,
    avatar_url: avatarUrl,
    verification_status: 'unverified',
    role: 'user',
    created_at: authUser.created_at
  };

  store.upsertUser(profile);
  store.setCurrentUser(profile.id);
  return { user: profile, error: null };
}

/**
 * Sign in with email + password.
 * Fetches the profile row from Supabase, syncs into local store.
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: Profile | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { user: null, error: error.message };
  }

  const authUser = data.user;
  if (!authUser) {
    return { user: null, error: 'Login succeeded but no user returned.' };
  }

  // Fetch profile row (maybeSingle so no error if missing)
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  // Auto-create profile row if missing (user created via Supabase dashboard)
  if (!profileRow) {
    const fullName = authUser.user_metadata?.full_name ?? email.split('@')[0];
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;
    const roleFromMeta: string | undefined = authUser.user_metadata?.role;
    const newRole = roleFromMeta === 'admin' ? 'admin' : 'user';

    await supabase.from('profiles').insert({
      id: authUser.id,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: newRole
    }).maybeSingle();

    const profile: Profile = {
      id: authUser.id,
      email: authUser.email ?? email,
      full_name: fullName,
      avatar_url: avatarUrl,
      verification_status: newRole === 'admin' ? 'verified' : 'unverified',
      role: newRole,
      created_at: authUser.created_at
    };

    store.upsertUser(profile);
    store.setCurrentUser(profile.id);
    return { user: profile, error: null };
  }

  const roleFromDb = profileRow.role ?? 'user';
  const verification_status =
    roleFromDb === 'admin'
      ? 'verified'
      : ((profileRow.verification_status ?? 'unverified') as Profile['verification_status']);

  // Merge in localStorage override if more recent (e.g. admin approved on same browser)
  const localUsers: Profile[] = JSON.parse(localStorage.getItem('marketa_users') || '[]');
  const localProfile = localUsers.find((u: Profile) => u.id === authUser.id);
  const mergedStatus = (localProfile && localProfile.verification_status !== 'unverified')
    ? localProfile.verification_status
    : verification_status;

  const profile: Profile = {
    id: authUser.id,
    email: authUser.email ?? email,
    full_name: profileRow.full_name ?? authUser.user_metadata?.full_name ?? email.split('@')[0],
    avatar_url:
      profileRow.avatar_url ??
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
    verification_status: mergedStatus,
    role: roleFromDb,
    created_at: profileRow.created_at ?? authUser.created_at,
    id_front_url: profileRow.id_front_url ?? undefined,
    id_back_url: profileRow.id_back_url ?? undefined,
    face_match_score: profileRow.face_match_score ?? undefined
  };

  store.upsertUser(profile);
  store.setCurrentUser(profile.id);
  return { user: profile, error: null };
}

/**
 * Send a password-reset email.
 */
export async function sendPasswordReset(
  email: string
): Promise<{ error: string | null }> {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Sign the current user out of Supabase and clear local state.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  store.clearCurrentUser();
}

/**
 * Call once at app bootstrap (inside App.tsx useEffect or top-level).
 * Keeps local store in sync when the Supabase session changes.
 */
export function initAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      store.clearCurrentUser();
    } else if (event === 'SIGNED_IN' && session?.user) {
      // If user already in store, just make sure they're set as current
      const existing = store.getUsers().find(u => u.id === session.user.id);
      if (existing) {
        store.setCurrentUser(existing.id);
      }
    }
  });
}

/**
 * Sync all profiles from Supabase into the local store.
 * Used by Admin to surface verification submissions made on other browsers.
 */
export async function syncProfilesFromSupabase(): Promise<void> {
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) { console.warn('syncProfilesFromSupabase error:', error.message); return; }
    if (data) {
      for (const row of data) {
        const profile: Profile = {
          id: row.id,
          email: row.email ?? '',
          full_name: row.full_name ?? '',
          avatar_url: row.avatar_url ?? '',
          verification_status: (row.verification_status ?? 'unverified') as VerificationStatus,
          role: (row.role ?? 'user') as 'user' | 'admin',
          created_at: row.created_at ?? '',
          id_front_url: row.id_front_url ?? undefined,
          id_back_url: row.id_back_url ?? undefined,
          selfie_url: row.selfie_url ?? undefined,
          face_match_score: row.face_match_score ?? undefined,
          face_match_status: (row.face_match_status ?? 'not_run') as FaceMatchStatus
        };
        store.upsertUser(profile);
      }
    }
  } catch (err) {
    console.warn('syncProfilesFromSupabase exception:', err);
  }
}

// ──────────────────────────────────────────────
