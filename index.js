const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const {
  CLIENT_ID,
  CLIENT_SECRET,
  APIGW_CLIENT_ID,
  APIGW_CLIENT_SECRET
} = process.env;

// Hämta token
async function getToken() {
  const resp = await axios.post(
    "https://oauth.skatteverket.se/token",
    new URLSearchParams({
      grant_type: "client_credentials",
      scope: "fos rattsligaregler"
    }),
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
  return resp.data.access_token;
}

// Proxya alla GET-anrop
app.get("/*", async (req, res) => {
  try {
    const token = await getToken();
    const url = `https://api.skatteverket.se${req.path}`;
    const apiRes = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-ibm-client-id": APIGW_CLIENT_ID,
        "x-ibm-client-secret": APIGW_CLIENT_SECRET
      },
      params: req.query
    });
    res.json(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
