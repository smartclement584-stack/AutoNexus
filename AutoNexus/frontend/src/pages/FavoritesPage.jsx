import { API } from "../lib/constants";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Heart, Loader2, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const FavoritesPage = () => {
  const { isAuthenticated, getAuthHeader, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      toast.error("Please login to view favorites");
      navigate("/login", { state: { from: { pathname: "/favorites" } } });
      return;
    }

    const loadFavorites = async () => {
      try {
        const res = await axios.get(`${API}/favorites`, { headers: getAuthHeader() });
        setParts(res.data.parts);
      } catch (e) {
        console.error("Failed to load favorites:", e);
      } finally {
        setLoading(false);
      }
    };
    loadFavorites();
  }, [isAuthenticated, authLoading, getAuthHeader, navigate]);

  if (loading || authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <Heart size={28} className="text-red-500 fill-red-500" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            Saved Parts
          </h1>
          <p className="text-gray-500">{parts.length} saved {parts.length === 1 ? "part" : "parts"}</p>
        </div>
      </div>

      {parts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <Heart size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No saved parts yet</h3>
          <p className="text-gray-500 mb-6">Browse parts and tap the heart icon to save them here</p>
          <Link to="/search">
            <Button className="bg-[#1a5c38] hover:bg-[#144a2d]">
              <Search size={16} className="mr-2" />Browse Parts
            </Button>
          </Link>
        </div>
      ) : (
        <div className="parts-grid">
          {parts.map((part) => (
            <ProductCard key={part.id} part={part} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
