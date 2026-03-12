import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { 
  Store, 
  Star, 
  CheckCircle, 
  MapPin,
  Loader2,
  MessageCircle,
  Phone,
  Package
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SellersListPage = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadSellers = async () => {
      try {
        const res = await axios.get(`${API}/sellers`);
        setSellers(res.data.sellers);
      } catch (error) {
        console.error("Error loading sellers:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSellers();
  }, []);

  const filteredSellers = sellers.filter(seller => 
    seller.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seller.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="sellers-list-page">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-2xl md:text-3xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
        >
          Verified Sellers
        </h1>
        <p className="text-gray-500">
          All spare parts sellers in Camp Yabassi, Douala
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search sellers by name or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
          data-testid="search-sellers-input"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
        </div>
      ) : filteredSellers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Store size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No sellers found</p>
        </div>
      ) : (
        <div className="grid gap-4 md:gap-6" data-testid="sellers-grid">
          {filteredSellers.map((seller) => {
            const whatsappMessage = encodeURIComponent(
              `Hello ${seller.name},\n\nI found your shop on AutoNexus. I would like to inquire about spare parts.`
            );
            const whatsappLink = `https://wa.me/${seller.whatsapp?.replace('+', '')}?text=${whatsappMessage}`;

            return (
              <div 
                key={seller.id}
                className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 hover:border-[#1a5c38] transition-colors"
                data-testid={`seller-card-${seller.id}`}
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 bg-[#1a5c38] rounded-full flex items-center justify-center flex-shrink-0 mx-auto md:mx-0">
                    <span className="text-white font-bold text-2xl" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                      {seller.name?.charAt(0)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                      <Link 
                        to={`/sellers/${seller.id}`}
                        className="font-semibold text-lg text-gray-900 hover:text-[#1a5c38]"
                        data-testid={`seller-name-${seller.id}`}
                      >
                        {seller.name}
                      </Link>
                      {seller.verified && (
                        <CheckCircle size={16} className="text-[#1a5c38]" />
                      )}
                    </div>

                    <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-gray-500 mb-2">
                      <div className="flex items-center gap-1">
                        <Star size={14} className="fill-yellow-400 text-yellow-400" />
                        <span>{seller.rating?.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package size={14} />
                        <span>{seller.sales_count} sales</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center md:justify-start gap-1 text-sm text-gray-500 mb-3">
                      <MapPin size={14} />
                      <span>{seller.location}</span>
                    </div>

                    {seller.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {seller.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row md:flex-col gap-2 justify-center">
                    <Link to={`/sellers/${seller.id}`}>
                      <Button variant="outline" className="w-full">
                        View Shop
                      </Button>
                    </Link>
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full bg-[#25D366] hover:bg-[#128C7E]">
                        <MessageCircle size={16} className="mr-1" />
                        WhatsApp
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellersListPage;
