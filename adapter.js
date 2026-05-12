(function () {
  let initialized = false;

  function log(msg) {
    const box = document.getElementById("log");
    const line = "[" + new Date().toISOString() + "] " + (msg || "") + "\n";
    if (box) {
      box.value += line;
      box.scrollTop = box.scrollHeight;
    }
    try { console.log(msg); } catch (e) {}
  }

  // Make silent failures visible
  window.addEventListener("error", function (e) {
    log("JS ERROR: " + (e.message || "unknown") + " @ " + (e.filename || "") + ":" + (e.lineno || ""));
  });

  window.addEventListener("unhandledrejection", function (e) {
    log("PROMISE REJECTION: " + (e.reason ? (e.reason.message || e.reason) : "unknown"));
  });

  function el(id) { return document.getElementById(id); }

  function getBasicAuthHeader() {
    const user = (el("snUser")?.value || "").trim();
    const pass = (el("snPass")?.value || "");
    if (!user || !pass) throw new Error("Basic Auth username/password is empty.");
    return "Basic " + btoa(user + ":" + pass);
  }

  function parsePayload() {
    const raw = el("payload")?.value || "";
    try { return JSON.parse(raw); }
    catch (e) { throw new Error("Payload JSON invalid: " + e.message); }
  }

  // Init OpenFrame (must be first OpenFrame API call) [3](https://help.genesys.cloud/articles/create-an-openframe-configuration-in-servicenow/)
  function initOpenFrame() {
    if (!window.openFrameAPI) {
      log("ERROR: openFrameAPI is not loaded. Check openFrameAPI.min.js script tag.");
      return;
    }

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

  // Screen pop (documented OpenFrame method) [3](https://help.genesys.cloud/articles/create-an-openframe-configuration-in-servicenow/)
  function screenPopIncident(sysId) {
    if (!window.openFrameAPI) return log("ERROR: openFrameAPI not available.");
    if (!sysId) return log("ERROR: sys_id missing for screen pop.");

    window.openFrameAPI.openServiceNowForm({
      entity: "incident",
      query: "sys_id=" + sysId
    });

    log("Screen pop requested for sys_id=" + sysId);
  }

  async function createIncidentAndPop() {
    if (!initialized) log("NOTE: Init OpenFrame first (recommended).");

    const apiUrl = (el("apiUrl")?.value || "").trim();
    if (!apiUrl) return log("ERROR: Scripted REST API URL is empty.");

    let payload;
    try { payload = parsePayload(); }
    catch (e) { return log("ERROR: " + e.message); }

    let auth;
    try { auth = getBasicAuthHeader(); }
    catch (e) { return log("ERROR: " + e.message); }

    log("POST " + apiUrl);

    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      // Inbound REST supports Basic Authentication. [2](https://developer.cisco.com/docs/finesse/)
      "Authorization": auth
    };

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

      // Expected response: { result: { sys_id: "..." } }
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

  document.addEventListener("DOMContentLoaded", function () {
    log("Adapter loaded. origin=" + location.origin);
    log("openFrameAPI type=" + typeof window.openFrameAPI);

    const btnInit = el("btnInit");
    const btnCreate = el("btnCreate");

    if (!btnInit || !btnCreate) {
      log("ERROR: Buttons not found. Check ids btnInit / btnCreate in HTML.");
      return;
    }

    btnInit.addEventListener("click", initOpenFrame);
    btnCreate.addEventListener("click", createIncidentAndPop);

    log("Handlers attached. Click 'Init OpenFrame'.");
  });
})();
