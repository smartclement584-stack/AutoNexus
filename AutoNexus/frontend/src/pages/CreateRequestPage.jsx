import { API } from "../lib/constants";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/errorMessage";


const CreateRequestPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getAuthHeader } = useAuth();
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);

  const [formData, setFormData] = useState({
    vehicle_brand: "",
    vehicle_model: "",
    vehicle_year: "",
    part_name: "",
    description: "",
    urgency: "normal",
    location: "Douala"
  });

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [brandsRes, yearsRes] = await Promise.all([
          axios.get(`${API}/filters/brands`),
          axios.get(`${API}/filters/years`)
        ]);
        setBrands(brandsRes.data.brands);
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
      if (formData.vehicle_brand) {
        try {
          const res = await axios.get(`${API}/filters/models?brand=${formData.vehicle_brand}`);
          setModels(res.data.models);
        } catch (error) {
          console.error("Error loading models:", error);
        }
      } else {
        setModels([]);
      }
    };
    loadModels();
  }, [formData.vehicle_brand]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.vehicle_brand || !formData.vehicle_model || !formData.vehicle_year || !formData.part_name) {
      toast.error(t("common.please_fill_required_fields"));
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/requests`, formData, {
        headers: getAuthHeader()
      });
      toast.success(t("create_request.toast_success"));
      navigate("/requests");
    } catch (error) {
      console.error("Error creating request:", error);
      toast.error(getErrorMessage(error, "errors.generic_fallback"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6" data-testid="create-request-page">
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={18} />
        {t("common.back")}
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
        <h1
          className="text-2xl md:text-3xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
        >
          {t("create_request.title")}
        </h1>
        <p className="text-gray-500 mb-6">
          {t("create_request.subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vehicle Brand */}
          <div>
            <Label htmlFor="brand">{t("create_request.vehicle_brand_label")}</Label>
            <Select
              value={formData.vehicle_brand}
              onValueChange={(v) => setFormData({ ...formData, vehicle_brand: v, vehicle_model: "" })}
            >
              <SelectTrigger id="brand" data-testid="request-brand-select">
                <SelectValue placeholder={t("create_request.select_brand_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle Model */}
          <div>
            <Label htmlFor="model">{t("create_request.vehicle_model_label")}</Label>
            <Select
              value={formData.vehicle_model}
              onValueChange={(v) => setFormData({ ...formData, vehicle_model: v })}
              disabled={!formData.vehicle_brand}
            >
              <SelectTrigger id="model" data-testid="request-model-select">
                <SelectValue placeholder={t("create_request.select_model_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model} value={model}>{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle Year */}
          <div>
            <Label htmlFor="year">{t("create_request.vehicle_year_label")}</Label>
            <Select
              value={formData.vehicle_year}
              onValueChange={(v) => setFormData({ ...formData, vehicle_year: v })}
            >
              <SelectTrigger id="year" data-testid="request-year-select">
                <SelectValue placeholder={t("create_request.select_year_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Part Name */}
          <div>
            <Label htmlFor="part_name">{t("create_request.part_name_label")}</Label>
            <Input
              id="part_name"
              placeholder={t("create_request.part_name_placeholder")}
              value={formData.part_name}
              onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
              data-testid="request-part-name"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">{t("create_request.additional_details_label")}</Label>
            <Textarea
              id="description"
              placeholder={t("create_request.additional_details_placeholder")}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              data-testid="request-description"
            />
          </div>

          {/* Urgency */}
          <div>
            <Label htmlFor="urgency">{t("create_request.urgency_label")}</Label>
            <Select
              value={formData.urgency}
              onValueChange={(v) => setFormData({ ...formData, urgency: v })}
            >
              <SelectTrigger id="urgency" data-testid="request-urgency-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{t("create_request.urgency_normal")}</SelectItem>
                <SelectItem value="urgent">{t("create_request.urgency_urgent")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">{t("common.location_label")}</Label>
            <Input
              id="location"
              placeholder={t("create_request.location_placeholder")}
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              data-testid="request-location"
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full bg-[#1a5c38] hover:bg-[#144a2d] py-6 text-lg"
            disabled={loading}
            data-testid="submit-request-btn"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                {t("create_request.posting")}
              </>
            ) : (
              t("create_request.submit_btn")
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CreateRequestPage;
