(function () {
  let initialized = false;

  // --- Logging helpers ---
  function log(msg) {
    const box = document.getElementById("log");
    const line = "[" + new Date().toISOString() + "] " + (msg || "") + "\n";
    if (box) {
      box.value += line;
      box.scrollTop = box.scrollHeight;
    }
    try { console.log(msg); } catch (e) {}
  }

  // Log JS errors so “nothing happens” is diagnosable
  window.addEventListener("error", function (e) {
    log("JS ERROR: " + (e.message || "unknown") + " @ " + (e.filename || "") + ":" + (e.lineno || ""));
  });

  window.addEventListener("unhandledrejection", function (e) {
    log("PROMISE REJECTION: " + (e.reason ? (e.reason.message || e.reason) : "unknown"));
  });

  function getEl(id) { return document.getElementById(id); }

  function getAuthHeader() {
    const type = (getEl("authType")?.value || "basic").toLowerCase();

    if (type === "none") return null;

    if (type === "bearer") {
      const token = (getEl("bearer")?.value || "").trim();
      if (!token) throw new Error("Bearer token is empty.");
      return "Bearer " + token;
    }

    // basic
    const user = (getEl("snUser")?.value || "").trim();
    const pass = (getEl("snPass")?.value || "");
    if (!user || !pass) throw new Error("Basic Auth username/password is empty.");
    return "Basic " + btoa(user + ":" + pass);
  }

  function parsePayload() {
    const raw = getEl("payload")?.value || "";
    try { return JSON.parse(raw); }
    catch (e) { throw new Error("Payload JSON invalid: " + e.message); }
  }

  // --- OpenFrame Init (must be first OpenFrame API call) ---
  function initOpenFrame() {
    if (!window.openFrameAPI) {
      log("ERROR: openFrameAPI is not loaded. Check openFrameAPI.min.js script tag.");
      return;
    }

    // init must be the first method you call. [1](https://help.genesys.cloud/articles/create-an-openframe-configuration-in-servicenow/)
    const cfg = { width: 420, height: 720, title: "OF Test", subTitle: "GitHub Adapter" };

    window.openFrameAPI.init(
      cfg,
      function (snConfig) {
        initialized = true;
        log("SUCCESS: init completed. Config name=" + (snConfig && snConfig.name ? snConfig.name : "(none)"));
      },
      function (err) {
        log("FAILED: init failed: " + JSON.stringify(err));
      }
    );
  }

  // --- Screen pop helper ---
  function screenPopIncident(sysId) {
    if (!window.openFrameAPI) return log("ERROR: openFrameAPI not available.");
    if (!sysId) return log("ERROR: sys_id missing for screen pop.");

    // openServiceNowForm is the documented way to open a record from OpenFrame. [1](https://help.genesys.cloud/articles/create-an-openframe-configuration-in-servicenow/)
    window.openFrameAPI.openServiceNowForm({
      entity: "incident",
      query: "sys_id=" + sysId
    });

    log("Screen pop requested for sys_id=" + sysId);
  }

  // --- Create incident via Scripted REST API ---
  async function createIncidentAndPop() {
    if (!initialized) log("NOTE: Init OpenFrame first (recommended).");

    const apiUrl = (getEl("apiUrl")?.value || "").trim();
    if (!apiUrl) return log("ERROR: Scripted REST API URL is empty.");

    let payload;
    try { payload = parsePayload(); }
    catch (e) { return log("ERROR: " + e.message); }

    let auth;
    try { auth = getAuthHeader(); }
    catch (e) { return log("ERROR: " + e.message); }

    log("POST " + apiUrl);

    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json"
    };
    if (auth) headers["Authorization"] = auth;

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      log("Response HTTP " + res.status);

      if (!res.ok) {
        log("ERROR: POST failed. Body: " + text);
        return;
      }

      let data = {};
      try { data = JSON.parse(text); } catch (e) {}

      // Expected response shape: { result: { sys_id: "..." } }
      const sysId = data && data.result && data.result.sys_id ? data.result.sys_id : null;
      if (!sysId) {
        log("ERROR: sys_id not found in response: " + text);
        return;
      }

      log("SUCCESS: Incident created sys_id=" + sysId);
      screenPopIncident(sysId);

    } catch (e) {
      log("ERROR: fetch exception: " + (e.message || e));
    }
  }

  // --- Bind handlers ---
  document.addEventListener("DOMContentLoaded", function () {
    log("Adapter loaded. Page origin=" + location.origin);
    log("openFrameAPI type=" + typeof window.openFrameAPI);

    const btnInit = getEl("btnInit");
    const btnCreate = getEl("btnCreate");

    if (!btnInit || !btnCreate) {
      log("ERROR: Buttons not found. Check ids btnInit / btnCreate in HTML.");
      return;
    }

    btnInit.addEventListener("click", initOpenFrame);
    btnCreate.addEventListener("click", createIncidentAndPop);

    log("Handlers attached. Click 'Init OpenFrame'.");
  });
})();
