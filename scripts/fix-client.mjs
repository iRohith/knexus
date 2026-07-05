import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const files = execSync('find app -name "*.tsx"').toString().split("\n").filter(Boolean);

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, "utf-8");

  const badStart =
    'import { useScrollToSelected } from "@/hooks/use-scroll-to-selected";\n"use client";';
  if (content.startsWith(badStart)) {
    content =
      '"use client";\nimport { useScrollToSelected } from "@/hooks/use-scroll-to-selected";' +
      content.slice(badStart.length);
    fs.writeFileSync(filePath, content);
  }
}
console.log("Fixed use client");
