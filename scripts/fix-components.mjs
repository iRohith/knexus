import fs from "fs";
import path from "path";

// Google Drive
const drivePath = path.join(process.cwd(), "app/google-drive/GoogleDriveApp.tsx");
let driveContent = fs.readFileSync(drivePath, "utf-8");
driveContent = driveContent.replace("function ItemRow({", "function ItemRow({\n  id,");
driveContent = driveContent.replace(
  "}: {\n  item: DriveItem;",
  "}: {\n  id?: string;\n  item: DriveItem;",
);
driveContent = driveContent.replace(
  '    <div className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-4 rounded-md p-2 hover:bg-muted/60"',
  '    <div id={id} className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-4 rounded-md p-2 hover:bg-muted/60"',
);
fs.writeFileSync(drivePath, driveContent);

// Jira
const jiraPath = path.join(process.cwd(), "app/jira/JiraApp.tsx");
let jiraContent = fs.readFileSync(jiraPath, "utf-8");
jiraContent = jiraContent.replace("function IssueCard({", "function IssueCard({\n  id,");
jiraContent = jiraContent.replace(
  "}: {\n  issue: JiraIssue;",
  "}: {\n  id?: string;\n  issue: JiraIssue;",
);
jiraContent = jiraContent.replace(
  "    <div\n      onClick={() => onOpen(issue.id)}",
  "    <div\n      id={id}\n      onClick={() => onOpen(issue.id)}",
);
fs.writeFileSync(jiraPath, jiraContent);

console.log("Fixed custom components");
