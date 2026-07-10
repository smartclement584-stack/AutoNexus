import { API } from "../lib/constants";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  MessageSquare, Clock, MapPin, Loader2, Plus, Car, AlertCircle,
  CheckCircle2, ChevronDown, ChevronUp, Phone, Star, BadgeCheck
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { useAuth } from "../context/AuthContext";

const RequestsPage = () => {
  const { isAuthenticated, user, getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  // Rating dialog state
  const [rateOpen, setRateOpen] = useState(false);
  const [rateTarget, setRateTarget] = useState(null); // { seller_id, seller_name }
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const res = await axios.get(`${API}/requests${params}`);
      setRequests(res.data.requests);
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleNewRequest = () => {
    if (isAuthenticated) {
      navigate("/requests/new");
    } else {
      navigate("/login", { state: { from: { pathname: "/requests/new" } } });
    }
  };

  const handleAccept = async (request, resp) => {
    try {
      await axios.post(
        `${API}/requests/${request.id}/accept?seller_id=${resp.seller_id}`,
        {},
        { headers: getAuthHeader() }
      );
      toast.success(`You accepted ${resp.seller_name}'s quote. You can now rate them.`);
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to accept quote");
    }
  };

  const openRating = (request) => {
    const seller = request.responses?.find(r => r.seller_id === request.accepted_seller_id);
    setRateTarget({ seller_id: request.accepted_seller_id, seller_name: seller?.seller_name || "Seller" });
    setRatingValue(0);
    setRatingHover(0);
    setRatingComment("");
    setRateOpen(true);
  };

  const submitRating = async () => {
    if (ratingValue < 1) {
      toast.error("Please pick a star rating");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(
        `${API}/sellers/${rateTarget.seller_id}/rate`,
        { rating: ratingValue, comment: ratingComment || undefined },
        { headers: getAuthHeader() }
      );
      toast.success("Thanks for your rating!");
      setRateOpen(false);
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const isOwner = (request) => user && request.user_id === user.id;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="requests-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            Part Requests
          </h1>
          <p className="text-gray-500">Mechanics and car owners looking for spare parts</p>
        </div>
        <Button onClick={handleNewRequest} className="bg-[#1a5c38] hover:bg-[#144a2d]" data-testid="new-request-btn">
          <Plus size={18} className="mr-2" />Post a Request
        </Button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {["all", "open", "responded", "fulfilled"].map((status) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(status)}
            className={filter === status ? "bg-[#1a5c38] hover:bg-[#144a2d]" : ""}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <MessageSquare size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No requests found</p>
          <Button onClick={handleNewRequest} className="bg-[#1a5c38] hover:bg-[#144a2d]">
            Post the first request
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-lg">{request.part_name}</h3>
                      {request.urgency === "urgent" && (
                        <Badge className="bg-red-100 text-red-700">
                          <AlertCircle size={12} className="mr-1" />Urgent
                        </Badge>
                      )}
                      <Badge className={
                        request.status === "open" ? "bg-green-100 text-green-700" :
                        request.status === "responded" ? "bg-blue-100 text-blue-700" :
                        request.status === "fulfilled" ? "bg-[#1a5c38] text-white" :
                        "bg-gray-100 text-gray-700"
                      }>
                        {request.status === "responded" ? (
                          <><CheckCircle2 size={12} className="mr-1" />Responded ({request.responses?.length})</>
                        ) : request.status === "fulfilled" ? (
                          <><BadgeCheck size={12} className="mr-1" />Fulfilled</>
                        ) : request.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Car size={14} />
                      <span>{request.vehicle_brand} {request.vehicle_model} ({request.vehicle_year})</span>
                    </div>

                    {request.description && (
                      <p className="text-sm text-gray-500 mb-3">{request.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />{request.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />{formatDate(request.created_at)}
                      </span>
                      {request.user_name && (
                        <span>By: {request.user_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Owner rate button once fulfilled */}
                  {isOwner(request) && request.status === "fulfilled" && !request.rated && (
                    <Button size="sm" className="bg-[#1a5c38] hover:bg-[#144a2d] flex-shrink-0"
                      onClick={() => openRating(request)}>
                      <Star size={14} className="mr-1" />Rate Seller
                    </Button>
                  )}
                  {isOwner(request) && request.rated && (
                    <Badge className="bg-gray-100 text-gray-600 flex-shrink-0 h-fit">Rated</Badge>
                  )}
                </div>

                {/* Seller responses - expandable */}
                {request.responses && request.responses.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
                      className="flex items-center gap-2 text-sm font-medium text-[#1a5c38] hover:underline"
                    >
                      {expandedId === request.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {request.responses.length} seller {request.responses.length === 1 ? "response" : "responses"}
                    </button>

                    {expandedId === request.id && (
                      <div className="mt-3 space-y-3">
                        {request.responses.map((resp, idx) => {
                          const waLink = `https://wa.me/${resp.seller_whatsapp?.replace('+', '')}?text=${encodeURIComponent(
                            `Hello ${resp.seller_name}, I saw your response to my request for ${request.part_name} on AutoNexus.`
                          )}`;
                          const isAccepted = request.accepted_seller_id === resp.seller_id;
                          return (
                            <div key={idx} className={`rounded-lg p-4 border ${isAccepted ? "bg-green-50 border-[#1a5c38]" : "bg-gray-50 border-gray-100"}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                    {resp.seller_name}
                                    {isAccepted && <Badge className="bg-[#1a5c38] text-white text-xs">Accepted</Badge>}
                                  </p>
                                  <p className="text-[#1a5c38] font-bold mt-1">
                                    {resp.price?.toLocaleString()} FCFA
                                    <span className="text-gray-500 font-normal text-xs ml-2">({resp.condition})</span>
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">{resp.message}</p>
                                  {!resp.available && (
                                    <Badge className="bg-red-100 text-red-700 mt-1 text-xs">Not Available</Badge>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2 flex-shrink-0">
                                  {resp.seller_whatsapp && (
                                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                                      <Button size="sm" className="bg-[#25D366] hover:bg-[#128C7E] text-white w-full">
                                        <MessageSquare size={12} className="mr-1" />Chat
                                      </Button>
                                    </a>
                                  )}
                                  {isOwner(request) && request.status !== "fulfilled" && (
                                    <Button size="sm" variant="outline" onClick={() => handleAccept(request, resp)}>
                                      <CheckCircle2 size={12} className="mr-1" />Accept
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rating dialog */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rate {rateTarget?.seller_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingValue(star)}
                  onMouseEnter={() => setRatingHover(star)}
                  onMouseLeave={() => setRatingHover(0)}
                >
                  <Star
                    size={32}
                    className={(ratingHover || ratingValue) >= star ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
                  />
                </button>
              ))}
            </div>
            <Textarea
              rows={3}
              placeholder="Leave a comment (optional)"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
            />
            <Button
              className="w-full bg-[#1a5c38] hover:bg-[#144a2d]"
              onClick={submitRating}
              disabled={submitting}
            >
              {submitting ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              Submit Rating
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestsPage;
