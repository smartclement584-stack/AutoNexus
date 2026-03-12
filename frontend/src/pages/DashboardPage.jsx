import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  Plus, 
  Package, 
  MessageSquare, 
  Edit, 
  Trash2, 
  Loader2,
  Store,
  X
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { useAuth } from "../context/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isSeller, getAuthHeader } = useAuth();
  const [parts, setParts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [years, setYears] = useState([]);

  // Register seller state
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerData, setRegisterData] = useState({
    name: "",
    location: "Camp Yabassi, Douala",
    description: "",
    phone: "",
    whatsapp: ""
  });

  // Part form state
  const [partForm, setPartForm] = useState({
    name: "",
    part_number: "",
    description: "",
    category: "",
    brands: [],
    models: [],
    years: [],
    price: "",
    stock: "",
    condition: "new",
    image: ""
  });

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error("Please login to access dashboard");
      navigate("/login");
      return;
    }

    const loadData = async () => {
      try {
        // Load filter options
        const [brandsRes, categoriesRes, yearsRes] = await Promise.all([
          axios.get(`${API}/filters/brands`),
          axios.get(`${API}/filters/categories`),
          axios.get(`${API}/filters/years`)
        ]);
        setBrands(brandsRes.data.brands);
        setCategories(categoriesRes.data.categories);
        setYears(yearsRes.data.years.reverse());

        if (isSeller) {
          // Load seller's parts
          const partsRes = await axios.get(`${API}/seller/parts`, {
            headers: getAuthHeader()
          });
          setParts(partsRes.data.parts);

          // Load open requests
          const requestsRes = await axios.get(`${API}/seller/requests`, {
            headers: getAuthHeader()
          });
          setRequests(requestsRes.data.requests);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isAuthenticated, isSeller, navigate, getAuthHeader]);

  const handleRegisterSeller = async (e) => {
    e.preventDefault();
    if (!registerData.name || !registerData.phone || !registerData.whatsapp) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await axios.post(`${API}/seller/register`, registerData, {
        headers: getAuthHeader()
      });
      toast.success("Registered as seller successfully!");
      setRegisterOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to register");
    }
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    if (!partForm.name || !partForm.part_number || !partForm.price || !partForm.stock) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const data = {
        ...partForm,
        price: parseInt(partForm.price),
        stock: parseInt(partForm.stock)
      };

      if (editingPart) {
        await axios.put(`${API}/seller/parts/${editingPart.id}`, data, {
          headers: getAuthHeader()
        });
        toast.success("Part updated successfully!");
      } else {
        await axios.post(`${API}/seller/parts`, data, {
          headers: getAuthHeader()
        });
        toast.success("Part added successfully!");
      }

      setAddPartOpen(false);
      setEditingPart(null);
      resetPartForm();
      
      // Reload parts
      const partsRes = await axios.get(`${API}/seller/parts`, {
        headers: getAuthHeader()
      });
      setParts(partsRes.data.parts);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save part");
    }
  };

  const handleDeletePart = async (partId) => {
    try {
      await axios.delete(`${API}/seller/parts/${partId}`, {
        headers: getAuthHeader()
      });
      toast.success("Part deleted successfully!");
      setParts(parts.filter(p => p.id !== partId));
    } catch (error) {
      toast.error("Failed to delete part");
    }
  };

  const resetPartForm = () => {
    setPartForm({
      name: "",
      part_number: "",
      description: "",
      category: "",
      brands: [],
      models: [],
      years: [],
      price: "",
      stock: "",
      condition: "new",
      image: ""
    });
  };

  const openEditPart = (part) => {
    setPartForm({
      name: part.name,
      part_number: part.part_number,
      description: part.description || "",
      category: part.category,
      brands: part.brands || [],
      models: part.models || [],
      years: part.years || [],
      price: part.price.toString(),
      stock: part.stock.toString(),
      condition: part.condition,
      image: part.image || ""
    });
    setEditingPart(part);
    setAddPartOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
      </div>
    );
  }

  // Not a seller - show registration
  if (!isSeller) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12" data-testid="dashboard-page">
        <div className="text-center bg-white rounded-2xl border border-gray-200 p-8">
          <Store size={64} className="mx-auto text-gray-300 mb-6" />
          <h1 
            className="text-2xl md:text-3xl font-bold text-gray-900 mb-4"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            Become a Seller on AutoNexus
          </h1>
          <p className="text-gray-500 mb-6">
            Register your shop and start selling spare parts to mechanics and car owners in Camp Yabassi
          </p>

          <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#1a5c38] hover:bg-[#144a2d]" data-testid="register-seller-btn">
                <Store size={18} className="mr-2" />
                Register as Seller
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Register Your Shop</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRegisterSeller} className="space-y-4">
                <div>
                  <Label>Shop Name *</Label>
                  <Input
                    placeholder="Your shop name"
                    value={registerData.name}
                    onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                    data-testid="register-shop-name"
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    placeholder="Camp Yabassi, Douala"
                    value={registerData.location}
                    onChange={(e) => setRegisterData({ ...registerData, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe your shop..."
                    value={registerData.description}
                    onChange={(e) => setRegisterData({ ...registerData, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Phone Number *</Label>
                  <Input
                    placeholder="+237XXXXXXXXX"
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                    data-testid="register-phone"
                  />
                </div>
                <div>
                  <Label>WhatsApp Number *</Label>
                  <Input
                    placeholder="+237XXXXXXXXX"
                    value={registerData.whatsapp}
                    onChange={(e) => setRegisterData({ ...registerData, whatsapp: e.target.value })}
                    data-testid="register-whatsapp"
                  />
                </div>
                <Button type="submit" className="w-full bg-[#1a5c38] hover:bg-[#144a2d]" data-testid="submit-register-btn">
                  Register Shop
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 
            className="text-2xl md:text-3xl font-bold text-gray-900"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            Seller Dashboard
          </h1>
          <p className="text-gray-500">Manage your spare parts inventory</p>
        </div>

        <Dialog open={addPartOpen} onOpenChange={(open) => {
          setAddPartOpen(open);
          if (!open) {
            setEditingPart(null);
            resetPartForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-[#1a5c38] hover:bg-[#144a2d]" data-testid="add-part-btn">
              <Plus size={18} className="mr-2" />
              Add New Part
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPart ? "Edit Part" : "Add New Part"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddPart} className="space-y-4">
              <div>
                <Label>Part Name *</Label>
                <Input
                  placeholder="e.g., Brake Pads Set (Front)"
                  value={partForm.name}
                  onChange={(e) => setPartForm({ ...partForm, name: e.target.value })}
                  data-testid="part-name-input"
                />
              </div>
              <div>
                <Label>Part Number *</Label>
                <Input
                  placeholder="e.g., BP-TY-001"
                  value={partForm.part_number}
                  onChange={(e) => setPartForm({ ...partForm, part_number: e.target.value })}
                  data-testid="part-number-input"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select 
                  value={partForm.category} 
                  onValueChange={(v) => setPartForm({ ...partForm, category: v })}
                >
                  <SelectTrigger data-testid="part-category-select">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Compatible Brands</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {brands.map((brand) => (
                    <Badge
                      key={brand}
                      variant={partForm.brands.includes(brand) ? "default" : "outline"}
                      className={`cursor-pointer ${partForm.brands.includes(brand) ? "bg-[#1a5c38]" : ""}`}
                      onClick={() => {
                        const newBrands = partForm.brands.includes(brand)
                          ? partForm.brands.filter(b => b !== brand)
                          : [...partForm.brands, brand];
                        setPartForm({ ...partForm, brands: newBrands });
                      }}
                    >
                      {brand}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price (FCFA) *</Label>
                  <Input
                    type="number"
                    placeholder="15000"
                    value={partForm.price}
                    onChange={(e) => setPartForm({ ...partForm, price: e.target.value })}
                    data-testid="part-price-input"
                  />
                </div>
                <div>
                  <Label>Stock *</Label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={partForm.stock}
                    onChange={(e) => setPartForm({ ...partForm, stock: e.target.value })}
                    data-testid="part-stock-input"
                  />
                </div>
              </div>
              <div>
                <Label>Condition</Label>
                <Select 
                  value={partForm.condition} 
                  onValueChange={(v) => setPartForm({ ...partForm, condition: v })}
                >
                  <SelectTrigger data-testid="part-condition-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Part description..."
                  value={partForm.description}
                  onChange={(e) => setPartForm({ ...partForm, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label>Image URL</Label>
                <Input
                  placeholder="https://..."
                  value={partForm.image}
                  onChange={(e) => setPartForm({ ...partForm, image: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full bg-[#1a5c38] hover:bg-[#144a2d]" data-testid="save-part-btn">
                {editingPart ? "Update Part" : "Add Part"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="parts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="parts" className="gap-2" data-testid="parts-tab">
            <Package size={16} />
            My Parts ({parts.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2" data-testid="requests-tab">
            <MessageSquare size={16} />
            Part Requests ({requests.length})
          </TabsTrigger>
        </TabsList>

        {/* Parts Tab */}
        <TabsContent value="parts">
          {parts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">No parts added yet</p>
              <Button onClick={() => setAddPartOpen(true)} className="bg-[#1a5c38] hover:bg-[#144a2d]">
                <Plus size={18} className="mr-2" />
                Add Your First Part
              </Button>
            </div>
          ) : (
            <div className="grid gap-4" data-testid="parts-list">
              {parts.map((part) => (
                <div 
                  key={part.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4"
                  data-testid={`dashboard-part-${part.id}`}
                >
                  {/* Image */}
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={part.image || "https://placehold.co/200x200/e5e7eb/9ca3af?text=No+Image"}
                      alt={part.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate">{part.name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{part.part_number}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditPart(part)}
                          data-testid={`edit-part-${part.id}`}
                        >
                          <Edit size={16} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" data-testid={`delete-part-${part.id}`}>
                              <Trash2 size={16} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Part?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{part.name}" from your inventory.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeletePart(part.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="font-mono font-bold text-[#1a5c38]">
                        {part.price?.toLocaleString()} FCFA
                      </span>
                      <Badge variant="secondary" className={part.stock > 10 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                        {part.stock} in stock
                      </Badge>
                      {part.condition === "used" && (
                        <Badge className="bg-yellow-500">Used</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests">
          {requests.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No open requests at the moment</p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="requests-list">
              {requests.map((request) => (
                <div 
                  key={request.id}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                  data-testid={`dashboard-request-${request.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{request.part_name}</h3>
                      <p className="text-sm text-gray-600">
                        {request.vehicle_brand} {request.vehicle_model} {request.vehicle_year}
                      </p>
                      {request.description && (
                        <p className="text-sm text-gray-500 mt-1">{request.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Location: {request.location}
                      </p>
                    </div>
                    {request.urgency === "urgent" && (
                      <Badge variant="destructive">Urgent</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardPage;
