import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Send,
  Image as ImageIcon,
  Reply,
  Edit2,
  Trash2,
  ShieldAlert,
  ChevronRight,
  ShieldCheck,
  X,
  MessageSquare,
  FileCheck
} from 'lucide-react';
import { store } from '../lib/supabase';
import type { Conversation, Message, Profile, TransactionStatus } from '../types/marketplace';
import { toast } from 'sonner';

export const Inbox: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConvId = searchParams.get('convId');

  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());
  const [conversations, setConversations] = useState<Conversation[]>(
    store.getConversationsForUser(currentUser.id)
  );
  const [selectedConv, setSelectedConv] = useState<Conversation | undefined>(
    activeConvId ? store.getConversationById(activeConvId) : conversations[0]
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateStoreData = () => {
      const user = store.getCurrentUser();
      setCurrentUser(user);
      const userConvs = store.getConversationsForUser(user.id);
      setConversations(userConvs);

      const targetId = activeConvId || (userConvs[0] ? userConvs[0].id : null);
      if (targetId) {
        const found = store.getConversationById(targetId);
        setSelectedConv(found);
        if (found) {
          setMessages(store.getMessagesForConversation(found.id));
        }
      } else {
        setSelectedConv(undefined);
        setMessages([]);
      }
    };

    updateStoreData();
    const unsubscribe = store.subscribe(updateStoreData);
    return () => unsubscribe();
  }, [activeConvId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, editingMsgId]);

  const handleSelectConv = (conv: Conversation) => {
    setSearchParams({ convId: conv.id });
    setSelectedConv(conv);
    setMessages(store.getMessagesForConversation(conv.id));
    setReplyTarget(null);
    setEditingMsgId(null);
  };

  const handleImageAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv) return;
    if (!textInput.trim() && !attachedImage) return;

    store.sendMessage(
      selectedConv.id,
      currentUser.id,
      textInput.trim(),
      attachedImage || undefined,
      replyTarget ? replyTarget.id : undefined
    );

    setTextInput('');
    setAttachedImage(null);
    setReplyTarget(null);
  };

  const handleSaveEdit = (msgId: string) => {
    if (!editText.trim()) return;
    store.editMessage(msgId, editText.trim());
    setEditingMsgId(null);
    setEditText('');
    toast.success('Message updated');
  };

  const handleDeleteMessage = (msgId: string) => {
    store.deleteMessage(msgId);
    toast.info('Message un-sent');
  };

  // Transaction Status Stepper
  const handleStatusChangeAttempt = (newStatus: TransactionStatus) => {
    if (!selectedConv) return;
    executeStatusChange(newStatus);
  };

  const executeStatusChange = (newStatus: TransactionStatus) => {
    if (!selectedConv) return;
    store.updateTransactionStatus(selectedConv.id, newStatus);
    toast.success(`Transaction marked as ${newStatus.replace('_', ' ').toUpperCase()}`);
  };

  // Grant Consent
  const handleToggleConsentAttempt = () => {
    if (!selectedConv) return;
    executeToggleConsent();
  };

  const executeToggleConsent = () => {
    if (!selectedConv) return;
    const isBuyer = currentUser.id === selectedConv.buyer_id;
    const currentConsent = isBuyer
      ? selectedConv.buyer_chat_consent
      : selectedConv.seller_chat_consent;

    const newConsent = !currentConsent;
    store.setChatConsent(selectedConv.id, isBuyer ? 'buyer' : 'seller', newConsent);

    toast.success(
      newConsent
        ? 'Consent Granted for Compliance Audit'
        : 'Consent Revoked',
      {
        description: newConsent
          ? 'Dual consent unlocked. Compliance officer can audit transcript.'
          : 'Audit queue requires dual consent.'
      }
    );
  };

  const otherUser = selectedConv
    ? currentUser.id === selectedConv.buyer_id
      ? selectedConv.seller
      : selectedConv.buyer
    : undefined;

  const isBuyer = selectedConv ? currentUser.id === selectedConv.buyer_id : false;

  return (
    <div className="h-[calc(100vh-4rem)] bg-white text-slate-900 flex overflow-hidden">
      {/* LEFT SIDEBAR */}
      <div className="w-full md:w-80 lg:w-96 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" /> Messenger Inbox
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200">
              {conversations.length} Active
            </span>
          </div>
        </div>

        {/* Conversation Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {conversations.length > 0 ? (
            conversations.map((conv) => {
              const isSelected = selectedConv?.id === conv.id;
              const partner = currentUser.id === conv.buyer_id ? conv.seller : conv.buyer;
              const isPartnerVerified = partner?.verification_status === 'verified' || partner?.role === 'admin';

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConv(conv)}
                  className={`w-full p-4 text-left flex items-start gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary/5 border-l-2 border-primary'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={conv.listing?.image_url || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=100&auto=format&fit=crop&q=80'}
                      alt="Listing"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                    />
                    {isPartnerVerified && (
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full" title="Verified Partner">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">
                        {conv.listing?.title || 'Marketplace Item'}
                      </h4>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(conv.updated_at || conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {partner?.full_name || 'Marketplace User'}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        conv.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                           : conv.status === 'marked_done'
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {conv.status.replace('_', ' ').toUpperCase()}
                      </span>

                      {conv.dispute_status === 'under_review' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          AUDIT ACTIVE
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-medium">No messages yet</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col bg-white">
          {/* Header Bar */}
          <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={selectedConv.listing?.image_url}
                alt={selectedConv.listing?.title}
                className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 truncate">
                    {selectedConv.listing?.title}
                  </h3>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    ₱{selectedConv.listing?.price}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Chat with: <strong className="text-slate-700">{otherUser?.full_name}</strong></span>
                  {(otherUser?.verification_status === 'verified' || otherUser?.role === 'admin') && (
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold text-[10px]">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
                Status:
              </span>
              {(['in_discussion', 'marked_done', 'completed'] as TransactionStatus[]).map((st, idx) => {
                const isActive = selectedConv.status === st;
                return (
                  <button
                    key={st}
                    onClick={() => handleStatusChangeAttempt(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200'
                    }`}
                  >
                    <span>
                      {st === 'in_discussion' ? '1. Discussion' : st === 'marked_done' ? '2. Handed Off' : '3. Completed'}
                    </span>
                    {idx < 2 && <ChevronRight className="w-3 h-3 text-slate-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DUAL CONSENT APPEALS BANNER */}
          <div className="bg-slate-50 border-b border-slate-200 p-4">
            <div className="max-w-4xl mx-auto bg-white p-4 rounded-lg border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    Dispute Appeals Protocol & Privacy Dual Consent
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    By default, Marketa chats are private. Both parties must grant consent via Email OTP before Admin audit access is unlocked.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                    <span className={`inline-flex items-center gap-1 font-semibold ${
                      selectedConv.buyer_chat_consent ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                      Buyer Consent: {selectedConv.buyer_chat_consent ? 'Granted' : 'Pending'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className={`inline-flex items-center gap-1 font-semibold ${
                      selectedConv.seller_chat_consent ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                      Seller Consent: {selectedConv.seller_chat_consent ? 'Granted' : 'Pending'}
                    </span>

                    {selectedConv.dispute_status === 'under_review' && (
                      <span className="ml-2 bg-primary text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded">
                        DUAL CONSENT ACTIVE - ADMIN AUDIT READY
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  onClick={handleToggleConsentAttempt}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    (isBuyer ? selectedConv.buyer_chat_consent : selectedConv.seller_chat_consent)
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-primary hover:bg-primary-dark text-white'
                  }`}
                >
                  <FileCheck className="w-4 h-4" />
                  {(isBuyer ? selectedConv.buyer_chat_consent : selectedConv.seller_chat_consent)
                    ? 'Consent Granted'
                    : 'Grant Consent'}
                </button>

                {selectedConv.dispute_status === 'under_review' && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    View in Admin
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* CHAT MESSAGES */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isMine = msg.sender_id === currentUser.id;
              const isEditingThis = editingMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMine && (
                    <img
                      src={msg.sender?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                      alt={msg.sender?.full_name}
                      className="w-7 h-7 rounded-full object-cover border border-slate-200 flex-shrink-0 mb-1"
                    />
                  )}

                  <div className={`max-w-[75%] space-y-1 ${isMine ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 text-[10px] text-slate-400 px-1 ${
                      isMine ? 'justify-end' : 'justify-start'
                    }`}>
                      <span>{msg.sender?.full_name || 'User'}</span>
                      <span>•</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.is_edited && <span className="italic text-slate-400">(edited)</span>}
                    </div>

                    {msg.reply_to && (
                      <div className="bg-slate-50 border-l-2 border-primary px-3 py-1.5 rounded-md text-xs text-slate-500 italic mb-1">
                        <span className="text-[10px] text-primary font-bold block">
                          Replying to {msg.reply_to.sender?.full_name}:
                        </span>
                        <p className="line-clamp-1">{msg.reply_to.text}</p>
                      </div>
                    )}

                    <div
                      className={`group relative p-3 rounded-lg text-sm transition-all ${
                        msg.is_deleted
                          ? 'bg-slate-50 border border-slate-200 text-slate-400 italic'
                          : isMine
                           ? 'bg-primary text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-900 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-sm text-slate-900 focus:border-primary focus:outline-none"
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => setEditingMsgId(null)}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(msg.id)}
                              className="text-xs font-bold text-primary hover:text-primary-dark bg-primary/10 px-2 py-0.5 rounded"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {msg.image_url && !msg.is_deleted && (
                            <div className="mb-2 rounded-lg overflow-hidden max-h-60 border border-slate-200">
                              <img
                                src={msg.image_url}
                                alt="Attachment"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        </>
                      )}

                      {!msg.is_deleted && !isEditingThis && (
                        <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${
                          isMine ? '-left-24' : '-right-24'
                        }`}>
                          <button
                            onClick={() => setReplyTarget(msg)}
                            className="p-1 hover:bg-slate-50 text-slate-400 hover:text-primary rounded"
                            title="Reply"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          {isMine && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingMsgId(msg.id);
                                  setEditText(msg.text);
                                }}
                                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-amber-500 rounded"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-rose-500 rounded"
                                title="Unsend"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CHAT INPUT */}
          <div className="p-4 border-t border-slate-200 bg-white space-y-2">
            {replyTarget && (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-2 text-slate-600 truncate">
                  <Reply className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>Replying to <strong>{replyTarget.sender?.full_name}</strong>: "{replyTarget.text}"</span>
                </div>
                <button onClick={() => setReplyTarget(null)} className="text-slate-400 hover:text-slate-600 p-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {attachedImage && (
              <div className="relative inline-block border border-slate-200 rounded-lg overflow-hidden h-20 w-20 bg-slate-50">
                <img src={attachedImage} alt="Attachment" className="w-full h-full object-cover" />
                <button
                  onClick={() => setAttachedImage(null)}
                  className="absolute top-1 right-1 bg-white/80 text-slate-600 p-0.5 rounded-full hover:bg-rose-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <label className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-primary hover:border-slate-300 transition cursor-pointer">
                <ImageIcon className="w-5 h-5" />
                <input type="file" accept="image/*" onChange={handleImageAttachment} className="hidden" />
              </label>

              <input
                type="text"
                placeholder="Type a message..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary transition"
              />

              <button
                type="submit"
                className="p-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white transition cursor-pointer"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50 p-8 text-center text-slate-400">
          <p className="text-sm">Select a conversation to open messenger view.</p>
        </div>
      )}

    </div>
  );
};
