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

// 1) OAuth “authorize” – bara för att ChatGPT-editorn / UI ska få OK.
//    Vi skickar tillbaka en dummy-code till redirect_uri.
app.get("/authorize", (req, res) => {
  const { redirect_uri, state } = req.query;
  if (!redirect_uri) {
    return res.status(400).send("Missing redirect_uri");
  }
  // Bygg retur-URL med code och (om medskickat) state
  const url = new URL(redirect_uri);
  url.searchParams.set("code", "dummy-code");
  if (state) url.searchParams.set("state", state);
  return res.redirect(url.toString());
});

// 2) Token-endpoint: proxar klient-credentials-utbytet
app.post("/token", async (req, res) => {
  try {
    const tokenResp = await axios.post(
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
    res.json(tokenResp.data);
  } catch (e) {
    res
      .status(e.response?.status || 500)
      .json(e.response?.data || { error: e.message });
  }
});

// 3) Helper för att hämta token internt
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

// 4) Catch-all GET → proxar anrop mot Skatteverkets riktiga API
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
    res
      .status(e.response?.status || 500)
      .json(e.response?.data || { error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
