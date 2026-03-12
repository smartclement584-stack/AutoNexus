import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { Filter, Loader2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import ProductCard from "../components/ProductCard";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filter states
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [years, setYears] = useState([]);
  
  // Current filters from URL
  const query = searchParams.get("q") || "";
  const brand = searchParams.get("brand") || "";
  const model = searchParams.get("model") || "";
  const year = searchParams.get("year") || "";
  const category = searchParams.get("category") || "";
  const condition = searchParams.get("condition") || "";
  const sort = searchParams.get("sort") || "price_asc";
  const page = parseInt(searchParams.get("page") || "1");

  // Local filter state for mobile sheet
  const [localFilters, setLocalFilters] = useState({
    q: query,
    brand,
    model,
    year,
    category,
    condition,
    sort
  });

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

  // Load models when brand changes
  useEffect(() => {
    const loadModels = async () => {
      if (brand) {
        try {
          const res = await axios.get(`${API}/filters/models?brand=${brand}`);
          setModels(res.data.models);
        } catch (error) {
          console.error("Error loading models:", error);
        }
      } else {
        setModels([]);
      }
    };
    loadModels();
  }, [brand]);

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

  const clearFilters = () => {
    setSearchParams({});
  };

  const applyMobileFilters = () => {
    const newParams = new URLSearchParams();
    Object.entries(localFilters).forEach(([key, value]) => {
      if (value && value !== "all") {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams);
  };

  const hasActiveFilters = brand || model || year || category || condition;

  const FilterContent = ({ isMobile = false }) => (
    <div className={isMobile ? "space-y-4" : "space-y-4"}>
      {/* Search */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Search</label>
        <Input
          placeholder="Part name or number"
          value={isMobile ? localFilters.q : query}
          onChange={(e) => isMobile 
            ? setLocalFilters({ ...localFilters, q: e.target.value })
            : updateFilter("q", e.target.value)
          }
          data-testid="filter-search-input"
        />
      </div>

      {/* Brand */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Brand</label>
        <Select 
          value={isMobile ? localFilters.brand : brand} 
          onValueChange={(v) => isMobile 
            ? setLocalFilters({ ...localFilters, brand: v, model: "" })
            : updateFilter("brand", v)
          }
        >
          <SelectTrigger data-testid="filter-brand-select">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Model</label>
        <Select 
          value={isMobile ? localFilters.model : model} 
          onValueChange={(v) => isMobile 
            ? setLocalFilters({ ...localFilters, model: v })
            : updateFilter("model", v)
          }
          disabled={!brand && !localFilters.brand}
        >
          <SelectTrigger data-testid="filter-model-select">
            <SelectValue placeholder="All Models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Models</SelectItem>
            {models.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Year */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Year</label>
        <Select 
          value={isMobile ? localFilters.year : year} 
          onValueChange={(v) => isMobile 
            ? setLocalFilters({ ...localFilters, year: v })
            : updateFilter("year", v)
          }
        >
          <SelectTrigger data-testid="filter-year-select">
            <SelectValue placeholder="All Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
        <Select 
          value={isMobile ? localFilters.category : category} 
          onValueChange={(v) => isMobile 
            ? setLocalFilters({ ...localFilters, category: v })
            : updateFilter("category", v)
          }
        >
          <SelectTrigger data-testid="filter-category-select">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Condition */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Condition</label>
        <Select 
          value={isMobile ? localFilters.condition : condition} 
          onValueChange={(v) => isMobile 
            ? setLocalFilters({ ...localFilters, condition: v })
            : updateFilter("condition", v)
          }
        >
          <SelectTrigger data-testid="filter-condition-select">
            <SelectValue placeholder="All Conditions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="used">Used</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isMobile && hasActiveFilters && (
        <Button 
          variant="outline" 
          className="w-full"
          onClick={clearFilters}
          data-testid="clear-filters-btn"
        >
          <X size={16} className="mr-2" />
          Clear Filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="search-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 
            className="text-2xl md:text-3xl font-bold text-gray-900"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            {query ? `Results for "${query}"` : "All Spare Parts"}
          </h1>
          <p className="text-gray-500 mt-1">{total} parts found</p>
        </div>

        {/* Sort - Desktop */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          <Select value={sort} onValueChange={(v) => updateFilter("sort", v)}>
            <SelectTrigger className="w-44" data-testid="sort-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="rating">Best Rating</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Filter Button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden" data-testid="mobile-filter-btn">
              <SlidersHorizontal size={18} className="mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 w-5 h-5 bg-[#1a5c38] text-white rounded-full text-xs flex items-center justify-center">
                  !
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <FilterContent isMobile />
              <div className="flex gap-2 mt-6">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setLocalFilters({ q: "", brand: "", model: "", year: "", category: "", condition: "", sort: "price_asc" });
                    clearFilters();
                  }}
                >
                  Clear
                </Button>
                <Button 
                  className="flex-1 bg-[#1a5c38] hover:bg-[#144a2d]"
                  onClick={applyMobileFilters}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-24 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={18} className="text-[#1a5c38]" />
              <h2 className="font-semibold text-gray-900">Filters</h2>
            </div>
            <FilterContent />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          {/* Mobile Sort */}
          <div className="flex items-center justify-between mb-4 md:hidden">
            <span className="text-sm text-gray-500">Sort:</span>
            <Select value={sort} onValueChange={(v) => updateFilter("sort", v)}>
              <SelectTrigger className="w-40" data-testid="mobile-sort-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="rating">Best Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
            </div>
          ) : parts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500 mb-4">No parts found matching your criteria</p>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="parts-grid" data-testid="parts-grid">
                {parts.map((part) => (
                  <ProductCard key={part.id} part={part} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => updateFilter("page", (page - 1).toString())}
                    data-testid="prev-page-btn"
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-4 text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => updateFilter("page", (page + 1).toString())}
                    data-testid="next-page-btn"
                  >
                    Next
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
