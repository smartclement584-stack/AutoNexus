import { Link } from "react-router-dom";
import { MessageCircle, Phone, Star, CheckCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const ProductCard = ({ part }) => {
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
    <div 
      className="product-card bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-[#1a5c38]"
      data-testid={`product-card-${part.id}`}
    >
      {/* Image */}
      <Link to={`/parts/${part.id}`}>
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          <img
            src={part.image || "https://placehold.co/400x400/e5e7eb/9ca3af?text=No+Image"}
            alt={part.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {part.condition === "used" && (
            <Badge className="absolute top-2 left-2 bg-yellow-500">Used</Badge>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        {/* Part Name */}
        <Link to={`/parts/${part.id}`}>
          <h3 
            className="font-semibold text-gray-900 hover:text-[#1a5c38] line-clamp-2 mb-1"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            data-testid={`product-name-${part.id}`}
          >
            {part.name}
          </h3>
        </Link>

        {/* Part Number */}
        <p className="text-xs text-gray-500 font-mono mb-2">{part.part_number}</p>

        {/* Compatibility */}
        <p className="text-sm text-gray-600 mb-3 line-clamp-1">
          {part.brands?.join(", ")} {part.models?.slice(0, 2).join(", ")}
        </p>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span 
            className="text-xl font-bold text-[#1a5c38]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
            data-testid={`product-price-${part.id}`}
          >
            {part.price?.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500">FCFA</span>
        </div>

        {/* Seller Info */}
        {part.seller && (
          <div className="flex items-center gap-2 mb-3 py-2 border-t border-gray-100">
            <div className="flex-1 min-w-0">
              <Link 
                to={`/sellers/${part.seller.id}`}
                className="text-sm font-medium text-gray-900 hover:text-[#1a5c38] truncate block"
              >
                {part.seller.name}
              </Link>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Star size={12} className="fill-yellow-400 text-yellow-400" />
                <span>{part.seller.rating?.toFixed(1)}</span>
                <span>•</span>
                <span>{part.seller.sales_count} sales</span>
              </div>
            </div>
            {part.seller.verified && (
              <CheckCircle size={16} className="text-[#1a5c38] flex-shrink-0" />
            )}
          </div>
        )}

        {/* Stock Badge */}
        <div className="flex items-center justify-between mb-3">
          <Badge 
            variant="secondary"
            className={`${
              stockStatus === "in" ? "bg-green-100 text-green-800" :
              stockStatus === "low" ? "bg-yellow-100 text-yellow-800" :
              "bg-red-100 text-red-800"
            }`}
            data-testid={`product-stock-${part.id}`}
          >
            {stockLabel} ({part.stock})
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <a 
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
            data-testid={`whatsapp-btn-${part.id}`}
          >
            <Button 
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white"
              size="sm"
            >
              <MessageCircle size={16} className="mr-1" />
              WhatsApp
            </Button>
          </a>
          {part.seller?.phone && (
            <a href={`tel:${part.seller.phone}`} data-testid={`call-btn-${part.id}`}>
              <Button variant="outline" size="sm">
                <Phone size={16} />
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
