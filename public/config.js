// The only file to edit after copying a production build.
//
// Dev (npm run dev): leave apiBase as /api/v1. Vite forwards /api to http://127.0.0.1:8091.
//
// Same Tomcat, backend deployed as webapps/gis-warplan.war, UI copied to webapps/ROOT:
//   apiBase: "/gis-warplan/api/v1"
//
// UI and API on different machines or different Tomcats:
//   apiBase: "http://192.168.1.4:8180/gis-warplan/api/v1"
//   and set WARPLAN_CORS_ORIGINS on the API to the UI origin, for example
//   http://192.168.1.4
window.warplan = {
  apiBase: "/api/v1"
}
