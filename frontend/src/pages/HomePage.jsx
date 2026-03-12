import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Search, 
  ShieldCheck, 
  Truck, 
  TrendingUp, 
  ChevronRight, 
  Loader2,
  MessageCircle,
  Star,
  CheckCircle,
  Phone,
  MapPin,
  ArrowRight,
  Zap,
  Users,
  Package
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// AutoNexus Logo URL
const LOGO_URL = "https://customer-assets.emergentagent.com/job_parts-marketplace-43/artifacts/h9glnhhs_WhatsApp%20Image%202026-03-12%20at%204.18.13%20PM.jpeg";

// Auto parts images from design guidelines and Unsplash
const PART_IMAGES = {
  suspension: "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400",
  engine: "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400",
  battery: "https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&q=80&w=400",
  brakes: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=400",
  filter: "https://images.unsplash.com/photo-1635784063388-1ff609874cdf?auto=format&fit=crop&q=80&w=400",
  mechanic: "https://images.unsplash.com/photo-1644183230182-85bcf9b0ec5f?auto=format&fit=crop&q=80&w=400",
  car: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=800"
};

const HomePage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [brands, setBrands] = useState([]);
  const [featuredParts, setFeaturedParts] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Seed database first
        await axios.post(`${API}/seed`);
        
        // Load brands
        const brandsRes = await axios.get(`${API}/filters/brands`);
        setBrands(brandsRes.data.brands);
        
        // Load featured parts
        const partsRes = await axios.get(`${API}/parts?limit=8`);
        setFeaturedParts(partsRes.data.parts);
        
        // Load sellers
        const sellersRes = await axios.get(`${API}/sellers?limit=3`);
        setSellers(sellersRes.data.sellers);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedBrand && selectedBrand !== "all") params.set("brand", selectedBrand);
    navigate(`/search?${params.toString()}`);
  };

  const features = [
    {
      icon: ShieldCheck,
      title: "Verified Parts Network",
      description: "All sellers are verified for quality and authenticity",
      color: "bg-emerald-500"
    },
    {
      icon: Search,
      title: "Search Spare Parts",
      description: "Find parts for Japanese & Korean vehicles instantly",
      color: "bg-blue-500"
    },
    {
      icon: TrendingUp,
      title: "Compare Prices",
      description: "Get the best deals from multiple trusted sellers",
      color: "bg-amber-500"
    },
    {
      icon: Truck,
      title: "Fast Delivery",
      description: "Quick delivery within Douala and surrounding areas",
      color: "bg-purple-500"
    }
  ];

  const categories = [
    { name: "Brake Pads", icon: "🔴", count: 45 },
    { name: "Filters", icon: "🔧", count: 78 },
    { name: "Suspension", icon: "⚙️", count: 32 },
    { name: "Engine Parts", icon: "🔩", count: 56 },
    { name: "Electrical", icon: "⚡", count: 41 },
    { name: "Body Parts", icon: "🚗", count: 29 }
  ];

  const howItWorks = [
    {
      step: 1,
      title: "Search for a Part",
      description: "Enter the part name, select your vehicle brand, model, and year to find compatible parts.",
      icon: Search
    },
    {
      step: 2,
      title: "Compare Prices",
      description: "View prices from multiple verified sellers and choose the best deal for your budget.",
      icon: TrendingUp
    },
    {
      step: 3,
      title: "Contact on WhatsApp",
      description: "Instantly connect with the seller on WhatsApp to confirm availability and arrange pickup or delivery.",
      icon: MessageCircle
    }
  ];

  return (
    <div className="min-h-screen bg-white" data-testid="home-page">
      {/* Hero Section - Split Layout */}
      <section className="relative bg-gradient-to-br from-gray-50 via-white to-gray-100 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231a5c38' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left">
              {/* Logo Badge */}
              <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md border border-gray-100 mb-6">
                <img src={LOGO_URL} alt="AutoNexus" className="h-8 w-auto" />
              </div>

              <h1 
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6"
                style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                data-testid="hero-title"
              >
                Digital Automotive
                <span className="block text-[#1a5c38]">Spare Parts Marketplace</span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
                Find spare parts fast in <strong>Camp Yabassi, Cameroon</strong>. 
                Compare prices from verified sellers and contact them instantly on WhatsApp.
              </p>

              {/* Search Form */}
              <form 
                onSubmit={handleSearch} 
                className="bg-white rounded-2xl p-4 md:p-6 shadow-xl border border-gray-100"
                data-testid="search-form"
              >
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <Input
                      type="text"
                      placeholder="Search parts (brake pads, starter motor...)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-14 pl-12 text-gray-900 border-gray-200 rounded-xl text-lg"
                      data-testid="search-input"
                    />
                  </div>
                  <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                    <SelectTrigger className="w-full md:w-48 h-14 text-gray-900 border-gray-200 rounded-xl" data-testid="brand-select">
                      <SelectValue placeholder="Select Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand} value={brand}>
                          {brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="submit" 
                    className="h-14 px-8 bg-[#1a5c38] hover:bg-[#144a2d] rounded-xl text-lg font-semibold"
                    data-testid="search-btn"
                  >
                    <Search size={20} className="mr-2" />
                    Search
                  </Button>
                </div>

                {/* Quick Search Tags */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="text-sm text-gray-500">Popular:</span>
                  {["Brake Pads", "Oil Filter", "Starter Motor", "Battery"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => { setSearchQuery(tag); }}
                      className="text-sm px-3 py-1 bg-gray-100 hover:bg-[#1a5c38]/10 hover:text-[#1a5c38] rounded-full text-gray-600 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </form>

              {/* Stats */}
              <div className="flex justify-center lg:justify-start gap-8 mt-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#1a5c38]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>500+</p>
                  <p className="text-sm text-gray-500">Parts Listed</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#1a5c38]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>50+</p>
                  <p className="text-sm text-gray-500">Verified Sellers</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#1a5c38]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>8</p>
                  <p className="text-sm text-gray-500">Vehicle Brands</p>
                </div>
              </div>
            </div>

            {/* Right Visual - Marketplace Mockup */}
            <div className="hidden lg:block relative">
              {/* Main Dashboard Mockup */}
              <div className="relative">
                {/* Background Car Image */}
                <div className="absolute -top-10 -right-10 w-80 h-80 rounded-full bg-[#1a5c38]/5 blur-3xl" />
                
                {/* Floating Cards */}
                <div className="relative z-10">
                  {/* Product Card 1 */}
                  <div className="absolute -top-4 -left-4 bg-white rounded-xl shadow-2xl p-4 w-64 border border-gray-100 animate-float">
                    <img 
                      src={PART_IMAGES.suspension} 
                      alt="Suspension Link" 
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                    <h4 className="font-semibold text-gray-900 text-sm">Suspension Link (Stabilizer Bar)</h4>
                    <p className="text-xs text-gray-500 mb-2">K90666 • Kia Sportage 2011-2015</p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1a5c38]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>15,000 FCFA</span>
                      <Badge className="bg-green-100 text-green-800 text-xs">In Stock</Badge>
                    </div>
                  </div>

                  {/* Product Card 2 */}
                  <div className="absolute top-20 right-0 bg-white rounded-xl shadow-2xl p-4 w-56 border border-gray-100 animate-float-delayed">
                    <img 
                      src={PART_IMAGES.brakes} 
                      alt="Brake Pads" 
                      className="w-full h-28 object-cover rounded-lg mb-3"
                    />
                    <h4 className="font-semibold text-gray-900 text-sm">Brake Pads Set (Front)</h4>
                    <p className="text-xs text-gray-500 mb-2">Toyota Corolla 2008-2012</p>
                    <span className="font-bold text-[#1a5c38]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>12,000 FCFA</span>
                  </div>

                  {/* Seller Card */}
                  <div className="absolute bottom-0 left-10 bg-white rounded-xl shadow-2xl p-4 w-60 border border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-[#1a5c38] rounded-full flex items-center justify-center text-white font-bold">A</div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-1">
                          Akan Motor Parts
                          <CheckCircle size={14} className="text-[#1a5c38]" />
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Star size={10} className="fill-yellow-400 text-yellow-400" />
                          <span>4.8 • 1250 sales</span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-xs">
                      <MessageCircle size={14} className="mr-1" />
                      Contact on WhatsApp
                    </Button>
                  </div>

                  {/* Price Comparison Badge */}
                  <div className="absolute top-60 -left-8 bg-[#1a5c38] text-white rounded-lg px-4 py-2 shadow-lg">
                    <p className="text-xs font-medium">Compare from 3 sellers</p>
                    <p className="text-sm font-bold">Save up to 15%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vehicle Brands Strip */}
      <section className="bg-[#1a5c38] py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center gap-8 md:gap-16 flex-wrap">
            <p className="text-white/80 text-sm font-medium">Supported Brands:</p>
            {["Toyota", "Nissan", "Hyundai", "Kia", "Mitsubishi", "Suzuki", "Mazda", "Daewoo"].map((brand) => (
              <span key={brand} className="text-white font-semibold text-lg" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              Why Choose AutoNexus?
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              The easiest way to find spare parts in Camp Yabassi without walking around the market.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-xl hover:border-[#1a5c38]/20 transition-all duration-300"
                data-testid={`feature-${index}`}
              >
                <div className={`w-14 h-14 ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon size={28} className="text-white" />
                </div>
                <h3 
                  className="font-bold text-gray-900 text-lg mb-2"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                >
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Parts Section */}
      <section className="py-16 md:py-24 bg-gray-50" data-testid="featured-parts-section">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 
                className="text-3xl md:text-4xl font-bold text-gray-900 mb-2"
                style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
              >
                Featured Spare Parts
              </h2>
              <p className="text-gray-600">Quality parts from verified sellers at competitive prices</p>
            </div>
            <Link 
              to="/search" 
              className="hidden md:flex items-center gap-1 text-[#1a5c38] font-semibold hover:underline"
              data-testid="view-all-parts-link"
            >
              View All Parts
              <ChevronRight size={18} />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredParts.slice(0, 8).map((part) => (
                <PartCard key={part.id} part={part} />
              ))}
            </div>
          )}

          <div className="text-center mt-8 md:hidden">
            <Link to="/search">
              <Button className="bg-[#1a5c38] hover:bg-[#144a2d]">
                View All Parts
                <ChevronRight size={18} className="ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Sellers Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              Verified Sellers in Camp Yabassi
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Connect with trusted spare parts dealers who have been verified for quality and reliability.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {sellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to="/sellers">
              <Button variant="outline" className="border-[#1a5c38] text-[#1a5c38] hover:bg-[#1a5c38] hover:text-white">
                View All Sellers
                <ChevronRight size={18} className="ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#1a5c38] to-[#0f3922] text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              How It Works
            </h2>
            <p className="text-white/80 max-w-2xl mx-auto">
              Find and buy spare parts in 3 simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                  <item.icon size={36} className="text-white" />
                  <span 
                    className="absolute -top-2 -right-2 w-8 h-8 bg-white text-[#1a5c38] rounded-full flex items-center justify-center font-bold text-lg"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {item.step}
                  </span>
                </div>
                <h3 className="font-bold text-xl mb-3" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {item.title}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mechanic Request CTA */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="grid md:grid-cols-2">
              {/* Image Side */}
              <div className="relative h-64 md:h-auto">
                <img 
                  src={PART_IMAGES.mechanic}
                  alt="Mechanic working"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#1a5c38]/80 to-transparent" />
                <div className="absolute bottom-6 left-6 text-white">
                  <p className="text-sm font-medium mb-1">For Mechanics</p>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                    Can't Find Your Part?
                  </p>
                </div>
              </div>

              {/* Content Side */}
              <div className="p-8 md:p-12 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 rounded-full px-4 py-1 text-sm font-medium mb-4 w-fit">
                  <Zap size={14} />
                  Part Request Feature
                </div>
                <h3 
                  className="text-2xl md:text-3xl font-bold text-gray-900 mb-4"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                >
                  Post a Part Request
                </h3>
                <p className="text-gray-600 mb-6">
                  Describe the part you need and let sellers contact you directly with their offers. 
                  Get multiple quotes and choose the best deal.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckCircle size={18} className="text-[#1a5c38]" />
                    <span>Specify your vehicle details</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckCircle size={18} className="text-[#1a5c38]" />
                    <span>Receive offers from multiple sellers</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckCircle size={18} className="text-[#1a5c38]" />
                    <span>Compare prices and conditions</span>
                  </li>
                </ul>
                <Link to="/requests/new">
                  <Button 
                    size="lg" 
                    className="bg-[#1a5c38] hover:bg-[#144a2d]"
                    data-testid="post-request-btn"
                  >
                    Post a Part Request
                    <ArrowRight size={18} className="ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              Browse by Category
            </h2>
            <p className="text-gray-600">Find parts by category for easier navigation</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Link
                key={category.name}
                to={`/search?category=${encodeURIComponent(category.name.replace(" ", "+"))}`}
                className="group bg-gray-50 hover:bg-[#1a5c38] rounded-2xl p-6 text-center transition-all duration-300 border border-gray-100 hover:border-[#1a5c38]"
              >
                <span className="text-4xl mb-3 block">{category.icon}</span>
                <h4 className="font-semibold text-gray-900 group-hover:text-white mb-1 transition-colors">
                  {category.name}
                </h4>
                <p className="text-sm text-gray-500 group-hover:text-white/70 transition-colors">
                  {category.count} parts
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-[#1a5c38]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 
            className="text-3xl md:text-4xl font-bold text-white mb-4"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            Ready to Find Your Parts?
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            Join thousands of mechanics and car owners who save time and money finding spare parts on AutoNexus.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/search">
              <Button size="lg" className="bg-white text-[#1a5c38] hover:bg-gray-100">
                <Search size={20} className="mr-2" />
                Search Parts Now
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <Users size={20} className="mr-2" />
                Become a Seller
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Location Info */}
      <section className="py-8 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <MapPin size={18} className="text-[#1a5c38]" />
            <p>
              Serving car owners and mechanics in <strong className="text-gray-900">Camp Yabassi, Douala, Cameroon</strong>
            </p>
          </div>
        </div>
      </section>

      {/* CSS for floating animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 4s ease-in-out infinite;
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
};

// Part Card Component
const PartCard = ({ part }) => {
  const stockStatus = part.stock > 20 ? "in" : part.stock > 5 ? "low" : "out";
  const stockLabel = part.stock > 20 ? "In Stock" : part.stock > 5 ? "Limited" : "Low Stock";

  const whatsappMessage = encodeURIComponent(
    `Hello, I found this spare part on AutoNexus.\n\n` +
    `Product: ${part.name}\n` +
    `Part Number: ${part.part_number}\n` +
    `Price: ${part.price?.toLocaleString()} FCFA\n\n` +
    `Is this part still available?`
  );
  const whatsappLink = part.seller?.whatsapp 
    ? `https://wa.me/${part.seller.whatsapp.replace('+', '')}?text=${whatsappMessage}`
    : '#';

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-[#1a5c38]/20 transition-all duration-300">
      <Link to={`/parts/${part.id}`}>
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          <img
            src={part.image || PART_IMAGES.engine}
            alt={part.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {part.condition === "used" && (
            <Badge className="absolute top-3 left-3 bg-amber-500">Used</Badge>
          )}
        </div>
      </Link>

      <div className="p-4">
        <Link to={`/parts/${part.id}`}>
          <h3 className="font-semibold text-gray-900 hover:text-[#1a5c38] line-clamp-2 mb-1 transition-colors">
            {part.name}
          </h3>
        </Link>
        <p className="text-xs text-gray-500 font-mono mb-2">{part.part_number}</p>
        <p className="text-sm text-gray-600 mb-3 line-clamp-1">
          {part.brands?.join(", ")} {part.models?.slice(0, 1).join(", ")}
        </p>

        <div className="flex items-center justify-between mb-3">
          <span 
            className="text-xl font-bold text-[#1a5c38]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {part.price?.toLocaleString()} <span className="text-sm font-normal text-gray-500">FCFA</span>
          </span>
          <Badge 
            variant="secondary"
            className={`text-xs ${
              stockStatus === "in" ? "bg-green-100 text-green-800" :
              stockStatus === "low" ? "bg-yellow-100 text-yellow-800" :
              "bg-red-100 text-red-800"
            }`}
          >
            {stockLabel}
          </Badge>
        </div>

        {part.seller && (
          <div className="flex items-center gap-2 py-2 border-t border-gray-100 mb-3">
            <div className="w-6 h-6 bg-[#1a5c38]/10 rounded-full flex items-center justify-center">
              <span className="text-[#1a5c38] text-xs font-bold">{part.seller.name?.charAt(0)}</span>
            </div>
            <span className="text-sm text-gray-600 truncate flex-1">{part.seller.name}</span>
            {part.seller.verified && <CheckCircle size={14} className="text-[#1a5c38]" />}
          </div>
        )}

        <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
          <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" size="sm">
            <MessageCircle size={16} className="mr-2" />
            Contact Seller
          </Button>
        </a>
      </div>
    </div>
  );
};

// Seller Card Component
const SellerCard = ({ seller }) => {
  const whatsappMessage = encodeURIComponent(
    `Hello ${seller.name},\n\nI found your shop on AutoNexus. I would like to inquire about spare parts.`
  );
  const whatsappLink = `https://wa.me/${seller.whatsapp?.replace('+', '')}?text=${whatsappMessage}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:border-[#1a5c38]/20 transition-all duration-300">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 bg-[#1a5c38] rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xl" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            {seller.name?.charAt(0)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-gray-900 truncate">{seller.name}</h4>
            {seller.verified && <CheckCircle size={16} className="text-[#1a5c38] flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Star size={14} className="fill-yellow-400 text-yellow-400" />
              <span>{seller.rating?.toFixed(1)}</span>
            </div>
            <span>•</span>
            <span>{seller.sales_count} sales</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <MapPin size={14} />
        <span>{seller.location}</span>
      </div>

      {seller.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{seller.description}</p>
      )}

      <div className="flex gap-2">
        <Link to={`/sellers/${seller.id}`} className="flex-1">
          <Button variant="outline" className="w-full">View Shop</Button>
        </Link>
        <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
          <Button className="bg-[#25D366] hover:bg-[#128C7E]">
            <MessageCircle size={16} />
          </Button>
        </a>
      </div>
    </div>
  );
};

export default HomePage;
