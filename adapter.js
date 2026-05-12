(function () {
  let initialized = false;
  let lastIncidentSysId = null;

  // Use the endpoint you requested:
  // ServiceNow Table API supports default URL: /api/now/table/{tableName} [1](https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html)
  const INCIDENT_POST_URL = "https://dev393388.service-now.com/api/now/table/incident";

  function log(msg) {
    const box = document.getElementById("log");
    box.value += `[${new Date().toISOString()}] ${msg}\n`;
    box.scrollTop = box.scrollHeight;
  }

  function getApi() {
    return window.openFrameAPI || null;
  }

  // 1) Init OpenFrame
  function initOpenFrame() {
    const api = getApi();
    if (!api) {
      log("ERROR: openFrameAPI not loaded. Check script tag in index.html.");
      return;
    }

    // init() must be the first OpenFrame API method called. [2](https://developer.cisco.com/docs/finesse/getting-started/)
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

  // 2) Resize OpenFrame (optional)
  function resizeOpenFrame() {
    const api = getApi();
    if (!api) return log("ERROR: openFrameAPI not available.");

    // setSize is documented in OpenFrame client API. [2](https://developer.cisco.com/docs/finesse/getting-started/)
    api.setSize(420, 720);
    log("Requested OpenFrame resize to 420x720.");
  }

  // Helper: Screen pop an incident record
  function screenPopIncident(sysId) {
    const api = getApi();
    if (!api) return log("ERROR: openFrameAPI not available.");
    if (!sysId) return log("ERROR: No sys_id to screen pop.");

    // openServiceNowForm is documented to open a record form. [2](https://developer.cisco.com/docs/finesse/getting-started/)[3](https://community.cisco.com/t5/contact-center/workflow-for-uccx-finesse-api/td-p/4540835)
    api.openServiceNowForm({
      entity: "incident",
      query: "sys_id=" + sysId
    });

    log("Screen pop requested for incident sys_id=" + sysId);
  }

  // 3) Create Incident + Screen Pop (Table API default endpoint)
  async function createIncidentAndPop() {
    const api = getApi();
    if (!api) return log("ERROR: openFrameAPI not available.");
    if (!initialized) log("WARNING: OpenFrame not initialized yet. Click 'Init OpenFrame' first.");

    const user = (document.getElementById("snUser")?.value || "").trim();
    const pass = (document.getElementById("snPass")?.value || "");
    const payloadText = (document.getElementById("payload")?.value || "");

    if (!user || !pass) return log("ERROR: Provide username and password.");
    if (!payloadText) return log("ERROR: Incident payload is empty.");

    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch (e) {
      return log("ERROR: Payload is not valid JSON: " + e.message);
    }

    // ServiceNow Table API: POST /api/now/table/{tableName} inserts one record. [1](https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html)
    log("POST " + INCIDENT_POST_URL);

    try {
      const res = await fetch(INCIDENT_POST_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          // If you use Authorization header in browser, ensure your CORS rule allows it. [4](https://www.flamingo.run/openframe)
          "Authorization": "Basic " + btoa(`${user}:${pass}`)
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      log("Response status: " + res.status);

      if (!res.ok) {
        log("ERROR: POST failed. Body: " + text);
        log("TIP: Verify your CORS rule for Table API allows your GitHub origin and required headers/methods. [4](https://www.flamingo.run/openframe)");
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
