(function () {
  let initialized = false;
  let lastIncidentSysId = null;

  function log(msg) {
    const box = document.getElementById("log");
    box.value += `[${new Date().toISOString()}] ${msg}\n`;
    box.scrollTop = box.scrollHeight;
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function getValue(id) {
    const el = getEl(id);
    return el ? el.value : null;
  }

  function getApi() {
    return window.openFrameAPI || null;
  }

  // 1) Init OpenFrame
  function initOpenFrame() {
    const api = getApi();
    if (!api) {
      log("ERROR: openFrameAPI is not loaded. Check script src in index.html.");
      return;
    }

    // init() must be the first OpenFrame API method called. [1](https://developer.cisco.com/docs/finesse/getting-started/)
    const config = { width: 420, height: 720, title: "OF Test", subTitle: "GitHub Adapter" };

    api.init(
      config,
      function initSuccess(snConfig) {
        initialized = true;
        log("SUCCESS: init completed. Received config from instance.");
        log("Returned config name: " + (snConfig?.name || "(none)"));
      },
      function initFailure(err) {
        log("FAILED: init failed: " + JSON.stringify(err));
      }
    );
  }

  // 2) Resize OpenFrame
  function resizeOpenFrame() {
    const api = getApi();
    if (!api) return log("ERROR: openFrameAPI not available.");

    // setSize is documented. [1](https://developer.cisco.com/docs/finesse/getting-started/)
    api.setSize(420, 720);
    log("Requested OpenFrame resize to 420x720.");
  }

  // Helper: Screen pop an incident record
  function screenPopIncident(sysId) {
    const api = getApi();
    if (!api) return log("ERROR: openFrameAPI not available.");
    if (!sysId) return log("ERROR: No sys_id to screen pop.");

    // openServiceNowForm is documented for opening a record. [1](https://developer.cisco.com/docs/finesse/getting-started/)[3](https://community.cisco.com/t5/contact-center/workflow-for-uccx-finesse-api/td-p/4540835)
    api.openServiceNowForm({
      entity: "incident",
      query: "sys_id=" + sysId
    });

    log("Screen pop requested for incident sys_id=" + sysId);
  }

  // 3) Create Incident + Screen Pop
  async function createIncidentAndPop() {
    const api = getApi();
    if (!api) return log("ERROR: openFrameAPI not available.");
    if (!initialized) log("WARNING: OpenFrame not initialized yet. Click 'Init OpenFrame' first.");

    const base = (getValue("snBase") || "").trim().replace(/\/$/, "");
    const user = (getValue("snUser") || "").trim();
    const pass = getValue("snPass") || "";
    const payloadText = getValue("payload") || "";

    if (!base) return log("ERROR: ServiceNow Base URL is empty.");
    if (!user || !pass) return log("ERROR: Provide username and password.");
    if (!payloadText) return log("ERROR: Incident payload is empty.");

    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch (e) {
      return log("ERROR: Payload is not valid JSON: " + e.message);
    }

    // Table API incident create endpoint is documented in ServiceNow REST API Explorer tutorial. [2](https://www.servicenow.com/docs/r/customer-service-management/t_CreateAnOpenFrameConfiguration.html?contentId=H3mcEQnL9UwoKyCTFamIFQ)
    const url = `${base}/api/now/v1/table/incident`;

    log("POST " + url);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          // If you use Authorization header, ensure your CORS rule allows it. [4](https://www.flamingo.run/openframe)
          "Authorization": "Basic " + btoa(`${user}:${pass}`)
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      log("Response status: " + res.status);

      if (!res.ok) {
        log("ERROR: POST failed. Body: " + text);
        log("TIP: If this is a CORS error, verify a CORS rule exists for Table API and your GitHub origin. [4](https://www.flamingo.run/openframe)");
        return;
      }

      let data = {};
      try { data = JSON.parse(text); } catch {}

      const sysId = data?.result?.sys_id;
      if (!sysId) {
        log("ERROR: sys_id not found in response: " + text);
        return;
      }

      lastIncidentSysId = sysId;
      log("SUCCESS: Incident created sys_id=" + sysId);

      screenPopIncident(sysId);

    } catch (e) {
      log("ERROR: Exception during fetch: " + e.message);
    }
  }

  // 4) Pop last incident
  function popLastIncident() {
    if (!lastIncidentSysId) return log("ERROR: No incident has been created yet.");
    screenPopIncident(lastIncidentSysId);
  }

  // Bind UI after DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    log("Page loaded. openFrameAPI type: " + typeof window.openFrameAPI);

    getEl("btnInit").addEventListener("click", initOpenFrame);
    getEl("btnResize").addEventListener("click", resizeOpenFrame);
    getEl("btnCreateIncident").addEventListener("click", createIncidentAndPop);
    getEl("btnPopLast").addEventListener("click", popLastIncident);

    log("Handlers attached. Click 'Init OpenFrame'.");
  });
})();
