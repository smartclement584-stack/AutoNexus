import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { 
  MessageSquare, 
  Clock, 
  MapPin,
  Loader2,
  Plus,
  Car,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../context/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RequestsPage = () => {
  const { isAuthenticated } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const loadRequests = async () => {
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
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="requests-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 
            className="text-2xl md:text-3xl font-bold text-gray-900 mb-2"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            Part Requests
          </h1>
          <p className="text-gray-500">
            Mechanics and car owners looking for spare parts
          </p>
        </div>
        <Link to={isAuthenticated ? "/requests/new" : "/login"}>
          <Button className="bg-[#1a5c38] hover:bg-[#144a2d]" data-testid="new-request-btn">
            <Plus size={18} className="mr-2" />
            Post a Request
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {["all", "open", "responded"].map((status) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(status)}
            className={filter === status ? "bg-[#1a5c38]" : ""}
            data-testid={`filter-${status}`}
          >
            {status === "all" ? "All Requests" : status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No part requests found</p>
          <Link to={isAuthenticated ? "/requests/new" : "/login"}>
            <Button className="bg-[#1a5c38] hover:bg-[#144a2d]">
              Be the first to post a request
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4" data-testid="requests-list">
          {requests.map((request) => (
            <div 
              key={request.id}
              className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 hover:border-[#1a5c38] transition-colors"
              data-testid={`request-card-${request.id}`}
            >
              <div className="flex flex-col md:flex-row gap-4">
                {/* Icon */}
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Car size={24} className="text-gray-500" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 
                      className="font-semibold text-lg text-gray-900"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      {request.part_name}
                    </h3>
                    <Badge 
                      variant="secondary"
                      className={
                        request.status === "open" 
                          ? "bg-blue-100 text-blue-800" 
                          : request.status === "responded"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {request.status === "open" && <AlertCircle size={12} className="mr-1" />}
                      {request.status === "responded" && <CheckCircle2 size={12} className="mr-1" />}
                      {request.status}
                    </Badge>
                  </div>

                  {/* Vehicle Info */}
                  <p className="text-gray-700 mb-2">
                    <span className="font-medium">{request.vehicle_brand}</span>
                    {" "}
                    {request.vehicle_model}
                    {" "}
                    <span className="text-gray-500">{request.vehicle_year}</span>
                  </p>

                  {/* Description */}
                  {request.description && (
                    <p className="text-gray-600 text-sm mb-3">{request.description}</p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{formatDate(request.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin size={14} />
                      <span>{request.location}</span>
                    </div>
                    {request.urgency === "urgent" && (
                      <Badge variant="destructive" className="bg-red-100 text-red-800">
                        Urgent
                      </Badge>
                    )}
                  </div>

                  {/* Responses */}
                  {request.responses && request.responses.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        {request.responses.length} seller response(s)
                      </p>
                      <div className="space-y-2">
                        {request.responses.slice(0, 2).map((resp, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{resp.seller_name}</span>
                              <span className="font-mono text-[#1a5c38] font-bold">
                                {resp.price?.toLocaleString()} FCFA
                              </span>
                            </div>
                            <p className="text-gray-600 text-xs">{resp.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RequestsPage;
