import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Search, ShieldCheck, Truck, TrendingUp, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import ProductCard from "../components/ProductCard";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const HomePage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [brands, setBrands] = useState([]);
  const [featuredParts, setFeaturedParts] = useState([]);
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
    if (selectedBrand) params.set("brand", selectedBrand);
    navigate(`/search?${params.toString()}`);
  };

  const features = [
    {
      icon: ShieldCheck,
      title: "Verified Parts Network",
      description: "All sellers are verified for quality assurance"
    },
    {
      icon: Search,
      title: "Search Spare Parts",
      description: "Find parts for Japanese & Korean vehicles"
    },
    {
      icon: TrendingUp,
      title: "Compare Prices",
      description: "Get the best deals from multiple sellers"
    },
    {
      icon: Truck,
      title: "Fast Delivery",
      description: "Quick delivery within Douala"
    }
  ];

  return (
    <div className="min-h-screen" data-testid="home-page">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-[#1a5c38] to-[#144a2d] text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
              data-testid="hero-title"
            >
              Digital Automotive Spare Parts Marketplace
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8">
              Find spare parts fast in Camp Yabassi, Cameroon. Compare prices from verified sellers.
            </p>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl p-4 md:p-6 shadow-xl" data-testid="search-form">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search parts (e.g., brake pads, starter motor)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 text-gray-900 border-gray-200"
                    data-testid="search-input"
                  />
                </div>
                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                  <SelectTrigger className="w-full md:w-44 h-12 text-gray-900 border-gray-200" data-testid="brand-select">
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
                  className="h-12 px-8 bg-[#1a5c38] hover:bg-[#144a2d]"
                  data-testid="search-btn"
                >
                  <Search size={20} className="mr-2" />
                  Search
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="text-center p-4 md:p-6 rounded-xl hover:bg-gray-50 transition-colors"
                data-testid={`feature-${index}`}
              >
                <div className="w-12 h-12 md:w-14 md:h-14 mx-auto mb-3 bg-[#1a5c38]/10 rounded-full flex items-center justify-center">
                  <feature.icon size={24} className="text-[#1a5c38]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-500 hidden md:block">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Parts Section */}
      <section className="py-12 md:py-16" data-testid="featured-parts-section">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h2 
              className="text-2xl md:text-3xl font-bold text-gray-900"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              Featured Parts
            </h2>
            <Link 
              to="/search" 
              className="flex items-center gap-1 text-[#1a5c38] font-medium hover:underline"
              data-testid="view-all-parts-link"
            >
              View All
              <ChevronRight size={18} />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
            </div>
          ) : (
            <div className="parts-grid">
              {featuredParts.map((part) => (
                <ProductCard key={part.id} part={part} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-[#1a5c38] rounded-2xl p-8 md:p-12 text-center text-white">
            <h2 
              className="text-2xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              Can't Find Your Part?
            </h2>
            <p className="text-white/80 mb-6 max-w-xl mx-auto">
              Post a request and let sellers contact you directly. Mechanics and car owners can quickly find parts they need.
            </p>
            <Link to="/requests/new">
              <Button 
                size="lg" 
                className="bg-white text-[#1a5c38] hover:bg-gray-100"
                data-testid="post-request-btn"
              >
                Post a Part Request
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Location Info */}
      <section className="py-8 md:py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500">
            Serving car owners and mechanics in <strong className="text-gray-900">Camp Yabassi, Douala, Cameroon</strong>
          </p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
