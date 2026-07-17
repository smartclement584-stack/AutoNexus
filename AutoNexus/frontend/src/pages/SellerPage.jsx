import { API } from "../lib/constants";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  Star,
  CheckCircle,
  MapPin,
  Loader2,
  ChevronRight,
  Package,
  Clock
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import ProductCard from "../components/ProductCard";

// Returns a translation key + interpolation value instead of a hardcoded
// English string, so the caller can localize via
// t(`seller_profile.${key}`, { count }) -- mirrors the getPasswordStrength
// pattern used on ResetPasswordPage. `lang` picks the locale for the 30+
// day fallback date format (e.g. "12 mars" in French vs "Mar 12" in English).
const getLastActiveInfo = (iso, lang) => {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 5) return { key: "active_just_now", count: null };
  if (mins < 60) return { key: "active_minutes_ago", count: mins };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { key: "active_hours_ago", count: hours };
  const days = Math.floor(hours / 24);
  if (days < 30) return { key: "active_days_ago", count: days };
  return { key: null, formattedDate: then.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { month: 'short', day: 'numeric' }) };
};


const SellerPage = () => {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [seller, setSeller] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSeller = async () => {
      try {
        const res = await axios.get(`${API}/sellers/${id}`);
        setSeller(res.data);
        try {
          const rres = await axios.get(`${API}/sellers/${id}/ratings`);
          setReviews(rres.data.ratings);
        } catch (e) {
          console.error("Error loading reviews:", e);
        }
      } catch (error) {
        console.error("Error loading seller:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSeller();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">{t("seller_profile.seller_not_found")}</p>
        <Link to="/sellers">
          <Button className="mt-4">{t("seller_profile.back_to_sellers")}</Button>
        </Link>
      </div>
    );
  }

  // WhatsApp link
  const whatsappMessage = encodeURIComponent(
    t("whatsapp.seller_inquiry", { name: seller.name })
  );
  const whatsappLink = `https://wa.me/${seller.whatsapp?.replace('+', '')}?text=${whatsappMessage}`;

  // Enrich parts with seller info for ProductCard
  const partsWithSeller = (seller.parts || []).map(part => ({
    ...part,
    seller: {
      id: seller.id,
      name: seller.name,
      rating: seller.rating,
      sales_count: seller.sales_count,
      verified: seller.verified,
      whatsapp: seller.whatsapp,
      phone: seller.phone
    }
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="seller-page">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/sellers" className="hover:text-[#1a5c38] flex items-center gap-1">
          <ArrowLeft size={16} />
          {t("seller_profile.all_sellers_link")}
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 truncate">{seller.name}</span>
      </nav>

      {/* Seller Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 md:w-24 md:h-24 bg-[#1a5c38] rounded-full flex items-center justify-center flex-shrink-0 mx-auto md:mx-0">
            <span className="text-white font-bold text-3xl md:text-4xl" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              {seller.name?.charAt(0)}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              <h1 
                className="text-2xl md:text-3xl font-bold text-gray-900"
                style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                data-testid="seller-name"
              >
                {seller.name}
              </h1>
              {seller.verified && (
                <Badge className="bg-[#1a5c38]">
                  <CheckCircle size={12} className="mr-1" />
                  {t("seller_profile.verified_badge")}
                </Badge>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-gray-600 mb-3 flex-wrap">
              <div className="flex items-center gap-1">
                <Star size={16} className="fill-yellow-400 text-yellow-400" />
                {seller.rating_count > 0 ? (
                  <>
                    <span className="font-medium">{seller.rating?.toFixed(1)}</span>
                    <span className="text-gray-400">({seller.rating_count})</span>
                  </>
                ) : (
                  <span className="text-gray-400">{t("seller_profile.no_ratings_yet")}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Package size={16} className="text-gray-400" />
                <span className="font-medium">{seller.sales_count}</span>
                <span className="text-gray-400">{t("common.sales_suffix")}</span>
              </div>
              {seller.last_active && (() => {
                const info = getLastActiveInfo(seller.last_active, i18n.language);
                return (
                  <div className="flex items-center gap-1">
                    <Clock size={16} className="text-gray-400" />
                    <span className="text-gray-400">
                      {info.key ? t(`seller_profile.${info.key}`, { count: info.count }) : info.formattedDate}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Location */}
            <div className="flex items-center justify-center md:justify-start gap-1 text-gray-500 mb-4">
              <MapPin size={16} />
              <span>{seller.location}</span>
            </div>

            {/* Description */}
            {seller.description && (
              <p className="text-gray-600 mb-4">{seller.description}</p>
            )}

            {/* Contact Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" data-testid="seller-whatsapp-btn">
                <Button className="w-full sm:w-auto bg-[#25D366] hover:bg-[#128C7E] text-white">
                  <MessageCircle size={18} className="mr-2" />
                  {t("product.contact_whatsapp")}
                </Button>
              </a>
              <a href={`tel:${seller.phone}`} data-testid="seller-call-btn">
                <Button variant="outline" className="w-full sm:w-auto">
                  <Phone size={18} className="mr-2" />
                  {seller.phone}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Seller's Parts */}
      <section data-testid="seller-parts-section">
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-xl md:text-2xl font-bold text-gray-900"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            {t("seller_profile.products_by", { name: seller.name })}
          </h2>
          <Badge variant="secondary" className="text-gray-600">
            {t("common.parts_count", { count: partsWithSeller.length })}
          </Badge>
        </div>

        {partsWithSeller.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <p className="text-gray-500">{t("seller_profile.no_parts_listed")}</p>
          </div>
        ) : (
          <div className="parts-grid">
            {partsWithSeller.map((part) => (
              <ProductCard key={part.id} part={part} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="mt-12">
          <h2
            className="text-xl md:text-2xl font-bold text-gray-900 mb-6"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            {t("seller_profile.buyer_reviews_title")}
          </h2>
          <div className="space-y-4">
            {reviews.map((rev) => (
              <div key={rev.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={14}
                        className={s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{rev.user_name || t("seller_profile.buyer_default_name")}</span>
                </div>
                {rev.comment && <p className="text-sm text-gray-600">{rev.comment}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default SellerPage;
