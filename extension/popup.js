document.addEventListener("DOMContentLoaded", () => {
  const scanBtn = document.getElementById("scanBtn");
  const resultDiv = document.getElementById("result");

  scanBtn.addEventListener("click", async () => {
    resultDiv.innerHTML = "Scanning...";

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPageContent
      });

      if (!isJobPage(result)) {
        resultDiv.innerHTML =
        "<b>This does not appear to be a job listing page. <b>";
        return;
      }


      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          job_text: result
        })
      });

      const data = await response.json();

      resultDiv.innerHTML = `
        <strong>Prediction:</strong> ${data.prediction}<br>
        <strong>Fraud Probability:</strong> ${data.fraud_probability}%<br>
        <strong>Domain Risk:</strong> ${data.domain_analysis.domain_risk}<br>
        <strong>Flags:</strong> ${data.domain_analysis.risk_flags.join(", ") || "None"}
      `;
    } catch (error) {
      resultDiv.innerHTML = "Error scanning page. Make sure the VeriJob API is running.";
      console.error(error);
    }
  });
});

function isJobPage(text) {
  const keywords = [
    "job",
    "vacancy",
    "requirements",
    "responsibilities",
    "qualifications",
    "apply",
    "salary",
    "application",
    "employment",
    "full time",
    "part time",
    "internship",

  //add more keywords when needed
  ];
  const lower = text.toLowerCase();
  let matches = 0;

  for (const word of keywords) {
    if(lower.includes(word))
      matches++;
  }

  return matches >= 3;

}

function extractPageContent() {
  const selectors = [
    "article",
    "[role='main']",
    "main",
    ".job-description",
    ".jobDescription",
    ".job-details",
    ".job-details-description",
    ".description",
    ".details",
    ".posting",
    ".vacancy",
    ".job-post",
    ".job",
    ".content"

  ];

  let extractedText = "";

  for (const selector of selectors) {
    const element = document.querySelector(selector);

    if (element) {
      extractedText = element.innerText;
      break;
    }
  }

  if (!extractedText) {
    extractedText = document.body.innerText;
  }

  const links = Array.from(document.querySelectorAll("a"))
  .map(a => a.href)
  .filter(Boolean)
  .join("\n");

  extractedText = extractedText
  .replace(/\n{3,}/g,"\n\n")
  .replace(/[ \t]+/g," ")
  .trim();

  return extractedText + "\n\n" + links;
}