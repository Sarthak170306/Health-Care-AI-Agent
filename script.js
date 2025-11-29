let medicalData = {};
let drugProtocol = {};
let hospitalData = {};
let userDistrict = null;
let currentState = 'LOADING'; 
const inputField = document.getElementById('user-input');
const sendButton = document.getElementById('send-button'); 
const detectButton = document.getElementById('detect-button'); 
const districtPill = document.getElementById('district-status-pill'); 

const diseaseCountEl = document.getElementById('disease-count');
const districtCountEl = document.getElementById('district-count');
const protocolCountEl = document.getElementById('protocol-count');


const stopWords = new Set([
    'i', 'am', 'suffering', 'from', 'feel', 'feeling', 'have', 'having', 'a', 'an', 'the', 'my', 
    'body', 'is', 'it', 'me', 'and', 'but', 'or', 'with', 'in', 'of', 'due', 'to', 'like', 'symptom',
    'ache', 'pain', 'sore', 'mild', 'severe' 
]);

const validDistricts = new Set(); 

function updateDistrictPill(district) {
    if (!districtPill) return;

    if (district) {
        const formattedName = district.charAt(0).toUpperCase() + district.slice(1);
        districtPill.textContent = formattedName;
        districtPill.style.backgroundColor = 'var(--highlight-color)'; 
        districtPill.style.color = 'var(--bg-color)'; 
        districtPill.style.boxShadow = '0 0 5px rgba(51, 255, 199, 0.5)';
        districtPill.style.border = '1px solid var(--highlight-color)';
    } else {
        districtPill.textContent = 'Awaiting district';
        districtPill.style.backgroundColor = 'var(--detect-color)'; 
        districtPill.style.color = 'var(--bg-color)';
        districtPill.style.boxShadow = '0 0 5px rgba(255, 193, 7, 0.5)';
        districtPill.style.border = '1px solid var(--detect-color)';
    }
}

function updateDatasetStats() {
    if (diseaseCountEl) {
        diseaseCountEl.textContent = medicalData.length || '0';
    }
    if (districtCountEl) {
        districtCountEl.textContent = Object.keys(hospitalData).length || '0';
    }
    if (protocolCountEl) {
        protocolCountEl.textContent = drugProtocol.length || '0';
    }
}

function startNewChat() {
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
        messagesDiv.innerHTML = ''; 
    }
    
    userDistrict = null;
    startConversation();
    updateDistrictPill(null); 
    addMessage("🧹 Chat history cleared. Please enter your district to start a new diagnosis.", 'agent');
    
    if (inputField) {
        inputField.value = '';
        inputField.focus();
    }
}

function getCoordinates() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported by this browser."));
        } else {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                },
                (error) => {
                    reject(new Error(`Permission denied or error code ${error.code}.`));
                }
            );
        }
    });
}

