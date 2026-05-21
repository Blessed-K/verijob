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

function extractPageContent() {
  const visibleText = document.body.innerText || "";

  const links = Array.from(document.querySelectorAll("a"))
    .map(link => link.href)
    .filter(Boolean)
    .join(" ");

  return visibleText + " " + links;
}