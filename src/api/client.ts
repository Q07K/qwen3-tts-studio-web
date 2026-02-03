import axios from 'axios';

// baseURL is removed so it uses the current origin (localhost:5173),
// which Vite will proxy to the backend.
const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
