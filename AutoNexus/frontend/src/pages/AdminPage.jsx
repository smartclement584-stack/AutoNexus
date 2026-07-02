import { API } from "../lib/constants";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  Shield, Loader2, Store, Search, Edit, Trash2, Power, PowerOff,
  CheckCircle2, X, Upload, Users, Package, MessageSquare, AlertTriangle
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "../components/ui/tabs";
import { useAuth } from "../context/AuthContext";

const AdminPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, getAuthHeader } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "", location: "", description: "", phone: "", whatsapp: "",
    image: "", verified: true, active: true, rating: 4.5
  });

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error("Please login to access the admin panel");
      navigate("/login", { state: { from: { pathname: "/admin" } } });
      return;
    }
    if (!isAdmin) {
      toast.error("Admin access required");
      navigate("/");
      return;
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const loadStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/stats`, { headers: getAuthHeader() });
      setStats(res.data);
    } catch (e) {
      console.error("Failed to load stats:", e);
    }
  }, [getAuthHeader]);

  const loadSellers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await axios.get(`${API}/admin/sellers?${params.toString()}`, { headers: getAuthHeader() });
      setSellers(res.data.sellers);
    } catch (e) {
      console.error("Failed to load sellers:", e);
      toast.error("Failed to load sellers");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, getAuthHeader]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    loadStats();
    loadSellers();
  }, [isAdmin, loadStats, loadSellers]);

  const openEdit = (seller) => {
    setEditingSeller(seller);
    setEditForm({
      name: seller.name || "",
      location: seller.location || "",
      description: seller.description || "",
      phone: seller.phone || "",
      whatsapp: seller.whatsapp || "",
      image: seller.image || "",
      verified: seller.verified ?? true,
      active: seller.active ?? true,
      rating: seller.rating ?? 4.5
    });
    setEditOpen(true);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setImageUploading(true);
    try {
      const res = await axios.post(`${API}/upload/image`, formData, {
        headers: { ...getAuthHeader(), "Content-Type": "multipart/form-data" }
      });
      const imageUrl = `${process.env.REACT_APP_BACKEND_URL}${res.data.url}`;
      setEditForm(f => ({ ...f, image: imageUrl }));
      toast.success("Image uploaded!");
    } catch (e) {
      toast.error("Image upload failed");
    } finally {
      setImageUploading(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/admin/sellers/${editingSeller.id}`, editForm, { headers: getAuthHeader() });
      toast.success("Seller updated!");
      setEditOpen(false);
      loadSellers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update seller");
    }
  };

  const handleToggleActive = async (seller) => {
    try {
      const endpoint = seller.active === false ? "activate" : "deactivate";
      await axios.post(`${API}/admin/sellers/${seller.id}/${endpoint}`, {}, { headers: getAuthHeader() });
      toast.success(seller.active === false ? "Seller activated" : "Seller deactivated");
      loadSellers();
      loadStats();
    } catch (error) {
      toast.error("Failed to update seller status");
    }
  };

  const handleDelete = async (sellerId) => {
    try {
      await axios.delete(`${API}/admin/sellers/${sellerId}`, { headers: getAuthHeader() });
      toast.success("Seller deleted");
      setSellers(prev => prev.filter(s => s.id !== sellerId));
      loadStats();
    } catch (error) {
      toast.error("Failed to delete seller");
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="admin-page">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-[#1a5c38] rounded-xl flex items-center justify-center">
          <Shield size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            Admin Panel
          </h1>
          <p className="text-gray-500">Manage all sellers, parts, and platform data</p>
        </div>
      </div>

      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Store} label="Active Sellers" value={stats.active_sellers} sub={`${stats.deactivated_sellers} deactivated`} />
          <StatCard icon={Package} label="Total Parts" value={stats.total_parts} />
          <StatCard icon={MessageSquare} label="Open Requests" value={stats.open_requests} sub={`${stats.total_requests} total`} />
          <StatCard icon={Users} label="Total Users" value={stats.total_users} />
        </div>
      )}

      {/* Seller management */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            All Sellers
          </h2>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search sellers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-56"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Deactivated</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
          </div>
        ) : sellers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No sellers found</div>
        ) : (
          <div className="space-y-3">
            {sellers.map((seller) => (
              <div key={seller.id} className="flex flex-col md:flex-row md:items-center gap-4 border border-gray-100 rounded-xl p-4">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {seller.image ? (
                    <img src={seller.image} alt={seller.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1a5c38] text-white font-bold text-xl">
                      {seller.name?.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-900">{seller.name}</h3>
                    {seller.verified && <CheckCircle2 size={14} className="text-[#1a5c38]" />}
                    {seller.active === false && (
                      <Badge className="bg-red-100 text-red-700 text-xs">Deactivated</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{seller.location}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {seller.phone} · {seller.part_count ?? 0} parts · rating {seller.rating?.toFixed(1)}
                  </p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(seller)}>
                    <Edit size={14} className="mr-1" />Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(seller)}
                    className={seller.active === false ? "text-green-600 border-green-200" : "text-orange-600 border-orange-200"}
                  >
                    {seller.active === false ? (
                      <><Power size={14} className="mr-1" />Activate</>
                    ) : (
                      <><PowerOff size={14} className="mr-1" />Deactivate</>
                    )}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:text-red-600">
                        <Trash2 size={14} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle size={18} className="text-red-500" />
                          Delete "{seller.name}"?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes this seller and all {seller.part_count ?? 0} of their parts.
                          This cannot be undone. Consider deactivating instead if you just want to hide them.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(seller.id)} className="bg-red-500 hover:bg-red-600">
                          Delete Permanently
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit seller dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Seller — {editingSeller?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div><Label>Shop Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div><Label>Location</Label>
              <Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
            </div>
            <div><Label>Description</Label>
              <Textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div><Label>WhatsApp</Label>
                <Input value={editForm.whatsapp} onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })} />
              </div>
            </div>
            <div><Label>Rating</Label>
              <Input type="number" step="0.1" min="0" max="5" value={editForm.rating}
                onChange={(e) => setEditForm({ ...editForm, rating: parseFloat(e.target.value) })} />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.verified}
                  onChange={(e) => setEditForm({ ...editForm, verified: e.target.checked })} />
                Verified badge
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} />
                Active (visible publicly)
              </label>
            </div>

            {/* Image upload */}
            <div>
              <Label>Shop Photo</Label>
              <div className="mt-1 space-y-2">
                {editForm.image ? (
                  <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                    <img src={editForm.image} alt="Shop" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, image: "" }))}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#1a5c38] transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUploading ? (
                      <Loader2 size={24} className="animate-spin text-[#1a5c38]" />
                    ) : (
                      <>
                        <Upload size={24} className="text-gray-400 mb-1" />
                        <p className="text-sm text-gray-500">Click to upload a shop photo</p>
                        <p className="text-xs text-gray-400">JPEG, PNG, WebP — max 5MB</p>
                      </>
                    )}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                <p className="text-xs text-gray-400 text-center">or paste an image URL:</p>
                <Input placeholder="https://..." value={editForm.image}
                  onChange={(e) => setEditForm({ ...editForm, image: e.target.value })} />
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#1a5c38] hover:bg-[#144a2d]">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4">
    <div className="flex items-center gap-2 text-gray-500 mb-2">
      <Icon size={16} />
      <span className="text-sm">{label}</span>
    </div>
    <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {value ?? "—"}
    </p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

export default AdminPage;
