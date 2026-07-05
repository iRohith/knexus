import fs from "fs";
import path from "path";

const fixes = {
  "app/gmail/GmailApp.tsx": {
    from: "useScrollToSelected(selectedId);",
    to: 'useScrollToSelected(searchParams.get("id"));',
  },
  "app/github/GitHubApp.tsx": {
    from: "useScrollToSelected(issueId || pullId);",
    to: 'useScrollToSelected(searchParams.get("issue") || searchParams.get("pr"));',
  },
  "app/jira/JiraApp.tsx": {
    from: "useScrollToSelected(issueId);",
    to: 'useScrollToSelected(searchParams.get("issue"));',
  },
  "app/linear/LinearApp.tsx": {
    from: "useScrollToSelected(issueId);",
    to: 'useScrollToSelected(searchParams.get("issue"));',
  },
  "app/hubspot/HubSpotApp.tsx": {
    from: "useScrollToSelected(contactId || dealId || companyId);",
    to: 'useScrollToSelected(searchParams.get("contact") || searchParams.get("deal") || searchParams.get("company"));',
  },
  "app/google-drive/GoogleDriveApp.tsx": {
    from: "useScrollToSelected(fileId || folderId);",
    to: 'useScrollToSelected(searchParams.get("file") || searchParams.get("folder"));',
  },
  "app/confluence/ConfluenceApp.tsx": {
    from: "useScrollToSelected(pageId);",
    to: 'useScrollToSelected(searchParams.get("page"));',
  },
  "app/fireflies/FirefliesApp.tsx": {
    from: "useScrollToSelected(meetingId);",
    to: 'useScrollToSelected(searchParams.get("meeting"));',
  },
};

for (const [file, { from, to }] of Object.entries(fixes)) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, "utf-8");
  content = content.replace(from, to);
  fs.writeFileSync(filePath, content);
}
console.log("Fixed useScrollToSelected args");
