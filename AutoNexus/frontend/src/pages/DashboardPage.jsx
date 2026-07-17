import { API } from "../lib/constants";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Plus, Package, MessageSquare, Edit, Trash2, Loader2, Store, X,
  Upload, Image as ImageIcon, CheckCircle2, AlertCircle, Car, MapPin, Send, Download
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "../components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/errorMessage";

const DashboardPage = () => {
  // FIX: use stable getAuthHeader from useCallback in AuthContext — no more infinite loops
  const { user, isSeller, getAuthHeader } = useAuth();
  const { t } = useTranslation();
  const [parts, setParts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [years, setYears] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null); // null | "none" | "pending" | "rejected" | "approved"
  const [editShopOpen, setEditShopOpen] = useState(false);
  const [editShopData, setEditShopData] = useState({
    name: "", location: "", description: "", phone: "", whatsapp: "", image: ""
  });
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef(null);
  const sellerFileInputRef = useRef(null);
  const editShopFileInputRef = useRef(null);

  // Seller respond dialog
  const [respondOpen, setRespondOpen] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseForm, setResponseForm] = useState({
    price: "", condition: "new", message: "", available: true
  });

  const [registerData, setRegisterData] = useState({
    name: "", location: "Camp Yabassi, Douala", description: "", phone: "", whatsapp: "", image: "", id_document: ""
  });

  const [partForm, setPartForm] = useState({
    name: "", part_number: "", description: "", category: "",
    brands: [], models: [], years: [], price: "", stock: "", condition: "new", image: ""
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [brandsRes, categoriesRes, yearsRes] = await Promise.all([
          axios.get(`${API}/filters/brands`),
          axios.get(`${API}/filters/categories`),
          axios.get(`${API}/filters/years`)
        ]);
        setBrands(brandsRes.data.brands);
        setCategories(categoriesRes.data.categories);
        setYears(yearsRes.data.years.slice().reverse());

        if (isSeller) {
          const [partsRes, requestsRes, profileRes] = await Promise.all([
            axios.get(`${API}/seller/parts`, { headers: getAuthHeader() }),
            axios.get(`${API}/seller/requests`, { headers: getAuthHeader() }),
            axios.get(`${API}/seller/profile`, { headers: getAuthHeader() })
          ]);
          setParts(partsRes.data.parts);
          setRequests(requestsRes.data.requests);
          setEditShopData({
            name: profileRes.data.name || "",
            location: profileRes.data.location || "",
            description: profileRes.data.description || "",
            phone: profileRes.data.phone || "",
            whatsapp: profileRes.data.whatsapp || "",
            image: profileRes.data.image || ""
          });
        } else {
          const statusRes = await axios.get(`${API}/seller/application-status`, { headers: getAuthHeader() });
          setApplicationStatus(statusRes.data.status);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isSeller, getAuthHeader]);

  // Load the models available for whichever brands are currently checked in the part form,
  // so the seller can mark which models a part fits. Merges results across multiple brands.
  useEffect(() => {
    const loadModelsForBrands = async () => {
      if (partForm.brands.length === 0) {
        setAvailableModels([]);
        return;
      }
      try {
        const results = await Promise.all(
          partForm.brands.map((b) => axios.get(`${API}/filters/models?brand=${encodeURIComponent(b)}`))
        );
        const merged = [...new Set(results.flatMap((r) => r.data.models))];
        setAvailableModels(merged);
        // Drop any previously-selected models that no longer belong to the current brand set
        setPartForm((f) => ({ ...f, models: f.models.filter((m) => merged.includes(m)) }));
      } catch (error) {
        console.error("Error loading models:", error);
      }
    };
    loadModelsForBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partForm.brands]);

  // ---- Image upload (generic — used for part images, seller registration logo, and shop edit logo) ----
  const handleImageUpload = async (file, target = "part") => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setImageUploading(true);
    try {
      const res = await axios.post(`${API}/upload/image`, formData, {
        headers: { ...getAuthHeader(), "Content-Type": "multipart/form-data" }
      });
      const imageUrl = `${process.env.REACT_APP_BACKEND_URL}${res.data.url}`;
      if (target === "seller") {
        setRegisterData(d => ({ ...d, image: imageUrl }));
      } else if (target === "editShop") {
        setEditShopData(d => ({ ...d, image: imageUrl }));
      } else {
        setPartForm(f => ({ ...f, image: imageUrl }));
      }
      toast.success(t("dashboard.toast_image_uploaded"));
    } catch (e) {
      // Uses the real backend reason (e.g. "Image must be under 5MB") via
      // its error_code instead of a generic message -- previously this
      // always showed "Image upload failed" regardless of why, which hid
      // useful, already-computed detail from the user.
      toast.error(getErrorMessage(e, "errors.IMAGE_UPLOAD_FAILED"));
    } finally {
      setImageUploading(false);
    }
  };

  // ---- Register seller ----
  const handleRegisterSeller = async (e) => {
    e.preventDefault();
    if (!registerData.name || !registerData.phone || !registerData.whatsapp || !registerData.id_document) {
      toast.error(t("common.please_fill_required_fields"));
      return;
    }
    try {
      await axios.post(`${API}/seller/register`, registerData, { headers: getAuthHeader() });
      toast.success(t("seller_registration.toast_submitted"));
      setRegisterOpen(false);
      setApplicationStatus("pending");
    } catch (error) {
      toast.error(getErrorMessage(error, "errors.failed_to_submit_application"));
    }
  };

  // ---- Download own catalog as PDF ----
  const handleDownloadCatalog = async () => {
    try {
      const res = await axios.get(`${API}/seller/catalog/pdf`, {
        headers: getAuthHeader(),
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "catalog.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(t("dashboard.toast_catalog_download_failed"));
    }
  };

  // ---- Edit existing shop profile ----
  const handleEditShop = async (e) => {
    e.preventDefault();
    if (!editShopData.name || !editShopData.phone || !editShopData.whatsapp) {
      toast.error(t("common.please_fill_required_fields"));
      return;
    }
    try {
      await axios.put(`${API}/seller/profile`, editShopData, { headers: getAuthHeader() });
      toast.success(t("dashboard.toast_shop_updated"));
      setEditShopOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "errors.failed_to_update_shop"));
    }
  };

  // ---- Add / Edit part ----
  const handleAddPart = async (e) => {
    e.preventDefault();
    if (!partForm.name || !partForm.part_number || !partForm.price || !partForm.stock) {
      toast.error(t("common.please_fill_required_fields"));
      return;
    }
    try {
      const data = { ...partForm, price: parseInt(partForm.price), stock: parseInt(partForm.stock) };
      if (editingPart) {
        await axios.put(`${API}/seller/parts/${editingPart.id}`, data, { headers: getAuthHeader() });
        toast.success(t("dashboard.toast_part_updated"));
      } else {
        await axios.post(`${API}/seller/parts`, data, { headers: getAuthHeader() });
        toast.success(t("dashboard.toast_part_added"));
      }
      setAddPartOpen(false);
      setEditingPart(null);
      resetPartForm();
      const partsRes = await axios.get(`${API}/seller/parts`, { headers: getAuthHeader() });
      setParts(partsRes.data.parts);
    } catch (error) {
      toast.error(getErrorMessage(error, "errors.failed_to_save_part"));
    }
  };

  const handleDeletePart = async (partId) => {
    try {
      await axios.delete(`${API}/seller/parts/${partId}`, { headers: getAuthHeader() });
      toast.success(t("dashboard.toast_part_deleted"));
      setParts(parts.filter(p => p.id !== partId));
    } catch (error) {
      toast.error(getErrorMessage(error, "errors.failed_to_delete_part"));
    }
  };

  const resetPartForm = () => setPartForm({
    name: "", part_number: "", description: "", category: "",
    brands: [], models: [], years: [], price: "", stock: "", condition: "new", image: ""
  });

  const openEditPart = (part) => {
    setPartForm({
      name: part.name, part_number: part.part_number, description: part.description || "",
      category: part.category, brands: part.brands || [], models: part.models || [],
      years: part.years || [], price: part.price.toString(), stock: part.stock.toString(),
      condition: part.condition, image: part.image || ""
    });
    setEditingPart(part);
    setAddPartOpen(true);
  };

  // ---- Seller respond to request ----
  const openRespondDialog = (request) => {
    setRespondingTo(request);
    setResponseForm({ price: "", condition: "new", message: "", available: true });
    setRespondOpen(true);
  };

  const handleRespond = async (e) => {
    e.preventDefault();
    if (!responseForm.price || !responseForm.message) {
      toast.error(t("dashboard.toast_fill_price_message"));
      return;
    }
    try {
      await axios.post(
        `${API}/requests/${respondingTo.id}/respond`,
        { ...responseForm, price: parseInt(responseForm.price), seller_id: user?.seller_id },
        { headers: getAuthHeader() }
      );
      toast.success(t("dashboard.toast_response_sent"));
      setRespondOpen(false);
      // Refresh requests
      const requestsRes = await axios.get(`${API}/seller/requests`, { headers: getAuthHeader() });
      setRequests(requestsRes.data.requests);
    } catch (error) {
      toast.error(getErrorMessage(error, "errors.failed_to_send_response"));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
      </div>
    );
  }

  // ---- Not a seller ----
  if (!isSeller) {
    if (applicationStatus === "pending") {
      return (
        <div className="max-w-2xl mx-auto px-4 py-12" data-testid="dashboard-page">
          <div className="text-center bg-white rounded-2xl border border-gray-200 p-8">
            <AlertCircle size={64} className="mx-auto text-amber-400 mb-6" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              {t("seller_registration.pending_title")}
            </h1>
            <p className="text-gray-500">
              {t("seller_registration.pending_message")}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-12" data-testid="dashboard-page">
        <div className="text-center bg-white rounded-2xl border border-gray-200 p-8">
          <Store size={64} className="mx-auto text-gray-300 mb-6" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            {t("seller_registration.become_seller_title")}
          </h1>
          <p className="text-gray-500 mb-6">
            {t("seller_registration.become_seller_subtitle")}
          </p>
          {applicationStatus === "rejected" && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-left">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                {t("seller_registration.rejected_notice")}
              </p>
            </div>
          )}
          <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#1a5c38] hover:bg-[#144a2d]" data-testid="register-seller-btn">
                <Store size={18} className="mr-2" />{t("seller_registration.register_btn")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("seller_registration.dialog_title")}</DialogTitle></DialogHeader>
              <form onSubmit={handleRegisterSeller} className="space-y-4">
                <div><Label>{t("common.shop_name_label")}</Label>
                  <Input placeholder={t("common.shop_name_placeholder")} value={registerData.name}
                    onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })} />
                </div>
                <div><Label>{t("common.location_label")}</Label>
                  <Input value={registerData.location}
                    onChange={(e) => setRegisterData({ ...registerData, location: e.target.value })} />
                </div>
                <div><Label>{t("common.description_label")}</Label>
                  <Textarea rows={2} value={registerData.description}
                    onChange={(e) => setRegisterData({ ...registerData, description: e.target.value })} />
                </div>
                <div><Label>{t("common.phone_number_label")}</Label>
                  <Input placeholder={t("common.phone_placeholder")} value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })} />
                </div>
                <div><Label>{t("common.whatsapp_number_label")}</Label>
                  <Input placeholder={t("common.phone_placeholder")} value={registerData.whatsapp}
                    onChange={(e) => setRegisterData({ ...registerData, whatsapp: e.target.value })} />
                </div>
                <div><Label>{t("seller_registration.id_document_label")}</Label>
                  <Input placeholder={t("seller_registration.id_document_placeholder")} value={registerData.id_document}
                    onChange={(e) => setRegisterData({ ...registerData, id_document: e.target.value })} />
                  <p className="text-xs text-gray-400 mt-1">
                    {t("seller_registration.id_document_hint")}
                  </p>
                </div>

                {/* Shop logo upload */}
                <div>
                  <Label>{t("common.shop_logo_label")}</Label>
                  <div className="mt-1 space-y-2">
                    {registerData.image ? (
                      <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                        <img src={registerData.image} alt="Shop" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setRegisterData(d => ({ ...d, image: "" }))}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#1a5c38] transition-colors"
                        onClick={() => sellerFileInputRef.current?.click()}
                      >
                        {imageUploading ? (
                          <Loader2 size={24} className="animate-spin text-[#1a5c38]" />
                        ) : (
                          <>
                            <Upload size={24} className="text-gray-400 mb-1" />
                            <p className="text-sm text-gray-500">{t("common.click_to_upload_shop_photo")}</p>
                            <p className="text-xs text-gray-400">{t("common.image_format_hint")}</p>
                          </>
                        )}
                      </div>
                    )}
                    <input ref={sellerFileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files?.[0], "seller")} />
                    <p className="text-xs text-gray-400 text-center">{t("common.or_paste_image_url")}</p>
                    <Input placeholder={t("common.image_url_placeholder")} value={registerData.image}
                      onChange={(e) => setRegisterData({ ...registerData, image: e.target.value })} />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-[#1a5c38] hover:bg-[#144a2d]">{t("seller_registration.submit_btn")}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // ---- Seller dashboard ----
  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="dashboard-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            {t("dashboard.title")}
          </h1>
          <p className="text-gray-500">{t("dashboard.subtitle")}</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleDownloadCatalog} data-testid="download-catalog-btn">
            <Download size={18} className="mr-2" />{t("dashboard.download_catalog_btn")}
          </Button>
          {/* Edit Shop Dialog */}
          <Dialog open={editShopOpen} onOpenChange={setEditShopOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="edit-shop-btn">
                <Edit size={18} className="mr-2" />{t("dashboard.edit_shop_btn")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("dashboard.edit_shop_dialog_title")}</DialogTitle></DialogHeader>
              <form onSubmit={handleEditShop} className="space-y-4">
                <div><Label>{t("common.shop_name_label")}</Label>
                  <Input placeholder={t("common.shop_name_placeholder")} value={editShopData.name}
                    onChange={(e) => setEditShopData({ ...editShopData, name: e.target.value })} />
                </div>
                <div><Label>{t("common.location_label")}</Label>
                  <Input value={editShopData.location}
                    onChange={(e) => setEditShopData({ ...editShopData, location: e.target.value })} />
                </div>
                <div><Label>{t("common.description_label")}</Label>
                  <Textarea rows={2} value={editShopData.description}
                    onChange={(e) => setEditShopData({ ...editShopData, description: e.target.value })} />
                </div>
                <div><Label>{t("common.phone_number_label")}</Label>
                  <Input placeholder={t("common.phone_placeholder")} value={editShopData.phone}
                    onChange={(e) => setEditShopData({ ...editShopData, phone: e.target.value })} />
                </div>
                <div><Label>{t("common.whatsapp_number_label")}</Label>
                  <Input placeholder={t("common.phone_placeholder")} value={editShopData.whatsapp}
                    onChange={(e) => setEditShopData({ ...editShopData, whatsapp: e.target.value })} />
                </div>

                {/* Shop logo upload */}
                <div>
                  <Label>{t("common.shop_logo_label")}</Label>
                  <div className="mt-1 space-y-2">
                    {editShopData.image ? (
                      <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                        <img src={editShopData.image} alt="Shop" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setEditShopData(d => ({ ...d, image: "" }))}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#1a5c38] transition-colors"
                        onClick={() => editShopFileInputRef.current?.click()}
                      >
                        {imageUploading ? (
                          <Loader2 size={24} className="animate-spin text-[#1a5c38]" />
                        ) : (
                          <>
                            <Upload size={24} className="text-gray-400 mb-1" />
                            <p className="text-sm text-gray-500">{t("common.click_to_upload_shop_photo")}</p>
                            <p className="text-xs text-gray-400">{t("common.image_format_hint")}</p>
                          </>
                        )}
                      </div>
                    )}
                    <input ref={editShopFileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files?.[0], "editShop")} />
                    <p className="text-xs text-gray-400 text-center">{t("common.or_paste_image_url")}</p>
                    <Input placeholder={t("common.image_url_placeholder")} value={editShopData.image}
                      onChange={(e) => setEditShopData({ ...editShopData, image: e.target.value })} />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-[#1a5c38] hover:bg-[#144a2d]">{t("common.save_changes")}</Button>
              </form>
            </DialogContent>
          </Dialog>

        {/* Add Part Dialog */}
        <Dialog open={addPartOpen} onOpenChange={(open) => {
          setAddPartOpen(open);
          if (!open) { setEditingPart(null); resetPartForm(); }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-[#1a5c38] hover:bg-[#144a2d]" data-testid="add-part-btn">
              <Plus size={18} className="mr-2" />{t("dashboard.add_part_btn")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingPart ? t("dashboard.edit_part_dialog_title") : t("dashboard.add_part_dialog_title")}</DialogTitle></DialogHeader>
            <form onSubmit={handleAddPart} className="space-y-4">
              <div><Label>{t("dashboard.part_name_label")}</Label>
                <Input placeholder={t("dashboard.part_name_placeholder")} value={partForm.name}
                  onChange={(e) => setPartForm({ ...partForm, name: e.target.value })} />
              </div>
              <div><Label>{t("dashboard.part_number_label")}</Label>
                <Input placeholder={t("dashboard.part_number_placeholder")} value={partForm.part_number}
                  onChange={(e) => setPartForm({ ...partForm, part_number: e.target.value })} />
              </div>
              <div>
                <Label>{t("dashboard.category_label")}</Label>
                <Select value={partForm.category} onValueChange={(v) => setPartForm({ ...partForm, category: v })}>
                  <SelectTrigger><SelectValue placeholder={t("dashboard.category_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("dashboard.compatible_brands_label")}</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {brands.map((brand) => (
                    <Badge key={brand}
                      variant={partForm.brands.includes(brand) ? "default" : "outline"}
                      className={`cursor-pointer ${partForm.brands.includes(brand) ? "bg-[#1a5c38]" : ""}`}
                      onClick={() => {
                        const nb = partForm.brands.includes(brand)
                          ? partForm.brands.filter(b => b !== brand)
                          : [...partForm.brands, brand];
                        setPartForm({ ...partForm, brands: nb });
                      }}>
                      {brand}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t("dashboard.compatible_models_label")}</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {partForm.brands.length === 0 ? (
                    <p className="text-xs text-gray-400">{t("dashboard.select_brand_first_hint")}</p>
                  ) : availableModels.length === 0 ? (
                    <p className="text-xs text-gray-400">{t("dashboard.no_models_found_hint")}</p>
                  ) : (
                    availableModels.map((model) => (
                      <Badge key={model}
                        variant={partForm.models.includes(model) ? "default" : "outline"}
                        className={`cursor-pointer ${partForm.models.includes(model) ? "bg-[#1a5c38]" : ""}`}
                        onClick={() => {
                          const nm = partForm.models.includes(model)
                            ? partForm.models.filter(m => m !== model)
                            : [...partForm.models, model];
                          setPartForm({ ...partForm, models: nm });
                        }}>
                        {model}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <Label>{t("dashboard.compatible_years_label")}</Label>
                <div className="flex flex-wrap gap-2 mt-1 max-h-28 overflow-y-auto">
                  {years.map((yr) => (
                    <Badge key={yr}
                      variant={partForm.years.includes(yr) ? "default" : "outline"}
                      className={`cursor-pointer ${partForm.years.includes(yr) ? "bg-[#1a5c38]" : ""}`}
                      onClick={() => {
                        const ny = partForm.years.includes(yr)
                          ? partForm.years.filter(y => y !== yr)
                          : [...partForm.years, yr];
                        setPartForm({ ...partForm, years: ny });
                      }}>
                      {yr}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t("dashboard.price_label")}</Label>
                  <Input type="number" placeholder={t("dashboard.price_placeholder")} value={partForm.price}
                    onChange={(e) => setPartForm({ ...partForm, price: e.target.value })} />
                </div>
                <div><Label>{t("dashboard.stock_label")}</Label>
                  <Input type="number" placeholder={t("dashboard.stock_placeholder")} value={partForm.stock}
                    onChange={(e) => setPartForm({ ...partForm, stock: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>{t("common.condition_label")}</Label>
                <Select value={partForm.condition} onValueChange={(v) => setPartForm({ ...partForm, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{t("common.condition_new")}</SelectItem>
                    <SelectItem value="used">{t("common.condition_used")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("common.description_label")}</Label>
                <Textarea rows={2} placeholder={t("dashboard.part_description_placeholder")} value={partForm.description}
                  onChange={(e) => setPartForm({ ...partForm, description: e.target.value })} />
              </div>

              {/* Image upload */}
              <div>
                <Label>{t("dashboard.part_image_label")}</Label>
                <div className="mt-1 space-y-2">
                  {partForm.image ? (
                    <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                      <img src={partForm.image} alt="Part" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setPartForm(f => ({ ...f, image: "" }))}
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
                          <p className="text-sm text-gray-500">{t("dashboard.click_to_upload_image")}</p>
                          <p className="text-xs text-gray-400">{t("common.image_format_hint")}</p>
                        </>
                      )}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                  <p className="text-xs text-gray-400 text-center">{t("common.or_paste_image_url")}</p>
                  <Input placeholder={t("common.image_url_placeholder")} value={partForm.image}
                    onChange={(e) => setPartForm({ ...partForm, image: e.target.value })} />
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#1a5c38] hover:bg-[#144a2d]">
                {editingPart ? t("dashboard.update_part_btn") : t("dashboard.add_part_submit_btn")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Respond to request dialog */}
      <Dialog open={respondOpen} onOpenChange={setRespondOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard.respond_dialog_title")}</DialogTitle>
            {respondingTo && (
              <p className="text-sm text-gray-500">
                {respondingTo.part_name} — {respondingTo.vehicle_brand} {respondingTo.vehicle_model} {respondingTo.vehicle_year}
              </p>
            )}
          </DialogHeader>
          <form onSubmit={handleRespond} className="space-y-4">
            <div><Label>{t("dashboard.your_price_label")}</Label>
              <Input type="number" placeholder={t("dashboard.your_price_placeholder")} value={responseForm.price}
                onChange={(e) => setResponseForm({ ...responseForm, price: e.target.value })} />
            </div>
            <div>
              <Label>{t("common.condition_label")}</Label>
              <Select value={responseForm.condition} onValueChange={(v) => setResponseForm({ ...responseForm, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{t("common.condition_new")}</SelectItem>
                  <SelectItem value="used">{t("common.condition_used")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("dashboard.available_label")}</Label>
              <Select value={responseForm.available ? "yes" : "no"}
                onValueChange={(v) => setResponseForm({ ...responseForm, available: v === "yes" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">{t("dashboard.available_yes")}</SelectItem>
                  <SelectItem value="no">{t("dashboard.available_no")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("dashboard.message_to_buyer_label")}</Label>
              <Textarea rows={3} placeholder={t("dashboard.message_to_buyer_placeholder")}
                value={responseForm.message}
                onChange={(e) => setResponseForm({ ...responseForm, message: e.target.value })} />
            </div>
            <Button type="submit" className="w-full bg-[#1a5c38] hover:bg-[#144a2d]">
              <Send size={16} className="mr-2" />{t("dashboard.send_response_btn")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="parts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="parts" className="gap-2">
            <Package size={16} />{t("dashboard.tab_my_parts", { count: parts.length })}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <MessageSquare size={16} />{t("dashboard.tab_part_requests", { count: requests.length })}
          </TabsTrigger>
        </TabsList>

        {/* Parts Tab */}
        <TabsContent value="parts">
          {parts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">{t("dashboard.no_parts_yet")}</p>
              <Button onClick={() => setAddPartOpen(true)} className="bg-[#1a5c38] hover:bg-[#144a2d]">
                <Plus size={18} className="mr-2" />{t("dashboard.add_first_part_btn")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {parts.map((part) => (
                <div key={part.id} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {part.image ? (
                      <img src={part.image} alt={part.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={24} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate">{part.name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{part.part_number}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditPart(part)}>
                          <Edit size={16} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                              <Trash2 size={16} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("dashboard.delete_part_title")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("dashboard.delete_part_description", { name: part.name })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeletePart(part.id)}
                                className="bg-red-500 hover:bg-red-600">{t("dashboard.delete_btn")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                      <span className="font-mono font-bold text-[#1a5c38]">{part.price?.toLocaleString()} FCFA</span>
                      <Badge variant="secondary" className={part.stock > 10 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                        {t("dashboard.stock_badge", { count: part.stock })}
                      </Badge>
                      {part.condition === "used" && <Badge className="bg-yellow-500">{t("common.condition_used")}</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Requests Tab - with respond button */}
        <TabsContent value="requests">
          {requests.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">{t("dashboard.no_open_requests")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const alreadyResponded = request.responses?.some(r => r.seller_id === user?.seller_id);
                return (
                  <div key={request.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{request.part_name}</h3>
                          {request.urgency === "urgent" && (
                            <Badge className="bg-red-100 text-red-700 text-xs">
                              <AlertCircle size={10} className="mr-1" />{t("dashboard.urgent_badge")}
                            </Badge>
                          )}
                          {alreadyResponded && (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              <CheckCircle2 size={10} className="mr-1" />{t("dashboard.responded_badge")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <Car size={14} />
                          <span>{request.vehicle_brand} {request.vehicle_model} ({request.vehicle_year})</span>
                        </div>
                        {request.description && (
                          <p className="text-sm text-gray-500">{request.description}</p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                          <MapPin size={12} />{request.location}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openRespondDialog(request)}
                        className={alreadyResponded ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-[#1a5c38] hover:bg-[#144a2d] text-white"}
                      >
                        <Send size={14} className="mr-1" />
                        {alreadyResponded ? t("dashboard.respond_again_btn") : t("dashboard.respond_btn")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardPage;
