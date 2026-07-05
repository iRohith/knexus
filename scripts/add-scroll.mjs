import fs from "fs";
import path from "path";

const apps = [
  {
    file: "app/gmail/GmailApp.tsx",
    idVar: "selectedId",
    keyPattern: /key=\{message\.id\}/g,
    replaceId: "id={message.id} key={message.id}",
  },
  {
    file: "app/github/GitHubApp.tsx",
    idVar: "issueId || pullId",
    keyPattern: /key=\{issue\.id\}/g,
    replaceId: "id={issue.id} key={issue.id}",
  },
  {
    file: "app/github/GitHubApp.tsx",
    idVar: null,
    keyPattern: /key=\{pr\.id\}/g,
    replaceId: "id={pr.id} key={pr.id}",
  },
  {
    file: "app/jira/JiraApp.tsx",
    idVar: "issueId",
    keyPattern: /key=\{issue\.id\}/g,
    replaceId: "id={issue.id} key={issue.id}",
  },
  {
    file: "app/linear/LinearApp.tsx",
    idVar: "issueId",
    keyPattern: /key=\{issue\.id\}/g,
    replaceId: "id={issue.id} key={issue.id}",
  },
  {
    file: "app/hubspot/HubSpotApp.tsx",
    idVar: "contactId || dealId || companyId",
    keyPattern: /key=\{item\.id\}/g,
    replaceId: "id={item.id} key={item.id}",
  },
  {
    file: "app/google-drive/GoogleDriveApp.tsx",
    idVar: "fileId || folderId",
    keyPattern: /key=\{item\.id\}/g,
    replaceId: "id={item.id} key={item.id}",
  },
  {
    file: "app/confluence/ConfluenceApp.tsx",
    idVar: "pageId",
    keyPattern: /key=\{page\.id\}/g,
    replaceId: "id={page.id} key={page.id}",
  },
  {
    file: "app/fireflies/FirefliesApp.tsx",
    idVar: "meetingId",
    keyPattern: /key=\{meeting\.id\}/g,
    replaceId: "id={meeting.id} key={meeting.id}",
  },
  {
    file: "app/slack/SlackApp.tsx",
    idVar: null, // Slack already has its own scroll logic, but we can add id={message.id} if missing
    keyPattern: /key=\{message\.id\}/g,
    replaceId: "id={message.id} key={message.id}",
  },
];

for (const app of apps) {
  const filePath = path.join(process.cwd(), app.file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf-8");

  // Replace key with id and key
  if (app.keyPattern) {
    content = content.replace(app.keyPattern, app.replaceId);
  }

  // Add import and hook call
  if (app.idVar && !content.includes("useScrollToSelected")) {
    const importStatement = `import { useScrollToSelected } from "@/hooks/use-scroll-to-selected";\n`;

    // Find last import
    const lastImportIndex = content.lastIndexOf("import ");
    if (lastImportIndex !== -1) {
      const endOfImport = content.indexOf("\n", lastImportIndex) + 1;
      content = content.slice(0, endOfImport) + importStatement + content.slice(endOfImport);
    } else {
      content = importStatement + content;
    }

    // Find hook insertion point (after searchParams)
    const searchParamsMatch = content.match(/const searchParams = useSearchParams\(\);/);
    if (searchParamsMatch) {
      const insertPos = searchParamsMatch.index + searchParamsMatch[0].length;
      const hookCall = `\n  useScrollToSelected(${app.idVar});`;
      content = content.slice(0, insertPos) + hookCall + content.slice(insertPos);
    }
  }

  fs.writeFileSync(filePath, content);
}
console.log("Done");
