import { API } from "../lib/constants";
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Bell, BellOff, CheckCheck, Loader2, MessageSquare, Package } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const typeIcon = {
  new_response: MessageSquare,
  new_request: Package,
  price_drop: Package,
  stock_alert: Package,
};

const typeColor = {
  new_response: "bg-blue-100 text-blue-700",
  new_request: "bg-green-100 text-green-700",
  price_drop: "bg-purple-100 text-purple-700",
  stock_alert: "bg-orange-100 text-orange-700",
};

const NotificationsPage = () => {
  const { isAuthenticated, getAuthHeader, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/notifications`, { headers: getAuthHeader() });
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unread_count);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      toast.error("Please login to view notifications");
      navigate("/login", { state: { from: { pathname: "/notifications" } } });
      return;
    }
    loadNotifications();
  }, [isAuthenticated, authLoading, loadNotifications, navigate]);

  const markAllRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`, {}, { headers: getAuthHeader() });
      setNotifications(n => n.map(x => ({ ...x, read: true })));
      setUnreadCount(0);
    } catch (e) {
      toast.error("Failed to mark as read");
    }
  };

  const markRead = async (id) => {
    try {
      await axios.put(`${API}/notifications/${id}/read`, {}, { headers: getAuthHeader() });
      setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch (e) {}
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading || authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a5c38]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell size={28} className="text-[#1a5c38]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500">{unreadCount} unread</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck size={16} className="mr-2" />Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <BellOff size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No notifications yet</h3>
          <p className="text-gray-500">You'll be notified when sellers respond to your requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = typeIcon[notif.type] || Bell;
            const colorClass = typeColor[notif.type] || "bg-gray-100 text-gray-700";
            return (
              <div
                key={notif.id}
                onClick={() => !notif.read && markRead(notif.id)}
                className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                  notif.read ? "bg-white border-gray-100" : "bg-[#1a5c38]/5 border-[#1a5c38]/20"
                }`}
              >
                <div className={`p-2 rounded-full flex-shrink-0 ${colorClass}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`font-medium text-sm ${notif.read ? "text-gray-700" : "text-gray-900"}`}>
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <span className="w-2 h-2 bg-[#1a5c38] rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatTime(notif.created_at)}</p>

                  {/* Action links based on type */}
                  {notif.data?.request_id && (
                    <Link
                      to={`/requests`}
                      className="text-xs text-[#1a5c38] font-medium hover:underline mt-1 inline-block"
                      onClick={e => e.stopPropagation()}
                    >
                      View Request →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
