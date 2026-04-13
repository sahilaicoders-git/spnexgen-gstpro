export type SidebarMenuItem = {
  id: string;
  label: string;
};

export type SidebarMenuGroup = {
  id: string;
  label: string;
  icon: string;
  children?: SidebarMenuItem[];
};

export const sidebarMenuConfig: SidebarMenuGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  {
    id: "clients",
    label: "Clients",
    icon: "users",
    children: [
      { id: "clients-select", label: "Select Client" },
      { id: "clients-add", label: "Add Client" },
      { id: "clients-manage", label: "Manage Clients" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: "receipt",
    children: [
      { id: "sales-add", label: "Add Sale" },
      { id: "sales-summary", label: "Sales Summary" },
      { id: "sales-export", label: "Export Sales" },
    ],
  },
  {
    id: "purchase",
    label: "Purchase",
    icon: "receipt",
    children: [
      { id: "purchase-import", label: "Import Purchases" },
      { id: "purchase-add", label: "Add Purchase" },
      { id: "purchase-summary", label: "Purchase Summary" },
    ],
  },
  {
    id: "gst-returns",
    label: "GST Returns",
    icon: "file-text",
    children: [
      { id: "gstr1", label: "GSTR-1" },
      { id: "gstr3b", label: "GSTR-3B" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "bar-chart",
    children: [
      { id: "report-preview", label: "Reports Preview" },
      { id: "report-monthly", label: "Monthly Report" },
      { id: "report-gst", label: "GST Summary" },
      { id: "report-yearly", label: "Yearly Turnover" },
    ],
  },
  {
    id: "data",
    label: "Data",
    icon: "database",
    children: [
      { id: "data-import", label: "Import Data" },
      { id: "data-export", label: "Export Data" },
      { id: "data-backup", label: "Backup" },
      { id: "data-restore", label: "Restore" },
    ],
  },
  {
    id: "utilities",
    label: "Utilities",
    icon: "calculator",
    children: [
      { id: "util-calc", label: "GST Calculator" },
      { id: "util-hsn", label: "HSN Code Finder" },
      { id: "util-invoice", label: "Invoice Generator" },
      { id: "util-backup", label: "Backup & Restore" },
      { id: "util-json", label: "JSON Viewer" },
    ],
  },
  {
    id: "online",
    label: "Online",
    icon: "wifi",
    children: [
      { id: "online-login", label: "Login to GST Portal" },
      { id: "online-dashboard", label: "GST Dashboard" },
    ],
  },
  { id: "settings", label: "Settings", icon: "settings" },
];
