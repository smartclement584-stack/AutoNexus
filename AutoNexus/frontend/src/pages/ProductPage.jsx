import { API } from "../lib/constants";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { 
  ArrowLeft, 
  MessageCircle, 
  Phone, 
  Star, 
  CheckCircle, 
  MapPin,
  Tag,
  Loader2,
  ChevronRight
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";


const ProductPage = () => {
  const { id } = useParams();
  const [part, setPart] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPart = async () => {
      try {
        const res = await axios.get(`${API}/parts/${id}`);
        setPart(res.data);
      } catch (error) {
        console.error("Error loading part:", error);
      } finally {
        setLoading(false);
      }
    };
    loadPart();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
      </div>
    );
  }

  if (!part) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Part not found</p>
        <Link to="/search">
          <Button className="mt-4">Back to Search</Button>
        </Link>
      </div>
    );
  }

  const stockStatus = part.stock > 20 ? "in" : part.stock > 5 ? "low" : "out";
  const stockLabel = part.stock > 20 ? "In Stock" : part.stock > 5 ? "Limited Stock" : "Low Stock";

  // Generate WhatsApp message
  const whatsappMessage = encodeURIComponent(
    `Hello, I found this spare part on AutoNexus.\n\n` +
    `Product: ${part.name}\n` +
    `Part Number: ${part.part_number}\n` +
    `Vehicle: ${part.brands?.join(", ")} ${part.models?.join(", ")} ${part.years?.[0]}-${part.years?.[part.years.length - 1]}\n` +
    `Price: ${part.price?.toLocaleString()} FCFA\n\n` +
    `Is this part still available?`
  );

  const whatsappLink = part.seller?.whatsapp 
    ? `https://wa.me/${part.seller.whatsapp.replace('+', '')}?text=${whatsappMessage}`
    : '#';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="product-page">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/search" className="hover:text-[#1a5c38] flex items-center gap-1">
          <ArrowLeft size={16} />
          Back to Search
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 truncate">{part.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Image Section */}
        <div>
          <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
            <img
              src={part.image || "https://placehold.co/600x600/e5e7eb/9ca3af?text=No+Image"}
              alt={part.name}
              className="w-full h-full object-cover"
              data-testid="product-image"
            />
          </div>
        </div>

        {/* Details Section */}
        <div>
          {/* Title and Badge */}
          <div className="flex items-start gap-3 mb-4">
            <h1 
              className="text-2xl md:text-3xl font-bold text-gray-900 flex-1"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
              data-testid="product-title"
            >
              {part.name}
            </h1>
            {part.condition === "used" && (
              <Badge className="bg-yellow-500">Used</Badge>
            )}
          </div>

          {/* Part Number */}
          <div className="flex items-center gap-2 mb-4">
            <Tag size={16} className="text-gray-400" />
            <span className="font-mono text-gray-600" data-testid="product-part-number">
              {part.part_number}
            </span>
          </div>

          {/* Price */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Price</p>
            <div className="flex items-baseline gap-2">
              <span 
                className="text-3xl md:text-4xl font-bold text-[#1a5c38]"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
                data-testid="product-price"
              >
                {part.price?.toLocaleString()}
              </span>
              <span className="text-lg text-gray-500">FCFA</span>
            </div>
            <Badge 
              variant="secondary"
              className={`mt-2 ${
                stockStatus === "in" ? "bg-green-100 text-green-800" :
                stockStatus === "low" ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }`}
              data-testid="product-stock"
            >
              {stockLabel} ({part.stock} available)
            </Badge>
          </div>

          {/* Compatibility */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Compatible Vehicles</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700">
                <span className="font-medium">{part.brands?.join(", ")}</span>
                {" "}
                {part.models?.join(", ")}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                Years: {part.years?.[0]} - {part.years?.[part.years.length - 1]}
              </p>
            </div>
          </div>

          {/* Description */}
          {part.description && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600">{part.description}</p>
            </div>
          )}

          {/* Seller Info */}
          {part.seller && (
            <div className="border border-gray-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#1a5c38]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[#1a5c38] font-bold text-lg">
                    {part.seller.name?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link 
                      to={`/sellers/${part.seller.id}`}
                      className="font-semibold text-gray-900 hover:text-[#1a5c38]"
                      data-testid="seller-link"
                    >
                      {part.seller.name}
                    </Link>
                    {part.seller.verified && (
                      <CheckCircle size={16} className="text-[#1a5c38]" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                    <span>{part.seller.rating?.toFixed(1)}</span>
                    <span>•</span>
                    <span>{part.seller.sales_count} sales</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <MapPin size={14} />
                    <span>{part.seller.location || "Camp Yabassi, Douala"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a 
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
              data-testid="whatsapp-contact-btn"
            >
              <Button 
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-lg py-6 whatsapp-btn"
                size="lg"
              >
                <MessageCircle size={22} className="mr-2" />
                Contact on WhatsApp
              </Button>
            </a>
            {part.seller?.phone && (
              <a href={`tel:${part.seller.phone}`} data-testid="call-seller-btn">
                <Button variant="outline" size="lg" className="py-6">
                  <Phone size={22} className="mr-2" />
                  Call Seller
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Price Comparison */}
      {part.price_comparison && part.price_comparison.length > 0 && (
        <section className="mt-12" data-testid="price-comparison-section">
          <h2 
            className="text-2xl font-bold text-gray-900 mb-6"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            Compare Prices from Other Sellers
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Current seller */}
                <TableRow className="bg-[#1a5c38]/5">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{part.seller?.name}</span>
                      <Badge variant="secondary" className="bg-[#1a5c38]/10 text-[#1a5c38]">
                        Current
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-bold text-[#1a5c38]">
                      {part.price?.toLocaleString()} FCFA
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={stockStatus === "in" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                      {stockLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="bg-[#25D366] hover:bg-[#128C7E]">
                        <MessageCircle size={14} className="mr-1" />
                        Contact
                      </Button>
                    </a>
                  </TableCell>
                </TableRow>

                {/* Other sellers */}
                {part.price_comparison.map((comp) => {
                  const compWhatsappMsg = encodeURIComponent(
                    `Hello, I found this spare part on AutoNexus.\n\n` +
                    `Product: ${comp.name}\n` +
                    `Part Number: ${comp.part_number}\n` +
                    `Price: ${comp.price?.toLocaleString()} FCFA\n\n` +
                    `Is this part still available?`
                  );
                  const compWhatsappLink = comp.seller?.whatsapp 
                    ? `https://wa.me/${comp.seller.whatsapp.replace('+', '')}?text=${compWhatsappMsg}`
                    : '#';
                  const compStockStatus = comp.stock > 20 ? "in" : comp.stock > 5 ? "low" : "out";
                  const compStockLabel = comp.stock > 20 ? "In Stock" : comp.stock > 5 ? "Limited" : "Low";

                  return (
                    <TableRow key={comp.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link 
                            to={`/sellers/${comp.seller?.id}`}
                            className="font-medium hover:text-[#1a5c38]"
                          >
                            {comp.seller?.name}
                          </Link>
                          {comp.seller?.rating && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Star size={10} className="fill-yellow-400 text-yellow-400" />
                              {comp.seller.rating?.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-bold">
                          {comp.price?.toLocaleString()} FCFA
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={compStockStatus === "in" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                          {compStockLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <a href={compWhatsappLink} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline">
                            <MessageCircle size={14} className="mr-1" />
                            Contact
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductPage;
