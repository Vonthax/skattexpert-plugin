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

// 1) Proxy för token-utbyte (Client Credentials)
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
          Authorization: "Basic " + Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );
    res.json(tokenResp.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { error: e.message });
  }
});

// 2) Hjälp-funktion för interna anrop (hämtar access_token)
async function getToken() {
  const resp = await axios.post(
    "https://oauth.skatteverket.se/token",
    new URLSearchParams({
      grant_type: "client_credentials",
      scope: "fos rattsligaregler"
    }),
    {
      headers: {
        Authorization: "Basic " + Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
  return resp.data.access_token;
}

// 3) Rättsliga regler: lista alla operationer
app.get("/rattsregler", async (req, res) => {
  try {
    const token = await getToken();
    const apiRes = await axios.get(
      "https://api.skatteverket.se/regelverk/rattsligaregler/v1",
      {
        headers: {
          Authorization: "Bearer " + token,
          "x-ibm-client-id": APIGW_CLIENT_ID,
          "x-ibm-client-secret": APIGW_CLIENT_SECRET
        }
      }
    );
    res.json(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { error: e.message });
  }
});

// 4) Rättsliga regler: hämta en specifik operation
app.get("/rattsregler/:operation", async (req, res) => {
  try {
    const operation = req.params.operation;
    const token = await getToken();
    const apiRes = await axios.get(
      "https://api.skatteverket.se/regelverk/rattsligaregler/v1/" + operation,
      {
        headers: {
          Authorization: "Bearer " + token,
          "x-ibm-client-id": APIGW_CLIENT_ID,
          "x-ibm-client-secret": APIGW_CLIENT_SECRET
        }
      }
    );
    res.json(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { error: e.message });
  }
});

// 5) Skatteavdrag v2.0: enstaka personnummer
app.get("/skatteavdrag/v2.0/:personnummer", async (req, res) => {
  try {
    const pnr = req.params.personnummer.replace(/\D/g, "");
    const token = await getToken();
    const apiRes = await axios.get(
      "https://api.skatteverket.se/skatteavdrag/v2.0/" + pnr,
      {
        headers: {
          Authorization: "Bearer " + token,
          "x-ibm-client-id": APIGW_CLIENT_ID,
          "x-ibm-client-secret": APIGW_CLIENT_SECRET,
          "skv_client_correlation_id": pnr
        }
      }
    );
    res.json(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { error: e.message });
  }
});

// 6) Skatteavdrag v2.0: flera personnummer (query)
app.get("/skatteavdrag/v2.0", async (req, res) => {
  try {
    const arr = (req.query.personnummer || "").split(",");
    const clean = arr.map(p => p.replace(/\D/g, "")).slice(0, 1000);
    const token = await getToken();
    const apiRes = await axios.get(
      "https://api.skatteverket.se/skatteavdrag/v2.0?personnummer=" + clean.join(","),
      {
        headers: {
          Authorization: "Bearer " + token,
          "x-ibm-client-id": APIGW_CLIENT_ID,
          "x-ibm-client-secret": APIGW_CLIENT_SECRET,
          "skv_client_correlation_id": clean.join("")
        }
      }
    );
    res.json(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { error: e.message });
  }
});

// 7) F-skatt-status
app.get("/foretag/:orgnr/f-skatt", async (req, res) => {
  try {
    const org = req.params.orgnr.replace(/\D/g, "");
    const token = await getToken();
    const apiRes = await axios.get(
      "https://api.skatteverket.se/foretag/" + org + "/f-skatt",
      {
        headers: {
          Authorization: "Bearer " + token,
          "x-ibm-client-id": APIGW_CLIENT_ID,
          "x-ibm-client-secret": APIGW_CLIENT_SECRET
        }
      }
    );
    res.json(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).json(e.response?.data || { error: e.message });
  }
});

// 8) Catch-all för övriga GET-anrop
app.get("/*", async (req, res) => {
  try {
    const token = await getToken();
    const url = "https://api.skatteverket.se" + req.path;
    const apiRes = await axios.get(url, {
      headers: {
        Authorization: "Bearer " + token,
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
