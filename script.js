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

// NEW CONSTANT: Minimum required symptom matches for diagnosis
const MIN_SYMPTOM_MATCH = 3; 

// सामान्य 'Stop Words' जो निदान में मदद नहीं करते हैं (कुछ सामान्य शब्दों को ओवरलैप से बचने के लिए हटाया गया)
const stopWords = new Set([
    'i', 'am', 'suffering', 'from', 'feel', 'feeling', 'have', 'having', 'a', 'an', 'the', 'my', 
    'body', 'is', 'it', 'me', 'and', 'but', 'or', 'with', 'in', 'of', 'due', 'to', 'like', 'symptom',
    'ache', 'sore', 'mild', 'severe' 
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

/**
 * Finds all diseases matching the symptom threshold and sorts them by severity.
 * @param {string[]} symptoms - Processed keywords from user input.
 * @param {number} minMatch - The required minimum match threshold.
 * @returns {Array<{disease: Object, matchCount: number, score: number}>} - Sorted list of matches.
 */
function findDisease(symptoms, minMatch = MIN_SYMPTOM_MATCH) {
    const potentialMatches = [];
    
    for (const disease of medicalData) { 
        let matchCount = 0;
        
        for (const userInputSymptom of symptoms) {
            if (disease.symptoms.some(ds => ds.toLowerCase().includes(userInputSymptom))) {
                matchCount++;
            }
        }
        
        if (matchCount >= minMatch) { 
            
            let priorityScore = matchCount;
            // Higher score for dangerous diseases ensures they rank higher
            if (disease.category === 'Dangerous') {
                priorityScore += 100;
            } else if (disease.category === 'Normal') {
                priorityScore += 10;
            }
            
            potentialMatches.push({
                disease: disease,
                matchCount: matchCount,
                score: priorityScore
            });
        }
    }
    
    // Sort the list by score (highest first), and then by matchCount (more specific match wins ties)
    potentialMatches.sort((a, b) => b.score - a.score || b.matchCount - a.matchCount);
    
    return potentialMatches; 
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

function processDiagnosis(results) {
    const isSingleDiagnosis = !Array.isArray(results);
    const diseasesToRender = isSingleDiagnosis ? [{ disease: results, matchCount: 0, score: 0 }] : results;
    
    let combinedResponse = [];
    let highestSeverity = 'Mild';
    let priorityDisease = diseasesToRender[0].disease; // Highest ranked disease for hospital lookup

    
    // --- 1. Iterate and Format Individual Diagnoses ---
    diseasesToRender.forEach((match, index) => {
        const disease = match.disease;
        const matchInfo = isSingleDiagnosis ? '' : ` (Match Score: ${match.matchCount})`;

        if (disease.category === 'Dangerous') {
            highestSeverity = 'Dangerous';
        } else if (disease.category === 'Normal' && highestSeverity === 'Mild') {
            highestSeverity = 'Normal';
        }

        let section = `
            <div class="diagnosis-summary-box">
                <strong class="diagnosis-name">${index + 1}. ${disease.disease_name}</strong>${matchInfo}
                <br>• Category: <span class="category-${disease.category}">${disease.category}</span>
                <br>• Action: Consult a ${disease.specialty} specialist.
            </div>
            <div class="diagnosis-detail">
                ${(disease.category === 'Mild' && drugProtocol.length) ? `
                    <p class="detail-line">💊 **Recommended OTC:** ${drugProtocol.find(d => d.approved_for_symptoms.some(s => disease.symptoms.includes(s)))?.medicine_key || 'General Pain Relief'}.</p>
                ` : ''}
                <p class="detail-line">⚠️ **Primary Advice:** ${disease.s1_action || disease.s2_action || 'Seek professional consultation.'}</p>
            </div>
            `;
        combinedResponse.push(section);
    });

    
    // --- 2. Determine Priority Action and Hospital Recommendation ---
    
    let finalAction = '';
    let hospitalRecommendation = '';
    
    if (highestSeverity !== 'Mild') {
        const immediateAction = priorityDisease.s3_trigger || 'Seek professional medical advice immediately.';
        finalAction = `
            <div class="priority-action-box">
                <p class="alert-header">🚨 **PRIORITY ACTION:** Worst-Case Scenario is ${highestSeverity}.</p>
                <p class="alert-detail">**Immediate Need:** ${immediateAction}</p>
            </div>
        `;

        if (highestSeverity === 'Dangerous' && userDistrict) {
            const districtKey = userDistrict.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            const districtData = hospitalData[districtKey] || [];
            
            if (districtData.length > 0) {
                const specialtyKeyword = (priorityDisease.specialty || '').toLowerCase().split(',')[0].trim();
                const suggestedHospital = districtData.find(h => h.Specialization.toLowerCase().includes(specialtyKeyword)) || districtData[0];

                hospitalRecommendation = `
                    <div class="hospital-box">
                        <p class="hospital-header">🏥 Hospital Recommendation (Based on ${districtKey}):</p>
                        <p class="hospital-name">**${suggestedHospital["Hospital Name"]}**</p>
                        <p class="hospital-detail">• Speciality: ${suggestedHospital.Specialization}</p>
                        <p class="hospital-detail">• Locality: ${suggestedHospital["Area/Locality"]}</p>
                    </div>
                `;
            } else {
                hospitalRecommendation = `<div class="hospital-box"><p class="alert-detail">🏥 Note: Could not find a specialized hospital in your district (${districtKey}). Proceed to the nearest major emergency hospital.</p></div>`;
            }
        }
    }


    // --- 3. Render Final Card ---
    
    const disclaimer = "Disclaimer: I am a virtual agent and cannot replace a doctor. Please consult a professional physician.";
    
    const finalHtml = `
        <div class="full-diagnosis-card">
            <h3 class="card-title">Diagnosis Results (${isSingleDiagnosis ? 'Direct Match' : 'Multi-Match'})</h3>
            <hr>
            ${finalAction}
            ${hospitalRecommendation}
            <div class="multi-match-list">
                <h4>Potential Conditions:</h4>
                ${combinedResponse.join('')}
            </div>
            <hr>
            <p class="disclaimer-text">${disclaimer}</p>
        </div>
    `;

    addMessage(finalHtml, 'agent');
    
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

            const diagnosedResults = findDisease(symptoms); 

            if (diagnosedResults.length > 0) {
                processDiagnosis(diagnosedResults); 
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