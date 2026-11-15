import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/main.jsx");import __vite__cjsImport0_react_jsxDevRuntime from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=c0d026d4"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/node_modules/.vite/deps/react.js?v=c0d026d4"; const React = __vite__cjsImport3_react.__esModule ? __vite__cjsImport3_react.default : __vite__cjsImport3_react; const useState = __vite__cjsImport3_react["useState"];
import __vite__cjsImport4_reactDom_client from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/node_modules/.vite/deps/react-dom_client.js?v=c0d026d4"; const createRoot = __vite__cjsImport4_reactDom_client["createRoot"];
import { MemoryRouter, Routes, Route } from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/node_modules/.vite/deps/react-router-dom.js?v=c0d026d4";
import AppLayout from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/components/layout/AppLayout.jsx?t=1794773428187";
import ProjectList from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/components/projects/ProjectList.jsx?t=1794772788264";
import Reports from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/components/reports/Reports.jsx?t=1794772327948";
import Dashboard from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/components/dashboard/Dashboard.jsx?t=1794772788264";
import ClientsPage from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/components/clients/ClientsPage.jsx?t=1794772788264";
import InvoicesPage from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/components/invoices/InvoicesPage.jsx?t=1794772953071";
import TaxInvoicesPage from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/components/invoices/TaxInvoicesPage.jsx?t=1794772788264";
import SettingsPage from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/components/settings/SettingsPage.jsx?t=1794773691694";
import DeveloperPage from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/components/developer/DeveloperPage.jsx?t=1794773691111";
import ProjectDetail from "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/components/projects/ProjectDetail.jsx?t=1794772788264";
import { projects } from "/mock/data.js";
import "/@fs/C:/Users/ACER A311/Documents/GitHub/Kontrack/src/styles/globals.css?t=1794773691694";
const PAGES = [
  { key: "projects", label: "Proyek", el: /* @__PURE__ */ jsxDEV(ProjectList, {}, void 0, false, {
    fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
    lineNumber: 39,
    columnNumber: 41
  }, this) },
  { key: "project-detail", label: "Detail Proyek", el: null },
  { key: "reports", label: "Laporan", el: /* @__PURE__ */ jsxDEV(Reports, {}, void 0, false, {
    fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
    lineNumber: 41,
    columnNumber: 41
  }, this) },
  { key: "dashboard", label: "Dashboard", el: /* @__PURE__ */ jsxDEV(Dashboard, {}, void 0, false, {
    fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
    lineNumber: 42,
    columnNumber: 45
  }, this) },
  { key: "clients", label: "Klien", el: /* @__PURE__ */ jsxDEV(ClientsPage, {}, void 0, false, {
    fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
    lineNumber: 43,
    columnNumber: 39
  }, this) },
  { key: "invoices", label: "Invoice", el: /* @__PURE__ */ jsxDEV(InvoicesPage, {}, void 0, false, {
    fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
    lineNumber: 44,
    columnNumber: 42
  }, this) },
  { key: "tax", label: "Faktur Pajak", el: /* @__PURE__ */ jsxDEV(TaxInvoicesPage, {}, void 0, false, {
    fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
    lineNumber: 45,
    columnNumber: 42
  }, this) },
  { key: "settings", label: "Pengaturan", el: /* @__PURE__ */ jsxDEV(SettingsPage, {}, void 0, false, {
    fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
    lineNumber: 46,
    columnNumber: 45
  }, this) },
  { key: "developer", label: "Developer", el: /* @__PURE__ */ jsxDEV(DeveloperPage, {}, void 0, false, {
    fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
    lineNumber: 47,
    columnNumber: 45
  }, this) }
];
const user = { role: "admin", email: "demo@kontrack.id", name: "Nabhan Yuzqi" };
const developerUser = { role: "superadmin", email: "dev@kontrack.id", name: "Developer Platform" };
const Harness = () => {
  _s();
  const [page, setPage] = useState("projects");
  const active = PAGES.find((p) => p.key === page);
  return /* @__PURE__ */ jsxDEV(MemoryRouter, { initialEntries: ["/projects"], children: /* @__PURE__ */ jsxDEV(AppLayout, { currentUser: user, children: [
    /* @__PURE__ */ jsxDEV("div", { className: "mb-4 flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsxDEV("span", { className: "rounded-full glass-3 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Pratinjau" }, void 0, false, {
        fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
        lineNumber: 64,
        columnNumber: 11
      }, this),
      PAGES.map(
        (p) => /* @__PURE__ */ jsxDEV(
          "button",
          {
            "data-preview-nav": p.key,
            onClick: () => setPage(p.key),
            className: `rounded-full px-3 py-1 text-xs font-medium transition-colors ${page === p.key ? "bg-brand-600 text-white" : "glass-3 text-slate-600 hover:text-slate-900"}`,
            children: p.label
          },
          p.key,
          false,
          {
            fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
            lineNumber: 68,
            columnNumber: 11
          },
          this
        )
      )
    ] }, void 0, true, {
      fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
      lineNumber: 63,
      columnNumber: 9
    }, this),
    active.key === "project-detail" ? /* @__PURE__ */ jsxDEV(Routes, { location: { pathname: "/projects/p1" }, children: [
      /* @__PURE__ */ jsxDEV(Route, { path: "/projects/:id", element: /* @__PURE__ */ jsxDEV(ProjectDetail, { currentUser: user }, void 0, false, {
        fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
        lineNumber: 86,
        columnNumber: 50
      }, this) }, void 0, false, {
        fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
        lineNumber: 86,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV(Route, { path: "*", element: /* @__PURE__ */ jsxDEV(ProjectDetail, { currentUser: user }, void 0, false, {
        fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
        lineNumber: 87,
        columnNumber: 38
      }, this) }, void 0, false, {
        fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
        lineNumber: 87,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
      lineNumber: 85,
      columnNumber: 9
    }, this) : React.cloneElement(active.el, {
      currentUser: active.key === "developer" ? developerUser : user
    })
  ] }, void 0, true, {
    fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
    lineNumber: 62,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
    lineNumber: 61,
    columnNumber: 5
  }, this);
};
_s(Harness, "RSsXiOysJyIu8jEP572k9qMHmOw=");
_c = Harness;
createRoot(document.getElementById("root")).render(/* @__PURE__ */ jsxDEV(Harness, {}, void 0, false, {
  fileName: "C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx",
  lineNumber: 99,
  columnNumber: 52
}, this));
var _c;
$RefreshReg$(_c, "Harness");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/Users/ACER A311/Documents/GitHub/Kontrack/.preview/main.jsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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O0FBQUE7QUFBQTtBQUFBLFdBa0JBO0FBQUEsSUFHQ1ksT0FBT1osUUFBUSxtQkFDZCx1QkFBQyxVQUFPLFVBQVUsRUFBRWdCLFVBQVUsZUFBZSxHQUMzQztBQUFBLDZCQUFDLFNBQU0sTUFBSyxpQkFBZ0IsU0FBUyx1QkFBQyxpQkFBYyxhQUFhYixRQUE1QjtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBQWlDLEtBQXRFO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBMEU7QUFBQSxNQUMxRSx1QkFBQyxTQUFNLE1BQUssS0FBSSxTQUFTLHVCQUFDLGlCQUFjLGFBQWFBLFFBQTVCO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBaUMsS0FBMUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUE4RDtBQUFBLFNBRmhFO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FHQSxJQUVBckIsTUFBTW1DLGFBQWFMLE9BQU9WLElBQUk7QUFBQSxNQUM1QmdCLGFBQWFOLE9BQU9aLFFBQVEsY0FBY08sZ0JBQWdCSjtBQUFBQSxJQUM1RCxDQUFDO0FBQUEsT0E5Qkw7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQWdDQSxLQWpDRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBa0NBO0FBRUo7QUFBRU0sR0F6Q0lELFNBQU87QUFBQSxLQUFQQTtBQTJDTnhCLFdBQVdtQyxTQUFTQyxlQUFlLE1BQU0sQ0FBQyxFQUFFQyxPQUFPLHVCQUFDLGFBQUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxPQUFRLENBQUc7QUFBRSxJQUFBQztBQUFBLGFBQUFBLElBQUEiLCJuYW1lcyI6WyJSZWFjdCIsInVzZVN0YXRlIiwiY3JlYXRlUm9vdCIsIk1lbW9yeVJvdXRlciIsIlJvdXRlcyIsIlJvdXRlIiwiQXBwTGF5b3V0IiwiUHJvamVjdExpc3QiLCJSZXBvcnRzIiwiRGFzaGJvYXJkIiwiQ2xpZW50c1BhZ2UiLCJJbnZvaWNlc1BhZ2UiLCJUYXhJbnZvaWNlc1BhZ2UiLCJTZXR0aW5nc1BhZ2UiLCJEZXZlbG9wZXJQYWdlIiwiUHJvamVjdERldGFpbCIsInByb2plY3RzIiwiUEFHRVMiLCJrZXkiLCJsYWJlbCIsImVsIiwidXNlciIsInJvbGUiLCJlbWFpbCIsIm5hbWUiLCJkZXZlbG9wZXJVc2VyIiwiSGFybmVzcyIsIl9zIiwicGFnZSIsInNldFBhZ2UiLCJhY3RpdmUiLCJmaW5kIiwicCIsIm1hcCIsInBhdGhuYW1lIiwiY2xvbmVFbGVtZW50IiwiY3VycmVudFVzZXIiLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwicmVuZGVyIiwiX2MiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsibWFpbi5qc3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgY3JlYXRlUm9vdCB9IGZyb20gJ3JlYWN0LWRvbS9jbGllbnQnO1xuaW1wb3J0IHsgTWVtb3J5Um91dGVyLCBSb3V0ZXMsIFJvdXRlIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XG5pbXBvcnQgQXBwTGF5b3V0IGZyb20gJy4uL3NyYy9jb21wb25lbnRzL2xheW91dC9BcHBMYXlvdXQuanN4JztcbmltcG9ydCBQcm9qZWN0TGlzdCBmcm9tICcuLi9zcmMvY29tcG9uZW50cy9wcm9qZWN0cy9Qcm9qZWN0TGlzdC5qc3gnO1xuaW1wb3J0IFJlcG9ydHMgZnJvbSAnLi4vc3JjL2NvbXBvbmVudHMvcmVwb3J0cy9SZXBvcnRzLmpzeCc7XG5pbXBvcnQgRGFzaGJvYXJkIGZyb20gJy4uL3NyYy9jb21wb25lbnRzL2Rhc2hib2FyZC9EYXNoYm9hcmQuanN4JztcbmltcG9ydCBDbGllbnRzUGFnZSBmcm9tICcuLi9zcmMvY29tcG9uZW50cy9jbGllbnRzL0NsaWVudHNQYWdlLmpzeCc7XG5pbXBvcnQgSW52b2ljZXNQYWdlIGZyb20gJy4uL3NyYy9jb21wb25lbnRzL2ludm9pY2VzL0ludm9pY2VzUGFnZS5qc3gnO1xuaW1wb3J0IFRheEludm9pY2VzUGFnZSBmcm9tICcuLi9zcmMvY29tcG9uZW50cy9pbnZvaWNlcy9UYXhJbnZvaWNlc1BhZ2UuanN4JztcbmltcG9ydCBTZXR0aW5nc1BhZ2UgZnJvbSAnLi4vc3JjL2NvbXBvbmVudHMvc2V0dGluZ3MvU2V0dGluZ3NQYWdlLmpzeCc7XG5pbXBvcnQgRGV2ZWxvcGVyUGFnZSBmcm9tICcuLi9zcmMvY29tcG9uZW50cy9kZXZlbG9wZXIvRGV2ZWxvcGVyUGFnZS5qc3gnO1xuaW1wb3J0IFByb2plY3REZXRhaWwgZnJvbSAnLi4vc3JjL2NvbXBvbmVudHMvcHJvamVjdHMvUHJvamVjdERldGFpbC5qc3gnO1xuaW1wb3J0IHsgcHJvamVjdHMgfSBmcm9tICcuL21vY2svZGF0YS5qcyc7XG5pbXBvcnQgJy4uL3NyYy9zdHlsZXMvZ2xvYmFscy5jc3MnO1xuXG4vLyBQcmF0aW5qYXUgc2VsdXJ1aCBoYWxhbWFuIHN1cGF5YSBhdWRpdCBrb250cmFzL292ZXJsYXAgbWVuY2FrdXAgYXBsaWthc2lcbi8vIHNlYmVuYXJueWEsIGJ1a2FuIGN1bWEgaGFsYW1hbiB5YW5nIGtlYmV0dWxhbiBzdWRhaCBhZGEgZGkgc2luaS5cbmNvbnN0IFBBR0VTID0gW1xuICB7IGtleTogJ3Byb2plY3RzJywgbGFiZWw6ICdQcm95ZWsnLCBlbDogPFByb2plY3RMaXN0IC8+IH0sXG4gIHsga2V5OiAncHJvamVjdC1kZXRhaWwnLCBsYWJlbDogJ0RldGFpbCBQcm95ZWsnLCBlbDogbnVsbCB9LFxuICB7IGtleTogJ3JlcG9ydHMnLCBsYWJlbDogJ0xhcG9yYW4nLCBlbDogPFJlcG9ydHMgLz4gfSxcbiAgeyBrZXk6ICdkYXNoYm9hcmQnLCBsYWJlbDogJ0Rhc2hib2FyZCcsIGVsOiA8RGFzaGJvYXJkIC8+IH0sXG4gIHsga2V5OiAnY2xpZW50cycsIGxhYmVsOiAnS2xpZW4nLCBlbDogPENsaWVudHNQYWdlIC8+IH0sXG4gIHsga2V5OiAnaW52b2ljZXMnLCBsYWJlbDogJ0ludm9pY2UnLCBlbDogPEludm9pY2VzUGFnZSAvPiB9LFxuICB7IGtleTogJ3RheCcsIGxhYmVsOiAnRmFrdHVyIFBhamFrJywgZWw6IDxUYXhJbnZvaWNlc1BhZ2UgLz4gfSxcbiAgeyBrZXk6ICdzZXR0aW5ncycsIGxhYmVsOiAnUGVuZ2F0dXJhbicsIGVsOiA8U2V0dGluZ3NQYWdlIC8+IH0sXG4gIHsga2V5OiAnZGV2ZWxvcGVyJywgbGFiZWw6ICdEZXZlbG9wZXInLCBlbDogPERldmVsb3BlclBhZ2UgLz4gfVxuXTtcblxuY29uc3QgdXNlciA9IHsgcm9sZTogJ2FkbWluJywgZW1haWw6ICdkZW1vQGtvbnRyYWNrLmlkJywgbmFtZTogJ05hYmhhbiBZdXpxaScgfTtcbmNvbnN0IGRldmVsb3BlclVzZXIgPSB7IHJvbGU6ICdzdXBlcmFkbWluJywgZW1haWw6ICdkZXZAa29udHJhY2suaWQnLCBuYW1lOiAnRGV2ZWxvcGVyIFBsYXRmb3JtJyB9O1xuXG4vLyBNZW1vcnlSb3V0ZXIgZGVuZ2FuIGluaXRpYWxFbnRyaWVzICcvcHJvamVjdHMnOiBwZXJpbGFrdSB5YW5nIGJlcmdhbnR1bmcgcGFkYVxuLy8gcGF0aCAobWlzLiBwZW5jYXJpYW4geWFuZyBoYW55YSBtZW55YXJpbmcgZGkgaGFsYW1hbiBQcm95ZWspIHRpZGFrIGJpc2Fcbi8vIGRpdmVyaWZpa2FzaSBrYWxhdSBoYXJuZXNzIGJlcmFkYSBkaSAnLycuXG5jb25zdCBIYXJuZXNzID0gKCkgPT4ge1xuICBjb25zdCBbcGFnZSwgc2V0UGFnZV0gPSB1c2VTdGF0ZSgncHJvamVjdHMnKTtcbiAgY29uc3QgYWN0aXZlID0gUEFHRVMuZmluZCgocCkgPT4gcC5rZXkgPT09IHBhZ2UpO1xuXG4gIHJldHVybiAoXG4gICAgPE1lbW9yeVJvdXRlciBpbml0aWFsRW50cmllcz17WycvcHJvamVjdHMnXX0+XG4gICAgICA8QXBwTGF5b3V0IGN1cnJlbnRVc2VyPXt1c2VyfT5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYi00IGZsZXggZmxleC13cmFwIGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInJvdW5kZWQtZnVsbCBnbGFzcy0zIHB4LTMgcHktMSB0ZXh0LXhzIGZvbnQtc2VtaWJvbGQgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGUgdGV4dC1zbGF0ZS01MDBcIj5cbiAgICAgICAgICAgIFByYXRpbmphdVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICB7UEFHRVMubWFwKChwKSA9PiAoXG4gICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgIGtleT17cC5rZXl9XG4gICAgICAgICAgICAgIGRhdGEtcHJldmlldy1uYXY9e3Aua2V5fVxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRQYWdlKHAua2V5KX1cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgcm91bmRlZC1mdWxsIHB4LTMgcHktMSB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRyYW5zaXRpb24tY29sb3JzICR7XG4gICAgICAgICAgICAgICAgcGFnZSA9PT0gcC5rZXlcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWJyYW5kLTYwMCB0ZXh0LXdoaXRlJ1xuICAgICAgICAgICAgICAgICAgOiAnZ2xhc3MtMyB0ZXh0LXNsYXRlLTYwMCBob3Zlcjp0ZXh0LXNsYXRlLTkwMCdcbiAgICAgICAgICAgICAgfWB9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtwLmxhYmVsfVxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgKSl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICB7LyogUHJvamVjdERldGFpbCBtZW1iYWNhIGlkIGRhcmkgdXNlUGFyYW1zLCBidWthbiBwcm9wOiBoYXJ1cyBkaXJlbmRlclxuICAgICAgICAgICAgbGV3YXQgUm91dGUgYWdhciBqYWx1ciBkZXRhaWwgcHJveWVrIChkYW4gaG9vay1ueWEpIGJlbmFyLWJlbmFyIGRpdWppLiAqL31cbiAgICAgICAge2FjdGl2ZS5rZXkgPT09ICdwcm9qZWN0LWRldGFpbCcgPyAoXG4gICAgICAgICAgPFJvdXRlcyBsb2NhdGlvbj17eyBwYXRobmFtZTogJy9wcm9qZWN0cy9wMScgfX0+XG4gICAgICAgICAgICA8Um91dGUgcGF0aD1cIi9wcm9qZWN0cy86aWRcIiBlbGVtZW50PXs8UHJvamVjdERldGFpbCBjdXJyZW50VXNlcj17dXNlcn0gLz59IC8+XG4gICAgICAgICAgICA8Um91dGUgcGF0aD1cIipcIiBlbGVtZW50PXs8UHJvamVjdERldGFpbCBjdXJyZW50VXNlcj17dXNlcn0gLz59IC8+XG4gICAgICAgICAgPC9Sb3V0ZXM+XG4gICAgICAgICkgOiAoXG4gICAgICAgICAgUmVhY3QuY2xvbmVFbGVtZW50KGFjdGl2ZS5lbCwge1xuICAgICAgICAgICAgY3VycmVudFVzZXI6IGFjdGl2ZS5rZXkgPT09ICdkZXZlbG9wZXInID8gZGV2ZWxvcGVyVXNlciA6IHVzZXJcbiAgICAgICAgICB9KVxuICAgICAgICApfVxuICAgICAgPC9BcHBMYXlvdXQ+XG4gICAgPC9NZW1vcnlSb3V0ZXI+XG4gICk7XG59O1xuXG5jcmVhdGVSb290KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyb290JykpLnJlbmRlcig8SGFybmVzcyAvPik7XG4iXSwiZmlsZSI6IkM6L1VzZXJzL0FDRVIgQTMxMS9Eb2N1bWVudHMvR2l0SHViL0tvbnRyYWNrLy5wcmV2aWV3L21haW4uanN4In0=