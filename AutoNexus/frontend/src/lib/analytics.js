import axios from "axios";
import { API } from "./constants";

// Fire-and-forget event logging. Never throws, never blocks the UI —
// if it fails (offline, backend down) we just skip it silently, since
// analytics should never get in the way of the actual user action.
export const logEvent = (eventType, metadata = {}) => {
  axios.post(`${API}/analytics/event`, { event_type: eventType, metadata }).catch(() => {});
};
