🏥 Health Compass Agent: Triage and Localized Guidance


This project develops an Agentic Triage and Guidance System designed to provide instant, actionable health advice tailored to the user's specific location. The goal is to improve reliability and speed in accessing crucial medical information during emergencies.

🌟 Core Project Value


The Health Compass Agent is built to be a reliable decision-making companion, solving the limitations of traditional, generic symptom checkers:

1. Severity Triage: The agent analyzes user symptoms to instantly classify
   the illness into one of three critical categories: Mild, Normal, or
   Dangerous.
2. Localized Guidance: For Dangerous conditions, the system uses stored
   geographical data to recommend the nearest, most appropriate hospital
   based on the disease's required specialty within the user's registered
   district.
3. Non-API Reliability: This initial Non-API design validates the core logic
   using only local JSON knowledge bases, ensuring the system remains fast,
   responsive, and fully operational even if external connectivity is lost.

🛠️ Technical Implementation Highlights


The agent's functionality is powered by robust JavaScript (ES6+) logic and architecture, built around agentic principles:

A. State Management and Control Flow

The agent operates using a strict Complex State Machine (GET_DISTRICT $\rightarrow$ GET_SYMPTOMS). Diagnosis cannot proceed until the user's district is successfully validated, demonstrating control and sequential integrity in the agent's flow.

B. Natural Language Processing (NLP)
   
The agent processes conversational input effectively. The findDiseaseByName function employs Stop Word Filtering (removing words like "I am suffering from") and Fuzzy Matching logic to quickly isolate the core diagnostic keywords. This allows the user to input full sentences and still get accurate results.

C. Tool Use and Local Data Retrieval

The agent treats the local JSON files (medical_knowledge.json, hospital_data.json) as specialized internal 'tools'. The diagnosis logic demonstrates powerful dual-key data retrieval by querying the hospital database using both the user's district and the disease's required specialty (a multi-parameter search necessary for localized triage).

D. UI/UX and Stability

The application utilizes a Full-Screen Responsive UI with a Fixed Header (for time/new chat) and a Fixed Bottom Input Bar, ensuring maximum stability and usability across all devices.

🚀 Setup and Running Instructions


To run the Health Compass Agent locally, no API keys are required:

1. Files: Ensure all files (index.html, style.css, script.js, and the three
   JSON files) are in the same folder.
2. Live Server: Use the VS Code Live Server extension to launch index.html.
3. Testing: The agent will begin by asking for your district (manual entry
   or use DETECT LOCATION).
