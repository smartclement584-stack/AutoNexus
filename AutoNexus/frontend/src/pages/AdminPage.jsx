import { API } from "../lib/constants";
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Shield, Loader2, Store, Search, Edit, Trash2, Power, PowerOff,
  CheckCircle2, X, Upload, Users, Package, MessageSquare, AlertTriangle,
  UserPlus, ThumbsUp, ThumbsDown, Clock, Download, Boxes, Plus,
  ShieldCheck, ShieldOff
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
  const { isAdmin, getAuthHeader } = useAuth();
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
    image: "", verified: true, active: true
  });

  // Pending seller applications
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(true);

  // Admin: directly create a seller
  const [addSellerOpen, setAddSellerOpen] = useState(false);
  const [addSellerForm, setAddSellerForm] = useState({
    name: "", location: "Camp Yabassi, Douala", description: "", phone: "", whatsapp: "", image: "", verified: true
  });

  // Admin: manage a seller's products
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSeller, setManageSeller] = useState(null);
  const [managedParts, setManagedParts] = useState([]);
  const [managePartForm, setManagePartForm] = useState({
    name: "", part_number: "", category: "", brands: "", models: "", years: "",
    price: "", stock: "", condition: "new", image: ""
  });

  // Admin: manage users (grant/revoke admin)
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);

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

  const loadApplications = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/sellers?approval=pending`, { headers: getAuthHeader() });
      setApplications(res.data.sellers);
    } catch (e) {
      console.error("Failed to load applications:", e);
    } finally {
      setAppsLoading(false);
    }
  }, [getAuthHeader]);

  const loadUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (userSearch) params.set("q", userSearch);
      const res = await axios.get(`${API}/admin/users?${params.toString()}`, { headers: getAuthHeader() });
      setUsers(res.data.users);
    } catch (e) {
      console.error("Failed to load users:", e);
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch, getAuthHeader]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    loadStats();
    loadSellers();
    loadApplications();
    loadUsers();
  }, [isAdmin, loadStats, loadSellers, loadApplications, loadUsers]);

  // Debounced reload of users when searching
  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => { loadUsers(); }, 300);
    return () => clearTimeout(t);
  }, [userSearch, isAdmin, loadUsers]);

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
      active: seller.active ?? true
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

  // ---- Applications: approve / reject ----
  const handleApprove = async (sellerId) => {
    try {
      await axios.post(`${API}/admin/sellers/${sellerId}/approve`, {}, { headers: getAuthHeader() });
      toast.success("Seller approved!");
      loadApplications();
      loadSellers();
      loadStats();
    } catch (error) {
      toast.error("Failed to approve seller");
    }
  };

  const handleReject = async (sellerId) => {
    try {
      await axios.post(`${API}/admin/sellers/${sellerId}/reject`, {}, { headers: getAuthHeader() });
      toast.success("Application rejected");
      loadApplications();
      loadSellers();
      loadStats();
    } catch (error) {
      toast.error("Failed to reject application");
    }
  };

  // ---- Admin: create seller directly (auto-approved, no user account required) ----
  const handleAddSeller = async (e) => {
    e.preventDefault();
    if (!addSellerForm.name || !addSellerForm.phone || !addSellerForm.whatsapp) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      await axios.post(`${API}/admin/sellers`, addSellerForm, { headers: getAuthHeader() });
      toast.success("Seller created!");
      setAddSellerOpen(false);
      setAddSellerForm({ name: "", location: "Camp Yabassi, Douala", description: "", phone: "", whatsapp: "", image: "", verified: true });
      loadSellers();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create seller");
    }
  };

  // ---- Admin: manage any seller's products ----
  const openManage = async (seller) => {
    setManageSeller(seller);
    setManageOpen(true);
    try {
      const res = await axios.get(`${API}/admin/sellers/${seller.id}/parts`, { headers: getAuthHeader() });
      setManagedParts(res.data.parts);
    } catch (error) {
      toast.error("Failed to load products");
    }
  };

  const handleManageAddPart = async (e) => {
    e.preventDefault();
    if (!managePartForm.name || !managePartForm.part_number || !managePartForm.category || !managePartForm.price || !managePartForm.stock) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      const payload = {
        ...managePartForm,
        brands: managePartForm.brands.split(",").map(s => s.trim()).filter(Boolean),
        models: managePartForm.models.split(",").map(s => s.trim()).filter(Boolean),
        years: managePartForm.years.split(",").map(s => s.trim()).filter(Boolean),
        price: parseInt(managePartForm.price, 10),
        stock: parseInt(managePartForm.stock, 10),
      };
      const res = await axios.post(`${API}/admin/sellers/${manageSeller.id}/parts`, payload, { headers: getAuthHeader() });
      setManagedParts(prev => [...prev, res.data]);
      setManagePartForm({ name: "", part_number: "", category: "", brands: "", models: "", years: "", price: "", stock: "", condition: "new", image: "" });
      toast.success("Product added!");
      loadSellers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add product");
    }
  };

  const handleManageDeletePart = async (partId) => {
    try {
      await axios.delete(`${API}/admin/sellers/${manageSeller.id}/parts/${partId}`, { headers: getAuthHeader() });
      setManagedParts(prev => prev.filter(p => p.id !== partId));
      toast.success("Product deleted");
      loadSellers();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const handleDownloadSellerCatalog = async (seller) => {
    try {
      const res = await axios.get(`${API}/admin/sellers/${seller.id}/catalog/pdf`, {
        headers: getAuthHeader(),
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${seller.name.replace(/\s+/g, "_")}_catalog.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to download catalog");
    }
  };

  const handleToggleAdmin = async (targetUser) => {
    try {
      const res = await axios.post(`${API}/admin/users/${targetUser.id}/toggle-admin`, {}, { headers: getAuthHeader() });
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_admin: res.data.is_admin } : u));
      toast.success(res.data.is_admin ? "User promoted to admin" : "Admin rights revoked");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update admin rights");
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="admin-page">
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
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
        <Button className="bg-[#1a5c38] hover:bg-[#144a2d]" onClick={() => setAddSellerOpen(true)} data-testid="add-seller-btn">
          <UserPlus size={18} className="mr-2" />Add Seller
        </Button>
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

      {/* Pending seller applications */}
      {!appsLoading && applications.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 p-4 md:p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} className="text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Pending Applications ({applications.length})
            </h2>
          </div>
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="flex flex-col md:flex-row md:items-center gap-3 border border-amber-100 bg-amber-50/50 rounded-xl p-4">
                <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {app.image ? (
                    <img src={app.image} alt={app.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1a5c38] text-white font-bold text-lg">
                      {app.name?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{app.name}</h3>
                  <p className="text-sm text-gray-500">{app.location}</p>
                  <p className="text-xs text-gray-400">{app.phone} · WhatsApp {app.whatsapp}</p>
                  {app.id_document && (
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">ID / Reg #:</span> {app.id_document}
                    </p>
                  )}
                  {app.description && <p className="text-xs text-gray-400 mt-1">{app.description}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" className="bg-[#1a5c38] hover:bg-[#144a2d]" onClick={() => handleApprove(app.id)}>
                    <ThumbsUp size={14} className="mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-500 border-red-200" onClick={() => handleReject(app.id)}>
                    <ThumbsDown size={14} className="mr-1" />Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
                    {seller.status === "rejected" && (
                      <Badge className="bg-gray-200 text-gray-600 text-xs">Rejected</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{seller.location}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {seller.phone} · {seller.part_count ?? 0} parts · rating {seller.rating?.toFixed(1)}
                  </p>
                </div>

                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => openManage(seller)} data-testid={`manage-products-${seller.id}`}>
                    <Boxes size={14} className="mr-1" />Products
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadSellerCatalog(seller)}>
                    <Download size={14} className="mr-1" />Catalog
                  </Button>
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

      {/* User management */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 mt-8">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-[#1a5c38]" />
            <h2 className="text-lg font-semibold text-gray-900">Users</h2>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name, phone, email"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>

        {usersLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#1a5c38]" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No users found</div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{u.name || "Unnamed user"}</span>
                    {u.is_admin && <Badge className="bg-[#1a5c38] text-white text-xs">Admin</Badge>}
                    {u.role === "seller" && <Badge className="bg-blue-100 text-blue-700 text-xs">Seller</Badge>}
                  </div>
                  <p className="text-xs text-gray-400">{u.phone || u.email || "—"}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleAdmin(u)}
                  className={u.is_admin ? "text-red-500 border-red-200" : "text-[#1a5c38] border-green-200"}
                >
                  {u.is_admin ? (
                    <><ShieldOff size={14} className="mr-1" />Revoke Admin</>
                  ) : (
                    <><ShieldCheck size={14} className="mr-1" />Make Admin</>
                  )}
                </Button>
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
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-500">
              Rating: <span className="font-semibold text-gray-800">{editingSeller?.rating?.toFixed(1) ?? "0.0"}</span>
              {" "}({editingSeller?.rating_count ?? 0} reviews) · {editingSeller?.sales_count ?? 0} sales
              <p className="text-xs text-gray-400 mt-1">Computed automatically from buyer reviews — not editable.</p>
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

      {/* Add seller dialog (admin creates directly, no application needed) */}
      <Dialog open={addSellerOpen} onOpenChange={setAddSellerOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Seller</DialogTitle></DialogHeader>
          <form onSubmit={handleAddSeller} className="space-y-4">
            <div><Label>Shop Name *</Label>
              <Input value={addSellerForm.name} onChange={(e) => setAddSellerForm({ ...addSellerForm, name: e.target.value })} />
            </div>
            <div><Label>Location</Label>
              <Input value={addSellerForm.location} onChange={(e) => setAddSellerForm({ ...addSellerForm, location: e.target.value })} />
            </div>
            <div><Label>Description</Label>
              <Textarea rows={2} value={addSellerForm.description} onChange={(e) => setAddSellerForm({ ...addSellerForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phone *</Label>
                <Input placeholder="+237XXXXXXXXX" value={addSellerForm.phone} onChange={(e) => setAddSellerForm({ ...addSellerForm, phone: e.target.value })} />
              </div>
              <div><Label>WhatsApp *</Label>
                <Input placeholder="+237XXXXXXXXX" value={addSellerForm.whatsapp} onChange={(e) => setAddSellerForm({ ...addSellerForm, whatsapp: e.target.value })} />
              </div>
            </div>
            <div><Label>Image URL</Label>
              <Input placeholder="https://..." value={addSellerForm.image} onChange={(e) => setAddSellerForm({ ...addSellerForm, image: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addSellerForm.verified}
                onChange={(e) => setAddSellerForm({ ...addSellerForm, verified: e.target.checked })} />
              Verified badge
            </label>
            <Button type="submit" className="w-full bg-[#1a5c38] hover:bg-[#144a2d]">Create Seller</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage any seller's products */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Manage Products — {manageSeller?.name}</DialogTitle></DialogHeader>

          <div className="space-y-2 mb-6 max-h-56 overflow-y-auto">
            {managedParts.length === 0 ? (
              <p className="text-sm text-gray-500">No products yet.</p>
            ) : (
              managedParts.map((part) => (
                <div key={part.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{part.name}</p>
                    <p className="text-xs text-gray-400">{part.part_number} · {part.price?.toLocaleString()} FCFA · stock {part.stock}</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-red-500 border-red-200 flex-shrink-0"
                    onClick={() => handleManageDeletePart(part.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleManageAddPart} className="space-y-3 border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-700">Add a product</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label>
                <Input value={managePartForm.name} onChange={(e) => setManagePartForm({ ...managePartForm, name: e.target.value })} />
              </div>
              <div><Label>Part Number *</Label>
                <Input value={managePartForm.part_number} onChange={(e) => setManagePartForm({ ...managePartForm, part_number: e.target.value })} />
              </div>
            </div>
            <div><Label>Category *</Label>
              <Input placeholder="e.g. Brakes, Suspension" value={managePartForm.category}
                onChange={(e) => setManagePartForm({ ...managePartForm, category: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Brands</Label>
                <Input placeholder="Toyota, Kia" value={managePartForm.brands}
                  onChange={(e) => setManagePartForm({ ...managePartForm, brands: e.target.value })} />
              </div>
              <div><Label>Models</Label>
                <Input placeholder="Corolla, Camry" value={managePartForm.models}
                  onChange={(e) => setManagePartForm({ ...managePartForm, models: e.target.value })} />
              </div>
              <div><Label>Years</Label>
                <Input placeholder="2010, 2011" value={managePartForm.years}
                  onChange={(e) => setManagePartForm({ ...managePartForm, years: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Price (FCFA) *</Label>
                <Input type="number" value={managePartForm.price}
                  onChange={(e) => setManagePartForm({ ...managePartForm, price: e.target.value })} />
              </div>
              <div><Label>Stock *</Label>
                <Input type="number" value={managePartForm.stock}
                  onChange={(e) => setManagePartForm({ ...managePartForm, stock: e.target.value })} />
              </div>
              <div><Label>Condition</Label>
                <Input value={managePartForm.condition}
                  onChange={(e) => setManagePartForm({ ...managePartForm, condition: e.target.value })} />
              </div>
            </div>
            <div><Label>Image URL</Label>
              <Input placeholder="https://..." value={managePartForm.image}
                onChange={(e) => setManagePartForm({ ...managePartForm, image: e.target.value })} />
            </div>
            <Button type="submit" className="w-full bg-[#1a5c38] hover:bg-[#144a2d]">
              <Plus size={16} className="mr-2" />Add Product
            </Button>
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
