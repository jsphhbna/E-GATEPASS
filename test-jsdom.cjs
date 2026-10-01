const { JSDOM, VirtualConsole } = require("jsdom");

const virtualConsole = new VirtualConsole();
virtualConsole.on("error", (err) => {
  console.error("BROWSER ERROR:", err);
});
virtualConsole.on("warn", (warn) => {
  console.warn("BROWSER WARN:", warn);
});
virtualConsole.on("log", (log) => {
  console.log("BROWSER LOG:", log);
});
virtualConsole.on("jsdomError", (err) => {
  console.error("JSDOM INTERNAL ERROR:", err);
});

JSDOM.fromURL("http://localhost:5174/", {
  runScripts: "dangerously",
  resources: "usable",
  virtualConsole
}).then(dom => {
  setTimeout(() => {
    console.log("HTML:", dom.window.document.body.innerHTML.substring(0, 500));
    process.exit(0);
  }, 2000);
}).catch(err => {
  console.error("JSDOM URL ERROR:", err);
});
