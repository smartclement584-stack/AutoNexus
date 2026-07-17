import { API } from "../lib/constants";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Filter, Loader2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "../components/ui/sheet";
import ProductCard from "../components/ProductCard";
import { logEvent } from "../lib/analytics";

const SearchPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [brands, setBrands] = useState([]);
  const [desktopModels, setDesktopModels] = useState([]);
  const [mobileModels, setMobileModels] = useState([]);  // FIX: separate model list for mobile sheet
  const [categories, setCategories] = useState([]);
  const [years, setYears] = useState([]);

  const query = searchParams.get("q") || "";
  const brand = searchParams.get("brand") || "";
  const model = searchParams.get("model") || "";
  const year = searchParams.get("year") || "";
  const category = searchParams.get("category") || "";
  const condition = searchParams.get("condition") || "";
  const sort = searchParams.get("sort") || "price_asc";
  const page = parseInt(searchParams.get("page") || "1");

  const [localFilters, setLocalFilters] = useState({ q: query, brand, model, year, category, condition, sort });

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [brandsRes, categoriesRes, yearsRes] = await Promise.all([
          axios.get(`${API}/filters/brands`),
          axios.get(`${API}/filters/categories`),
          axios.get(`${API}/filters/years`)
        ]);
        setBrands(brandsRes.data.brands);
        setCategories(categoriesRes.data.categories);
        setYears(yearsRes.data.years.reverse());
      } catch (error) {
        console.error("Error loading filters:", error);
      }
    };
    loadFilters();
  }, []);

  // Desktop: models driven by URL brand param
  useEffect(() => {
    const loadModels = async () => {
      if (brand) {
        try {
          const res = await axios.get(`${API}/filters/models?brand=${brand}`);
          setDesktopModels(res.data.models);
        } catch (error) {
          console.error("Error loading models:", error);
        }
      } else {
        setDesktopModels([]);
      }
    };
    loadModels();
  }, [brand]);

  // FIX: Mobile sheet models driven by localFilters.brand, not URL param
  useEffect(() => {
    const loadMobileModels = async () => {
      if (localFilters.brand) {
        try {
          const res = await axios.get(`${API}/filters/models?brand=${localFilters.brand}`);
          setMobileModels(res.data.models);
        } catch (error) {
          console.error("Error loading mobile models:", error);
        }
      } else {
        setMobileModels([]);
      }
    };
    loadMobileModels();
  }, [localFilters.brand]);

  useEffect(() => {
    const searchParts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (brand && brand !== "all") params.set("brand", brand);
        if (model && model !== "all") params.set("model", model);
        if (year && year !== "all") params.set("year", year);
        if (category && category !== "all") params.set("category", category);
        if (condition && condition !== "all") params.set("condition", condition);
        params.set("sort", sort);
        params.set("page", page.toString());
        params.set("limit", "12");

        const res = await axios.get(`${API}/parts?${params.toString()}`);
        setParts(res.data.parts);
        setTotalPages(res.data.pages);
        setTotal(res.data.total);
        if (query) {
          logEvent("search", { query, results_count: res.data.total });
        }
      } catch (error) {
        console.error("Error searching parts:", error);
      } finally {
        setLoading(false);
      }
    };
    searchParts();
  }, [query, brand, model, year, category, condition, sort, page]);

  const updateFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const clearFilters = () => setSearchParams({});

  const applyMobileFilters = () => {
    const newParams = new URLSearchParams();
    Object.entries(localFilters).forEach(([key, value]) => {
      if (value && value !== "all") newParams.set(key, value);
    });
    setSearchParams(newParams);
  };

  const hasActiveFilters = brand || model || year || category || condition;

  const FilterContent = ({ isMobile = false }) => (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t("search.label_search")}</label>
        <Input
          placeholder={t("search.placeholder_part_name_or_number")}
          value={isMobile ? localFilters.q : query}
          onChange={(e) => isMobile
            ? setLocalFilters({ ...localFilters, q: e.target.value })
            : updateFilter("q", e.target.value)
          }
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t("search.label_brand")}</label>
        <Select
          value={isMobile ? localFilters.brand : brand}
          onValueChange={(v) => isMobile
            ? setLocalFilters({ ...localFilters, brand: v, model: "" })
            : updateFilter("brand", v)
          }
        >
          <SelectTrigger><SelectValue placeholder={t("search.all_brands")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("search.all_brands")}</SelectItem>
            {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t("search.label_model")}</label>
        <Select
          value={isMobile ? localFilters.model : model}
          onValueChange={(v) => isMobile
            ? setLocalFilters({ ...localFilters, model: v })
            : updateFilter("model", v)
          }
          disabled={isMobile ? !localFilters.brand : !brand}
        >
          <SelectTrigger><SelectValue placeholder={t("search.all_models")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("search.all_models")}</SelectItem>
            {/* FIX: use mobileModels for mobile sheet, desktopModels for desktop sidebar */}
            {(isMobile ? mobileModels : desktopModels).map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t("search.label_year")}</label>
        <Select
          value={isMobile ? localFilters.year : year}
          onValueChange={(v) => isMobile ? setLocalFilters({ ...localFilters, year: v }) : updateFilter("year", v)}
        >
          <SelectTrigger><SelectValue placeholder={t("search.all_years")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("search.all_years")}</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t("search.label_category")}</label>
        <Select
          value={isMobile ? localFilters.category : category}
          onValueChange={(v) => isMobile ? setLocalFilters({ ...localFilters, category: v }) : updateFilter("category", v)}
        >
          <SelectTrigger><SelectValue placeholder={t("search.all_categories")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("search.all_categories")}</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t("search.label_condition")}</label>
        <Select
          value={isMobile ? localFilters.condition : condition}
          onValueChange={(v) => isMobile ? setLocalFilters({ ...localFilters, condition: v }) : updateFilter("condition", v)}
        >
          <SelectTrigger><SelectValue placeholder={t("search.all_conditions")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("search.all_conditions")}</SelectItem>
            <SelectItem value="new">{t("common.condition_new")}</SelectItem>
            <SelectItem value="used">{t("common.condition_used")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isMobile && hasActiveFilters && (
        <Button variant="outline" className="w-full" onClick={clearFilters}>
          <X size={16} className="mr-2" />{t("search.clear_filters")}
        </Button>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="search-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            {query ? t("search.results_for", { query }) : t("search.all_spare_parts")}
          </h1>
          <p className="text-gray-500 mt-1">{t("search.parts_found", { count: total })}</p>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <span className="text-sm text-gray-500">{t("search.sort_by")}</span>
          <Select value={sort} onValueChange={(v) => updateFilter("sort", v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="price_asc">{t("search.sort_price_asc")}</SelectItem>
              <SelectItem value="price_desc">{t("search.sort_price_desc")}</SelectItem>
              <SelectItem value="newest">{t("search.sort_newest")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden">
              <SlidersHorizontal size={18} className="mr-2" />{t("search.filters_btn")}
              {hasActiveFilters && (
                <span className="ml-2 w-5 h-5 bg-[#1a5c38] text-white rounded-full text-xs flex items-center justify-center">!</span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader><SheetTitle>{t("search.filters_title")}</SheetTitle></SheetHeader>
            <div className="mt-6">
              <FilterContent isMobile />
              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setLocalFilters({ q: "", brand: "", model: "", year: "", category: "", condition: "", sort: "price_asc" });
                  clearFilters();
                }}>{t("search.clear")}</Button>
                <Button className="flex-1 bg-[#1a5c38] hover:bg-[#144a2d]" onClick={applyMobileFilters}>
                  {t("search.apply_filters")}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-8">
        <aside className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-24 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={18} className="text-[#1a5c38]" />
              <h2 className="font-semibold text-gray-900">{t("search.filters_title")}</h2>
            </div>
            <FilterContent />
          </div>
        </aside>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-4 md:hidden">
            <span className="text-sm text-gray-500">{t("search.sort_label")}</span>
            <Select value={sort} onValueChange={(v) => updateFilter("sort", v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="price_asc">{t("search.sort_price_asc")}</SelectItem>
                <SelectItem value="price_desc">{t("search.sort_price_desc")}</SelectItem>
                <SelectItem value="newest">{t("search.sort_newest")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
            </div>
          ) : parts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500 mb-4">{t("search.no_parts_found")}</p>
              <Button variant="outline" onClick={clearFilters}>{t("search.clear_filters")}</Button>
            </div>
          ) : (
            <>
              <div className="parts-grid" data-testid="parts-grid">
                {parts.map((part) => <ProductCard key={part.id} part={part} />)}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button variant="outline" disabled={page === 1} onClick={() => updateFilter("page", (page - 1).toString())}>
                    {t("search.previous")}
                  </Button>
                  <span className="flex items-center px-4 text-sm text-gray-600">
                    {t("search.page_of", { page, totalPages })}
                  </span>
                  <Button variant="outline" disabled={page === totalPages} onClick={() => updateFilter("page", (page + 1).toString())}>
                    {t("search.next")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
