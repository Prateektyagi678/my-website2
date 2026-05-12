(function () {
  var initialized = false;

  function log(msg) {
    var box = document.getElementById("log");
    var line = "[" + new Date().toISOString() + "] " + (msg || "") + "\n";
    box.value = box.value + line;
    box.scrollTop = box.scrollHeight;
    try { console.log(msg); } catch (e) {}
  }

  function initOpenFrame() {
    if (!window.openFrameAPI) {
      log("ERROR: openFrameAPI not loaded.");
      return;
    }

    // init() must be the first OpenFrame API method called. [10](https://www.servicenow.com/docs/r/api-reference/api-reference.html)
    var cfg = { width: 420, height: 720, title: "OF Test", subTitle: "GitHub Origin" };

    window.openFrameAPI.init(
      cfg,
      function success(snConfig) {
        initialized = true;
        log("SUCCESS: init completed. Returned config name=" + (snConfig && snConfig.name ? snConfig.name : "(none)"));
      },
      function failure(err) {
        log("FAILED: init failed: " + JSON.stringify(err));
      }
    );
  }

  function screenPopIncident(sysId) {
    if (!sysId) return log("ERROR: No sys_id to screen pop.");

    // openServiceNowForm is documented for opening records. [10](https://www.servicenow.com/docs/r/api-reference/api-reference.html)[11](https://bing.com/search?q=ServiceNow+documentation+CORS+Rules+create+CORS+rule+System+Web+Services+REST+CORS+Rules+domain+methods+headers+allow+credentials)
    window.openFrameAPI.openServiceNowForm({
      entity: "incident",
      query: "sys_id=" + sysId
    });
    log("Screen pop requested for sys_id=" + sysId);
  }

  function createIncidentAndPop() {
    if (!initialized) log("NOTE: Init OpenFrame first (recommended).");

    var base = document.getElementById("snBase").value.trim().replace(/\/$/, "");
    var user = document.getElementById("snUser").value.trim();
    var pass = document.getElementById("snPass").value;
    var rawPayload = document.getElementById("payload").value;

    if (!base) return log("ERROR: ServiceNow base URL is empty.");
    if (!user || !pass) return log("ERROR: Provide integration username/password (Basic Auth test).");

    var payload;
    try { payload = JSON.parse(rawPayload); }
    catch (e) { return log("ERROR: Invalid JSON payload: " + e.message); }

    // Table API default URL format: /api/now/table/{tableName}. [6](https://www.cisco.com/c/en/us/support/docs/contact-center/finesse/221598-understand-uccx-finesse-architecture-dee.html)
    // POST inserts one record. [6](https://www.cisco.com/c/en/us/support/docs/contact-center/finesse/221598-understand-uccx-finesse-architecture-dee.html)
    var url = var url = base + "/api/openframe_github_test/incident";";
    log("POST " + url);

    fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        // Basic Auth is a supported inbound REST authentication method. [5](https://github.com/mayur-hajare/ServiceNow-Documents)
        "Authorization": "Basic " + btoa(user + ":" + pass)
      },
      body: JSON.stringify(payload)
    })
    .then(function (res) {
      return res.text().then(function (txt) {
        return { ok: res.ok, status: res.status, text: txt };
      });
    })
    .then(function (r) {
      log("Response HTTP " + r.status);
      if (!r.ok) {
        log("ERROR: POST failed. Body: " + r.text);
        return;
      }

      var data = {};
      try { data = JSON.parse(r.text); } catch (e) {}

      var sysId = (data && data.result && data.result.sys_id) ? data.result.sys_id : null;
      if (!sysId) return log("ERROR: sys_id not found in response.");

      log("SUCCESS: Incident created sys_id=" + sysId);
      screenPopIncident(sysId);
    })
    .catch(function (e) {
      log("ERROR: fetch exception: " + e.message);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("btnInit").addEventListener("click", initOpenFrame);
    document.getElementById("btnCreate").addEventListener("click", createIncidentAndPop);
    log("Ready.");
  });
})();
