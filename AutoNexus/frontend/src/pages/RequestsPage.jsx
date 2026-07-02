import { API } from "../lib/constants";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  MessageSquare, Clock, MapPin, Loader2, Plus, Car, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Phone
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../context/AuthContext";

const RequestsPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
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
    loadRequests();
  }, [filter]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // FIX: pass redirect state so after login user comes back to /requests/new
  const handleNewRequest = () => {
    if (isAuthenticated) {
      navigate("/requests/new");
    } else {
      navigate("/login", { state: { from: { pathname: "/requests/new" } } });
    }
  };

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
        {["all", "open", "responded"].map((status) => (
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
                        "bg-gray-100 text-gray-700"
                      }>
                        {request.status === "responded" ? (
                          <><CheckCircle2 size={12} className="mr-1" />Responded ({request.responses?.length})</>
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

                  {/* Contact requester if responded */}
                  {request.user_phone && (
                    <a href={`tel:${request.user_phone}`} className="flex-shrink-0">
                      <Button variant="outline" size="sm">
                        <Phone size={14} className="mr-1" />Call
                      </Button>
                    </a>
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
                          return (
                            <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-gray-900 text-sm">{resp.seller_name}</p>
                                  <p className="text-[#1a5c38] font-bold mt-1">
                                    {resp.price?.toLocaleString()} FCFA
                                    <span className="text-gray-500 font-normal text-xs ml-2">({resp.condition})</span>
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">{resp.message}</p>
                                  {!resp.available && (
                                    <Badge className="bg-red-100 text-red-700 mt-1 text-xs">Not Available</Badge>
                                  )}
                                </div>
                                {resp.seller_whatsapp && (
                                  <a href={waLink} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" className="bg-[#25D366] hover:bg-[#128C7E] text-white flex-shrink-0">
                                      <MessageSquare size={12} className="mr-1" />Chat
                                    </Button>
                                  </a>
                                )}
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
    </div>
  );
};

export default RequestsPage;
