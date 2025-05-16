const fs = require("fs");
const path = require("path");
const permissions = require("./permissions");

function trimCode(code, maxLength = 1000) {
  return code.length > maxLength
    ? code.substring(0, maxLength) + "\n... (trimmed)"
    : code;
}

function loadProjectFiles(
  dir,
  allowedExtensions = [".js", ".json"],
  extraAllowedFiles = []
) {
  let result = {};
  const files = fs.readdirSync(dir);

  //   const allowedFilesForRole = permissions[userRole] || []; // fetch allowed files based on role

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      result = {
        ...result,
        ...loadProjectFiles(fullPath, allowedExtensions, extraAllowedFiles),
      };
    } else if (
      allowedExtensions.some((ext) => file.endsWith(ext)) ||
      extraAllowedFiles.includes(file)
    ) {
      result[fullPath] = fs.readFileSync(fullPath, "utf-8");
    }
  }
  return result;
}

function findProjectRoot() {
  let currentDir = __dirname;
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  throw new Error("Could not find project root (package.json not found).");
}

function getRecentFiles(allFiles, limit = 5) {
  const sorted = Object.entries(allFiles).sort((a, b) => {
    try {
      const aTime = fs.statSync(a[0]).mtimeMs;
      const bTime = fs.statSync(b[0]).mtimeMs;
      return bTime - aTime;
    } catch (e) {
      console.error(`⚠️ Error getting file stats for ${a[0]}:`, e);
      return 0;
    }
  });

  return sorted
    .slice(0, limit)
    .map(([filePath, content]) => `FILE: ${filePath}\n${trimCode(content)}`);
}

// ✅ This is the main function you should call to get all project files
function getAllProjectFiles() {
  const root = findProjectRoot();
  return loadProjectFiles(root);
}

module.exports = {
  getAllProjectFiles, // returns all .js/.json files from root
  getRecentFiles,
  trimCode,
  findProjectRoot,
  loadProjectFiles,
};
