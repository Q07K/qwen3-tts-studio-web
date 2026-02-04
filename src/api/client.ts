import axios from 'axios';

// baseURL is removed so it uses the current origin (localhost:5173),
// which Vite will proxy to the backend.
const apiClient = axios.create({
  // Axios automatically sets Content-Type based on data (e.g., application/json for objects, multipart/form-data for FormData)
});

export default apiClient;
