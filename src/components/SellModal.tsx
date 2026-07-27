import React, { useState } from 'react';
import { X, Upload, DollarSign, MapPin, Tag, FileText, Image as ImageIcon } from 'lucide-react';
import type { Category, Profile } from '../types/marketplace';
import { store } from '../lib/supabase';
import { toast } from 'sonner';

interface SellModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile;
  onSuccess?: () => void;
}

const CATEGORIES: Category[] = ['Vehicles', 'Rentals', 'Electronics', 'Clothing', 'Home', 'Toys', 'Sports'];

export const SellModal: React.FC<SellModalProps> = ({ isOpen, onClose, currentUser, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<Category>('Electronics');
  const [location, setLocation] = useState('Seattle, WA');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewFile(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.verification_status !== 'verified' && currentUser.role !== 'admin') {
      toast.error('Identity Verification Required', { description: 'You must verify your ID before creating a listing on Marketa.' });
      return;
    }
    if (!title.trim() || !price || !description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    const finalImage = previewFile || imageUrl || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80';
    store.addListing({
      title: title.trim(), description: description.trim(), price: parseFloat(price),
      category, location: location.trim() || 'Seattle, WA', image_url: finalImage, seller_id: currentUser.id
    });
    toast.success('Item Listed Successfully!', { description: 'Your item is now live on Marketa Marketplace.' });
    setTitle(''); setPrice(''); setDescription(''); setImageUrl(''); setPreviewFile(null);
    if (onSuccess) onSuccess();
    onClose();
  };

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" /> Create New Listing
            </h2>
            <p className="text-xs text-slate-500">Post an item for sale in Marketa Marketplace</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Item Title *</label>
            <input type="text" required placeholder="e.g. Sony WH-1000XM5 Headphones" value={title}
              onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Price ($ USD) *</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="number" min="0" step="0.01" required placeholder="0.00" value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-primary transition cursor-pointer">
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Location / City</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="e.g. Seattle, WA" value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary transition" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">Item Photo *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-lg hover:border-primary bg-slate-50 cursor-pointer transition text-center group">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-primary mb-1" />
                <span className="text-xs text-slate-500 font-medium">Upload Image File</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
              <div className="relative flex flex-col justify-center">
                <div className="relative">
                  <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="url" placeholder="Or paste image URL" value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary transition" />
                </div>
              </div>
            </div>
            {(previewFile || imageUrl) && (
              <div className="relative mt-2 rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-100">
                <img src={previewFile || imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setPreviewFile(null); setImageUrl(''); }}
                  className="absolute top-2 right-2 bg-white/80 text-slate-600 p-1 rounded hover:bg-red-50 hover:text-red-600 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Description *</label>
            <textarea required rows={3} placeholder="Describe condition, specifications, reason for selling..."
              value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition" />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 rounded-lg transition">
              Cancel
            </button>
            <button type="submit"
              className="px-5 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer">
              <FileText className="w-4 h-4" /> Publish Listing
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
