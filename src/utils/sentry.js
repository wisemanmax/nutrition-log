export const SentryUtil = {
  identify: (email, name) => {
    if (typeof Sentry === "undefined") return;
    Sentry.setUser({ email, username: name || email.split("@")[0] });
  },
  reset: () => { if (typeof Sentry !== "undefined") Sentry.setUser(null); },
  capture: (err, context) => {
    if (typeof Sentry === "undefined") { console.error(err); return; }
    Sentry.withScope(scope => {
      if (context) Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(err);
    });
  },
  breadcrumb: (msg, category, data) => {
    if (typeof Sentry === "undefined") return;
    Sentry.addBreadcrumb({ message: msg, category: category || "app", data, level: "info" });
  },
};

window.addEventListener("unhandledrejection", e => {
  if (typeof Sentry !== "undefined") Sentry.captureException(e.reason || new Error("Unhandled rejection"));
});
