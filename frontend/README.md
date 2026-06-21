# VeriJob Frontend

React/Vite frontend for the VeriJob fraud detection API.

## Run locally

From the project root, start the FastAPI backend:

```bash
python -m uvicorn src.api:app --reload
```

Then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend calls `/api/predict`. In development, Vite proxies `/api/*` to `http://127.0.0.1:8000/*`, so the backend does not need to be changed for CORS.

## Run as a Chrome extension

Start the backend first:

```bash
python -m uvicorn src.api:app --reload
```

Build the extension popup:

```bash
cd frontend
npm install
npm run build
```

In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `frontend/dist`.

When loaded as an extension, the popup scans the active tab with `chrome.scripting`, extracts the job description text and links, sends them to `http://127.0.0.1:8000/predict`, and renders the backend response.

To point the frontend at another backend during development, set:

```bash
VITE_API_TARGET=http://127.0.0.1:8000 npm run dev
```

To build a version that calls a specific deployed API URL, set:

```bash
VITE_API_BASE_URL=https://your-api.example.com npm run build
```
