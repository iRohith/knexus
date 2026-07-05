import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const files = execSync('find app -name "*.tsx"').toString().split("\n").filter(Boolean);

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, "utf-8");

  // Find where it was wrongly injected
  const badImportRegex =
    /\nimport \{ useScrollToSelected \} from "@\/hooks\/use-scroll-to-selected";\n/g;

  if (content.match(badImportRegex)) {
    content = content.replace(badImportRegex, "");
    content = `import { useScrollToSelected } from "@/hooks/use-scroll-to-selected";\n` + content;
    fs.writeFileSync(filePath, content);
  }
}
console.log("Fixed imports");
