const MOCK_DATA = {
  // Pass your Replit URL here if testing remotely, e.g. "https://sunflower.username.repl.co/api/sync/full"
  // For local testing, we use localhost:3000
  url: "https://c31c6164-e6bc-4810-8f1d-57cc66805330-00-1injtpg0v81pp.sisko.replit.dev/api/sync/full",

  // Replace with your API key if you set one in .env or Replit Secrets
  apiKey: "sunflower123",

  payload: {
    fingerprint: "test-hash-12345",
    all_ids: [1, 2, 3], // Used by n8n to tell backend which rows still exist in the sheet
    rows: [
      // 1. Raw log (Unconfirmed - tức là status: "pending")
      {
        id: 1,
        logged_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        title: "Weekly Planning Sync",
        tag_name: "Planning",
        team: "Alpha",
        docs_url: "https://docs.google.com/document/d/123",
        type: "raw",
        status: "pending",
        tag_mismatch: false
      },
      // 2. Raw log (Unreviewed - tức là status: "confirmed", chờ review đóng dấu)
      {
        id: 2,
        logged_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        title: "Design Review",
        tag_name: "Design",
        team: "Beta",
        docs_url: "https://docs.google.com/document/d/456",
        type: "raw",
        status: "confirmed",
        tag_mismatch: true // VD tag cũ khác tag mới
      },
      // 3. Reviewed log (referencing row 2)
      {
        id: 3,
        logged_at: new Date().toISOString(), // Reviewed just now
        title: "Design Review (Done)",
        tag_name: "Design",
        team: "Beta",
        docs_url: "https://docs.google.com/document/d/456",
        type: "reviewed",
        status: new Date(Date.now() - 25 * 60 * 60 * 1000).toLocaleDateString("en-GB"), // "dd/MM/yyyy" khớp ngày của row 2
        tag_mismatch: false
      }
    ]
  }
};

async function runTest() {
  console.log(`🚀 Sending test data to: ${MOCK_DATA.url}`);

  try {
    const headers = {
      "Content-Type": "application/json"
    };

    // Nếu có API Key thì nhét vào Header
    if (MOCK_DATA.apiKey) {
      headers["x-api-key"] = MOCK_DATA.apiKey;
    }

    const response = await fetch(MOCK_DATA.url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(MOCK_DATA.payload)
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Success! Response from Backend:");
      console.log(JSON.stringify(data, null, 2));
      console.log("\n🌻 Mở Dashboard trên Replit để xem KPI đã nhảy số!");
    } else {
      console.error("❌ Failed! HTTP Status:", response.status);
      console.error("Error from backend:", data);
    }
  } catch (err) {
    console.error("💥 Fetch failed. Is the server running?");
    console.error(err.message);
  }
}

runTest();