async function getCityName(lat, lon) {
    try {
        const timestamp = new Date().getTime(); 
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&t=${timestamp}`; 
        
        const response = await fetch(url);
        const data = await response.json();
        
        return data.address.city || 
               data.address.county || 
               data.address.state_district || 
               data.address.town || 
               "Unknown Location";
    } catch (error) {
        console.error("Geocoding failed:", error);
        return null;
    }
}

function updateClock() {
    const now = new Date();
    
    const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    
    const dateStr = now.toLocaleDateString('en-IN', dateOptions);
    const timeStr = now.toLocaleTimeString('en-IN', timeOptions);

    const timeDisplayElement = document.getElementById('time-display');
    if (timeDisplayElement) {
        timeDisplayElement.innerHTML = `${dateStr} | ${timeStr}`;
    }
}

async function detectUserLocation() {
    if (currentState !== 'GET_DISTRICT') return;
    
    sendButton.disabled = true;
    detectButton.disabled = true;
    inputField.disabled = true;

    addMessage("Searching for your current location... Please grant permission if prompted by the browser.", 'agent');
    
    try {
        const coords = await getCoordinates();
        const detectedCity = await getCityName(coords.lat, coords.lon);
        
        if (!detectedCity || detectedCity === "Unknown Location") {
             throw new Error("Could not pinpoint a recognizable city/district.");
        }
        
        const validatedCity = detectedCity.toLowerCase();
        
        if (validDistricts.has(validatedCity)) {
            userDistrict = validatedCity;
            currentState = 'GET_SYMPTOMS';
            updateDistrictPill(userDistrict); 
            
            addMessage(`✅ Location detected and registered: ${detectedCity}.`, 'agent');
            addMessage("Now I'm ready to diagnose. Please describe your symptoms or state the disease name.", 'agent');
        } else {
            addMessage(`❌ Location detected (${detectedCity}), but hospital data for this district is unavailable. Please enter your district manually.`, 'agent');
            currentState = 'GET_DISTRICT'; 
        }
        
    } catch (error) {
        console.error("Location Error:", error);
        addMessage(`❌ Location detection failed. Please ensure you granted permission. Error: (${error.message}). Please enter your district manually.`, 'agent');
        currentState = 'GET_DISTRICT';
        
    } finally {
        sendButton.disabled = false;
        detectButton.disabled = false;
        inputField.disabled = false;
        inputField.focus();
    }
}


async function loadJSONData() {
    try {
        const [medRes, drugRes, hospRes] = await Promise.all([
            fetch('medical_knowledge.json'),
            fetch('drug_protocol.json'),
            fetch('hospital_data.json')
        ]);

        medicalData = await medRes.json();
        drugProtocol = await drugRes.json();
        hospitalData = await hospRes.json();
        
        for (const district in hospitalData) {
            validDistricts.add(district.toLowerCase());
        }

        updateDatasetStats();

        startConversation();

    } catch (error) {
        console.error("Error loading JSON data:", error);
        addMessage("🚨 Error: Could not load agent knowledge base. Please check file paths.", 'agent');
        currentState = 'ERROR';
        sendButton.disabled = true;
    }
}

function addMessage(text, sender) {
    const messagesDiv = document.getElementById('messages');
    const msg = document.createElement('div');
    
    const cleanText = text.replace(/\*\*/g, '');
    
    msg.innerHTML = cleanText; 
    msg.className = 'message ' + sender; 
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function startConversation() {
    const initialMsg = document.querySelector('.message.initial');
    if (initialMsg) initialMsg.remove();
    
    currentState = 'GET_DISTRICT';
    sendButton.disabled = false;
    updateDistrictPill(userDistrict); 
    
    addMessage(`Hello! I'm your virtual diagnosis agent. How may I help you today?
                <br><br>Please enter your district, or click the DETECT LOCATION button below.`, 'agent');
    inputField.focus();
}

function findDisease(symptoms) {
    let bestMatch = null;
    let maxMatchCount = 0;
    
    for (const disease of medicalData) { 
        let matchCount = 0;
        
        for (const userInputSymptom of symptoms) {
            if (disease.symptoms.some(ds => ds.toLowerCase().includes(userInputSymptom))) {
                matchCount++;
            }
        }

        if (matchCount > maxMatchCount && matchCount >= 3) { 
            maxMatchCount = matchCount;
            bestMatch = disease;
        }
    }
    return bestMatch; 
}

function findDiseaseByName(input) {
    const lowerInput = input.toLowerCase();
    
    const cleanedInput = lowerInput
        .split(/\s+/)
        .filter(word => !stopWords.has(word))
        .join(' '); 
    
    const foundDisease = medicalData.find(d => 
        d.disease_name.toLowerCase().includes(cleanedInput) 
        || cleanedInput.includes(d.disease_name.toLowerCase())
    );
    
    return foundDisease; 
}

function processDiagnosis(disease) {
    
    let response = `---
                    <br>Diagnosis Result:
                    <br>• Disease: ${disease.disease_name} <br>• Category: ${disease.category}`;

    switch (disease.category) {
        case 'Mild':
            const otc = drugProtocol.find(d => d.approved_for_symptoms.some(s => disease.symptoms.includes(s))) || { medicine_key: "General Painkiller", usage_note: "Please consult the packet instructions." };
            
            response += `<br>---
                         <br>This is a Mild condition. You can try the following OTC remedies:
                         <br>💊 Recommended Medicine: ${otc.medicine_key}
                         <br>⚠️ Precaution/Note: ${otc.usage_note}`;
            break;

        case 'Normal':
            response += `<br>---
                         <br>This is a Normal condition. Medical consultation is advised.
                         <br>💊 Recommended Action/Advice: ${disease.s1_action || "Consult your physician for prescribed medication."}
                         <br>⚠️ General Precaution: Get adequate rest and monitor your symptoms closely.`;
            break;

        case 'Dangerous':
            const districtKey = userDistrict.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            
            const districtData = hospitalData[districtKey] || [];
            let suggestedHospital = null;
            
            response += `<br>---
                         <br>🚨 DANGEROUS ALERT! Your symptoms suggest a potentially severe condition.
                         <br>• Immediate Action: ${disease.s3_trigger}`;

            if (districtData.length > 0) {
                suggestedHospital = districtData.find(h => h.Specialization.toLowerCase().includes(disease.specialty.toLowerCase().split(',')[0].trim())) || districtData[0];
            }

            if (suggestedHospital) {
                response += `<br>---
                             <br>🏥 Hospital Recommendation (Based on ${districtKey}):
                             <br>• Hospital Name: ${suggestedHospital["Hospital Name"]}
                             <br>• Speciality: ${suggestedHospital.Specialization}
                             <br>• Locality: ${suggestedHospital["Area/Locality"]}`;
            } else {
                 response += `<br>---
                              <br>🏥 Note: Could not find a specialized hospital in your district (${districtKey}). Please visit the nearest major hospital immediately.`;
            }
            break;
    }
    
    response += "<br>---<br>Disclaimer: I am a virtual agent and cannot replace a doctor. Please consult a professional physician.";
    
    const pillHtml = `<span class="category-pill" data-category="${disease.category}">${disease.category}</span>`;
    
    const msg = document.createElement('div');
    const cleanText = response.replace(/\*\*/g, '');
    msg.innerHTML = cleanText; 
    
    msg.innerHTML += pillHtml; 
    
    msg.className = 'message agent'; 
    document.getElementById('messages').appendChild(msg);
    document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;

    currentState = 'GET_SYMPTOMS'; 
    
    addMessage("✅ Diagnosis complete. You can now enter new symptoms or a disease name for another diagnosis. To change your district, please use the **NEW CHAT** button.", 'agent');
}


function sendMessage() {
    const userInput = inputField.value.trim();

    if (userInput === '' || currentState === 'LOADING' || currentState === 'ERROR') return;

    addMessage(userInput, 'user');
    inputField.value = ''; 

    switch (currentState) {
        case 'GET_DISTRICT':
            const inputDistrict = userInput.toLowerCase(); 
            
            if (!validDistricts.has(inputDistrict)) {
                addMessage(`❌ Error: Sorry, I do not have hospital data for the district: ${userInput}. Please enter a valid district from my knowledge base.`, 'agent');
                currentState = 'GET_DISTRICT'; 
                break; 
            }

            userDistrict = inputDistrict; 
            currentState = 'GET_SYMPTOMS';
            updateDistrictPill(userDistrict); 
            addMessage(`Ok! Your district (${userInput}) has been registered.
                        <br><br>Now I'm ready to diagnose. Please describe your symptoms in simple words, a short sentence, or simply state the disease name if you know it (e.g., Common Cold).`, 'agent');
            break;

        case 'GET_SYMPTOMS':
            
            const diseaseByName = findDiseaseByName(userInput);
            if (diseaseByName) {
                addMessage(`🔍 Recognized disease name: ${diseaseByName.disease_name}. Providing advice based on this.`, 'agent');
                processDiagnosis(diseaseByName);
                break;
            }
            
            const processedSymptoms = userInput.toLowerCase()
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"") 
                .split(/\s+/) 
                .filter(word => word.length > 0 && !stopWords.has(word));
            
            const symptoms = processedSymptoms;
            
            if (symptoms.length === 0) {
                 addMessage("I need at least one descriptive keyword (e.g., 'fever', 'headache', 'dizziness') to diagnose. Please try again.", 'agent');
                 break;
            }

            const diagnosedResult = findDisease(symptoms); 

            if (diagnosedResult) {
                processDiagnosis(diagnosedResult);
            } else {
                addMessage("I couldn't find a strong match for those symptoms or the disease name in my knowledge base. Please try describing your symptoms again, or consult a doctor.", 'agent');
                currentState = 'GET_SYMPTOMS'; 
            }
            break;
    }
}

window.onload = loadJSONData;

inputField.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

setInterval(updateClock, 1000);